"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/forms";
import { normalize, type CapabilityStatus, type ImportMapping } from "@/lib/import/engine";
import { TARGETS } from "@/lib/import/targets";
import type { ActionResult } from "@/components/ui/interactive";

type TargetKey = keyof typeof TARGETS;

export type ExistingMatch = { id: string; name: string };

/** Registros já existentes com o mesmo nome (normalizado) ou CNPJ/código. */
export async function findExisting(target: TargetKey, keys: string[]): Promise<Record<string, ExistingMatch>> {
  if (!(target in TARGETS)) return {};
  const supabase = await createClient();
  const { data } = await supabase.from(target).select("id, name").is("deleted_at", null).limit(10000);
  const wanted = new Set(keys);
  const out: Record<string, ExistingMatch> = {};
  for (const r of data ?? []) {
    const k = normalize(r.name);
    if (wanted.has(k)) out[k] = { id: r.id, name: r.name };
  }
  return out;
}

export type CommitRow = {
  row: number;
  action: "create" | "update" | "skip";
  existingId?: string;
  data: Record<string, unknown>;
  capabilities: Record<string, CapabilityStatus>;
  custom: Record<string, string>;
};

const ALLOWED_FIELDS: Record<TargetKey, string[]> = {
  suppliers: ["name", "legal_name", "cnpj", "quality_status", "quality_evaluated_year", "categories", "email", "phone", "whatsapp", "website", "country", "state", "city", "address", "moq", "lead_time", "price_range", "operation_model", "certifications", "technologies", "strengths", "notes", "internal_notes"],
  clients: ["name", "brand_name", "cnpj", "email", "phone", "whatsapp", "website", "segment", "positioning", "target_audience", "sales_channels", "notes"],
  packaging_items: ["name", "code", "component", "packaging_type", "material", "capacity", "capacity_unit", "dimensions", "finish", "color", "pantone", "closure", "moq", "lead_time", "unit_cost", "notes"],
};
const ARRAY_FIELDS = new Set(["categories", "certifications", "sales_channels"]);
const QUALITY = new Set(["approved", "approved_conditional", "rejected_conditional", "rejected", "pending"]);
const CAP_STATUS = new Set(["apto", "em_avaliacao", "suspenso", "na"]);

function cleanData(target: TargetKey, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS[target]) {
    const v = data[k];
    if (v === null || v === undefined || v === "") continue;
    if (ARRAY_FIELDS.has(k)) {
      if (Array.isArray(v)) out[k] = v.map((x) => String(x).slice(0, 200)).filter(Boolean).slice(0, 50);
    } else if (k === "quality_status") {
      if (QUALITY.has(String(v))) out[k] = v;
    } else if (["quality_evaluated_year", "capacity", "unit_cost"].includes(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    } else out[k] = String(v).slice(0, 20000);
  }
  return out;
}

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

/**
 * Grava a importação. Nunca sobrescreve dados existentes sem `overwrite`:
 * por padrão só preenche campos vazios e soma listas. Tudo fica registrado para desfazer.
 */
export async function commitImport(input: {
  target: TargetKey;
  fileName: string;
  sheetName: string;
  mapping: ImportMapping;
  overwrite: boolean;
  rows: CommitRow[];
}): Promise<ActionResult & { batchId?: string; stats?: Record<string, number> }> {
  const { target } = input;
  if (!(target in TARGETS)) return { ok: false, message: "Destino inválido." };
  if (input.rows.length > 5000) return { ok: false, message: "Importe até 5.000 linhas por vez." };
  const supabase = await createClient();

  const { data: batch, error: bErr } = await supabase
    .from("import_batches")
    .insert({ target, file_name: input.fileName.slice(0, 200), sheet_name: input.sheetName.slice(0, 200), mapping: input.mapping })
    .select("id")
    .single();
  if (bErr || !batch) return { ok: false, message: "Não foi possível iniciar a importação." };

  // campos personalizados criados durante a importação
  const customLabels = [...new Set(input.rows.flatMap((r) => Object.keys(r.custom)))];
  const customKeyByLabel: Record<string, string> = {};
  if (customLabels.length) {
    const { data: existing } = await supabase.from("custom_fields").select("key, label").eq("entity", target);
    for (const label of customLabels) {
      const found = (existing ?? []).find((f) => normalize(f.label) === normalize(label));
      if (found) {
        customKeyByLabel[label] = found.key;
        continue;
      }
      const key = normalize(label).replace(/ /g, "_").slice(0, 50) || "campo";
      await supabase.from("custom_fields").insert({ entity: target, key, label: label.slice(0, 80), field_type: "short_text", section: "Importação" });
      customKeyByLabel[label] = key;
    }
  }

  // capacidades novas entram na lista editável
  if (target === "suppliers") {
    const caps = [...new Set(input.rows.flatMap((r) => Object.keys(r.capabilities)))];
    if (caps.length) {
      const { data: set } = await supabase.from("option_sets").select("id").eq("key", "supplier_capabilities").maybeSingle();
      if (set) {
        const { data: last } = await supabase.from("options").select("position").eq("set_id", set.id).order("position", { ascending: false }).limit(1).maybeSingle();
        let pos = last?.position ?? 0;
        for (const c of caps) await supabase.from("options").upsert({ set_id: set.id, label: c.slice(0, 120), position: ++pos }, { onConflict: "set_id,label", ignoreDuplicates: true });
      }
    }
  }

  // fornecedor por nome (embalagens)
  let supplierByName: Record<string, string> = {};
  if (target === "packaging_items") {
    const { data: sups } = await supabase.from("suppliers").select("id, name").is("deleted_at", null);
    supplierByName = Object.fromEntries((sups ?? []).map((s) => [normalize(s.name), s.id]));
  }

  const report: { row: number; status: string; message?: string; id?: string }[] = [];
  const created: string[] = [];
  const snapshots: unknown[] = [];
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 };

  for (const r of input.rows) {
    if (r.action === "skip") {
      stats.skipped++;
      report.push({ row: r.row, status: "ignorada" });
      continue;
    }
    const data = cleanData(target, r.data);
    if (!data.name) {
      stats.errors++;
      report.push({ row: r.row, status: "erro", message: "Sem nome" });
      continue;
    }
    const custom = Object.fromEntries(Object.entries(r.custom).map(([l, v]) => [customKeyByLabel[l], String(v).slice(0, 500)]));
    if (target === "packaging_items" && r.data.supplier_name) {
      const sid = supplierByName[normalize(String(r.data.supplier_name))];
      if (sid) data.supplier_id = sid;
    }
    const caps = Object.entries(r.capabilities).filter(([, s]) => CAP_STATUS.has(s));

    if (r.action === "update" && isUuid(r.existingId)) {
      const { data: cur } = await supabase.from(target).select("*").eq("id", r.existingId).single();
      if (!cur) {
        stats.errors++;
        report.push({ row: r.row, status: "erro", message: "Registro existente não encontrado" });
        continue;
      }
      const patch: Record<string, unknown> = {};
      const before: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (k === "name") continue;
        if (ARRAY_FIELDS.has(k)) {
          const merged = [...new Set([...((cur[k] as string[]) ?? []), ...(v as string[])])];
          if (merged.length !== ((cur[k] as string[]) ?? []).length) {
            patch[k] = input.overwrite ? v : merged;
            before[k] = cur[k];
          }
        } else if (isEmpty(cur[k]) || (input.overwrite && cur[k] !== v)) {
          patch[k] = v;
          before[k] = cur[k];
        }
      }
      if (Object.keys(custom).length) {
        const cd = { ...((cur.custom_data as Record<string, unknown>) ?? {}) };
        let changed = false;
        for (const [k, v] of Object.entries(custom)) if (isEmpty(cd[k]) || input.overwrite) { cd[k] = v; changed = true; }
        if (changed) { patch.custom_data = cd; before.custom_data = cur.custom_data; }
      }
      if (Object.keys(patch).length) {
        const { error } = await supabase.from(target).update(patch).eq("id", r.existingId);
        if (error) {
          stats.errors++;
          report.push({ row: r.row, status: "erro", message: "Falha ao atualizar" });
          continue;
        }
      }
      const added: string[] = [];
      const previous: Record<string, string> = {};
      if (target === "suppliers" && caps.length) {
        const { data: curCaps } = await supabase.from("supplier_capabilities").select("capability, status").eq("supplier_id", r.existingId);
        const map = new Map((curCaps ?? []).map((c) => [c.capability, c.status]));
        for (const [cap, st] of caps) {
          if (!map.has(cap)) {
            added.push(cap);
            await supabase.from("supplier_capabilities").insert({ supplier_id: r.existingId, capability: cap, status: st });
          } else if (input.overwrite && map.get(cap) !== st) {
            previous[cap] = map.get(cap)!;
            await supabase.from("supplier_capabilities").update({ status: st }).eq("supplier_id", r.existingId).eq("capability", cap);
          }
        }
      }
      snapshots.push({ id: r.existingId, before, added_capabilities: added, previous_capabilities: previous });
      stats.updated++;
      report.push({ row: r.row, status: Object.keys(patch).length || added.length ? "atualizada" : "sem mudanças", id: r.existingId });
      continue;
    }

    const insert: Record<string, unknown> = { ...data, import_batch_id: batch.id };
    // não deixa o padrão do banco ("Brasil") inventar um país que a planilha não informou
    if (target === "suppliers" && !("country" in data)) insert.country = null;
    if (target === "clients") delete insert.import_batch_id; // clientes não têm vínculo de lote
    if (Object.keys(custom).length) insert.custom_data = custom;
    const { data: row, error } = await supabase.from(target).insert(insert).select("id").single();
    if (error || !row) {
      stats.errors++;
      report.push({ row: r.row, status: "erro", message: "Falha ao criar" });
      continue;
    }
    created.push(row.id);
    if (target === "suppliers" && caps.length) {
      await supabase.from("supplier_capabilities").insert(caps.map(([capability, status]) => ({ supplier_id: row.id, capability, status })));
    }
    if (target === "suppliers" && r.data.contact_name) {
      await supabase.from("supplier_contacts").insert({
        supplier_id: row.id,
        name: String(r.data.contact_name).slice(0, 200),
        role: r.data.contact_role ? String(r.data.contact_role).slice(0, 120) : null,
        email: r.data.contact_email ? String(r.data.contact_email).slice(0, 200) : null,
        is_primary: true,
      });
    }
    stats.created++;
    report.push({ row: r.row, status: "criada", id: row.id });
  }

  await supabase.from("import_batches").update({ stats, report, created_ids: created, update_snapshots: snapshots }).eq("id", batch.id);
  revalidatePath("/", "layout");
  return {
    ok: stats.errors === 0,
    batchId: batch.id,
    stats,
    message: `${stats.created} criados, ${stats.updated} atualizados, ${stats.skipped} ignorados${stats.errors ? `, ${stats.errors} com erro` : ""}.`,
  };
}

export async function undoImport(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Importação inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_import", { p_batch: id });
  if (error) return { ok: false, message: error.message.includes("já foi desfeita") ? "Esta importação já foi desfeita." : "Não foi possível desfazer. Registros podem ter sido alterados depois da importação." };
  revalidatePath("/", "layout");
  const r = data as { removed: number; restored: number };
  return { ok: true, message: `Importação desfeita: ${r.removed} removidos, ${r.restored} restaurados.` };
}
