"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { dateStr, isUuid, list, oneOf, str } from "@/lib/forms";
import { parseBRNumber } from "@/lib/format";
import { isFile, uploadToStorage, validateFile } from "@/lib/storage";
import { VOLUME_UNITS } from "@/lib/domain";
import type { ActionResult } from "@/components/ui/interactive";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { readCustomData } from "@/lib/custom-fields";

const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["planning", "active", "paused", "completed", "cancelled"] as const;
const SKU_STATUSES = ["concept", "in_development", "sampling", "approved", "in_production", "launched", "paused", "cancelled"] as const;

/* ------------------------------------ Projeto ------------------------------------ */

export async function saveProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  const supabase = await createClient();
  const id = fd.get("id");
  const errors: Record<string, string> = {};

  const clientId = str(fd, "client_id");
  const name = str(fd, "name", 200);
  if (!isUuid(clientId)) errors.client_id = "Selecione o cliente.";
  if (!name) errors.name = "Informe o nome do projeto.";
  const start = dateStr(fd, "start_date");
  const launch = dateStr(fd, "launch_date");
  if (start && launch && launch < start) errors.launch_date = "A previsão de lançamento é anterior ao início.";
  const targetCost = parseBRNumber(fd.get("target_cost"));
  const budget = parseBRNumber(fd.get("budget"));
  if (fd.get("target_cost") && targetCost === null) errors.target_cost = "Valor inválido.";
  if (fd.get("budget") && budget === null) errors.budget = "Valor inválido.";
  const cover = fd.get("cover");
  if (isFile(cover)) {
    const e = validateFile(cover, "image");
    if (e) errors.cover = e;
  }
  const sharedVolume = parseBRNumber(fd.get("shared_volume"));
  const fields = await loadCustomFields("projects");
  let previous: Record<string, unknown> = {};
  if (isUuid(id)) {
    const { data: cur } = await supabase.from("projects").select("custom_data").eq("id", id).single();
    previous = (cur?.custom_data as Record<string, unknown>) ?? {};
  }
  const custom = readCustomData(fd, fields, previous);
  Object.assign(errors, custom.errors);
  if (Object.keys(errors).length) return { ok: false, message: "Revise os campos destacados.", errors };

  const row = {
    client_id: clientId,
    name,
    code: str(fd, "code", 60),
    category: str(fd, "category", 120),
    product_type: str(fd, "product_type", 120),
    concept: str(fd, "concept"),
    objective: str(fd, "objective"),
    rationale: str(fd, "rationale"),
    start_date: start,
    launch_date: launch,
    priority: oneOf(fd, "priority", PRIORITIES, "medium"),
    status: oneOf(fd, "status", STATUSES, "planning"),
    owners: list(fd, "owners").length ? list(fd, "owners") : (str(fd, "owners_text") ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    target_cost: targetCost,
    budget,
    sku_shared: {
      fragrance: str(fd, "shared_fragrance", 200),
      volume: sharedVolume,
      volume_unit: VOLUME_UNITS.includes(str(fd, "shared_volume_unit") as never) ? str(fd, "shared_volume_unit") : null,
      packaging: str(fd, "shared_packaging", 500),
      specs: str(fd, "shared_specs"),
    },
    notes: str(fd, "notes"),
    private_notes: str(fd, "private_notes"),
    custom_data: custom.data,
  };

  let projectId: string;
  if (isUuid(id)) {
    const { error } = await supabase.from("projects").update(row).eq("id", id);
    if (error) return { ok: false, message: error.code === "23505" ? "Já existe um projeto com este código." : "Não foi possível salvar o projeto." };
    projectId = id;
  } else {
    const { data, error } = await supabase.from("projects").insert(row).select("id").single();
    if (error || !data) return { ok: false, message: error?.code === "23505" ? "Já existe um projeto com este código." : "Não foi possível criar o projeto." };
    projectId = data.id;
    if (fd.get("apply_template") === "on") {
      await supabase.rpc("apply_schedule_template", { p_project: projectId, p_start: start });
    }
  }

  if (isFile(cover)) {
    try {
      const path = await uploadToStorage(supabase, s.orgId, "projects", projectId, cover);
      await supabase.from("projects").update({ cover_path: path }).eq("id", projectId);
    } catch {
      return { ok: false, message: "Projeto salvo, mas a imagem de capa não pôde ser enviada." };
    }
  }
  if (fd.get("remove_cover") === "on") await supabase.from("projects").update({ cover_path: null }).eq("id", projectId);

  revalidatePath("/", "layout");
  redirect(`/projetos/${projectId}`);
}

export async function duplicateProject(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Projeto inválido." };
  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!p) return { ok: false, message: "Projeto não encontrado." };
  const omit = ["id", "created_at", "updated_at", "archived_at", "deleted_at", "created_by", "is_demo", "cover_path"];
  const copy = Object.fromEntries(Object.entries(p).filter(([k]) => !omit.includes(k)));
  const { data: np, error } = await supabase
    .from("projects")
    .insert({ ...copy, name: `${p.name} (cópia)`, code: p.code ? `${p.code}-COPIA-${Date.now().toString().slice(-4)}` : null, status: "planning" })
    .select("id")
    .single();
  if (error || !np) return { ok: false, message: "Não foi possível duplicar o projeto." };

  const [{ data: skus }, { data: items }] = await Promise.all([
    supabase.from("skus").select("*").eq("project_id", id).is("deleted_at", null),
    supabase.from("schedule_items").select("*").eq("project_id", id).order("position"),
  ]);
  if (skus?.length) {
    await supabase.from("skus").insert(
      skus.map((sk) => {
        const { id: _i, created_at: _c, updated_at: _u, project_id: _p, is_demo: _d, image_path: _img, ...rest } = sk;
        void _i; void _c; void _u; void _p; void _d; void _img;
        return { ...rest, project_id: np.id, status: "concept" };
      }),
    );
  }
  if (items?.length) {
    // recria etapas sem status/datas reais, preservando dependências pela posição
    const idMap = new Map<string, string>();
    for (const it of items) idMap.set(it.id, crypto.randomUUID());
    await supabase.from("schedule_items").insert(
      items.map((it) => ({
        id: idMap.get(it.id),
        project_id: np.id,
        parent_id: it.parent_id ? idMap.get(it.parent_id) ?? null : null,
        name: it.name,
        position: it.position,
        weight: it.weight,
        is_milestone: it.is_milestone,
        planned_start: it.planned_start,
        planned_end: it.planned_end,
        baseline_start: it.planned_start,
        baseline_end: it.planned_end,
        depends_on: (it.depends_on as string[]).map((d) => idMap.get(d)).filter(Boolean),
        owner: it.owner,
        notes: it.notes,
      })),
    );
  }
  revalidatePath("/projetos");
  redirect(`/projetos/${np.id}/editar`);
}

/* ------------------------------------- SKUs -------------------------------------- */

export async function saveSku(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  const supabase = await createClient();
  const projectId = fd.get("project_id");
  const id = fd.get("id");
  const name = str(fd, "name", 200);
  if (!isUuid(projectId)) return { ok: false, message: "Projeto inválido." };
  if (!name) return { ok: false, message: "Informe o nome do SKU.", errors: { name: "Obrigatório" } };
  const gtin = str(fd, "gtin", 20);
  if (gtin && !/^\d{8}$|^\d{12,14}$/.test(gtin)) return { ok: false, message: "GTIN/EAN deve ter 8, 12, 13 ou 14 dígitos.", errors: { gtin: "Formato inválido" } };
  const volume = parseBRNumber(fd.get("volume"));
  const qty = parseBRNumber(fd.get("planned_quantity"));
  const image = fd.get("image");
  if (isFile(image)) {
    const e = validateFile(image, "image");
    if (e) return { ok: false, message: e, errors: { image: e } };
  }

  const row = {
    project_id: projectId,
    name,
    code: str(fd, "code", 60),
    gtin,
    color: str(fd, "color", 120),
    pantone: str(fd, "pantone", 60),
    fragrance: str(fd, "fragrance", 200),
    volume,
    volume_unit: volume !== null && VOLUME_UNITS.includes(str(fd, "volume_unit") as never) ? str(fd, "volume_unit") : null,
    planned_quantity: qty !== null ? Math.round(qty) : null,
    sample_version: str(fd, "sample_version", 60),
    packaging: str(fd, "packaging", 500),
    specs: str(fd, "specs"),
    approvals: str(fd, "approvals"),
    status: oneOf(fd, "status", SKU_STATUSES, "in_development"),
  };

  let skuId: string;
  if (isUuid(id)) {
    const { error } = await supabase.from("skus").update(row).eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar o SKU." };
    skuId = id;
  } else {
    const { data: last } = await supabase.from("skus").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase.from("skus").insert({ ...row, position: (last?.position ?? 0) + 1 }).select("id").single();
    if (error || !data) return { ok: false, message: "Não foi possível criar o SKU." };
    skuId = data.id;
  }
  if (isFile(image)) {
    try {
      const path = await uploadToStorage(supabase, s.orgId, "skus", skuId, image);
      await supabase.from("skus").update({ image_path: path }).eq("id", skuId);
    } catch {
      return { ok: false, message: "SKU salvo, mas a imagem não pôde ser enviada." };
    }
  }
  revalidatePath(`/projetos/${projectId}`);
  return { ok: true, message: isUuid(id) ? `SKU ${name} atualizado.` : `SKU ${name} criado.` };
}

export async function duplicateSku(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "SKU inválido." };
  const supabase = await createClient();
  const { data: sk } = await supabase.from("skus").select("*").eq("id", id).single();
  if (!sk) return { ok: false, message: "SKU não encontrado." };
  const { id: _i, created_at: _c, updated_at: _u, is_demo: _d, image_path: _img, gtin: _g, ...rest } = sk;
  void _i; void _c; void _u; void _d; void _img; void _g;
  const { error } = await supabase.from("skus").insert({ ...rest, name: `${sk.name} (cópia)`, code: sk.code ? `${sk.code}-C` : null, position: sk.position + 1 });
  if (error) return { ok: false, message: "Não foi possível duplicar o SKU." };
  revalidatePath(`/projetos/${sk.project_id}`);
  return { ok: true, message: "SKU duplicado (GTIN não copiado)." };
}

/* ---------------------------------- Cronograma ----------------------------------- */

export async function applyTemplate(fd: FormData): Promise<ActionResult> {
  const projectId = fd.get("project_id");
  if (!isUuid(projectId)) return { ok: false, message: "Projeto inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_schedule_template", { p_project: projectId, p_start: str(fd, "start") });
  if (error) return { ok: false, message: "Não foi possível aplicar o modelo." };
  revalidatePath(`/projetos/${projectId}`);
  return { ok: true, message: `${data} etapas adicionadas ao cronograma.` };
}

export async function setScheduleStatus(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  const status = String(fd.get("status"));
  if (!isUuid(id) || !["not_started", "in_progress", "done", "paused", "skipped"].includes(status)) return { ok: false, message: "Dados inválidos." };
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: it } = await supabase.from("schedule_items").select("project_id, actual_start, actual_end").eq("id", id).single();
  if (!it) return { ok: false, message: "Etapa não encontrada." };
  const patch: Record<string, unknown> = { status };
  if (status === "done") {
    patch.completed_at = new Date().toISOString();
    patch.actual_end = it.actual_end ?? today;
    patch.actual_start = it.actual_start ?? today;
  } else {
    patch.completed_at = null;
    patch.actual_end = null;
    if (status === "in_progress") patch.actual_start = it.actual_start ?? today;
  }
  const { error } = await supabase.from("schedule_items").update(patch).eq("id", id);
  if (error) return { ok: false, message: "Não foi possível atualizar a etapa." };
  revalidatePath(`/projetos/${it.project_id}`);
  revalidatePath("/dashboard");
  const labels: Record<string, string> = { done: "Etapa concluída.", in_progress: "Etapa em andamento.", not_started: "Etapa reaberta.", paused: "Etapa pausada.", skipped: "Etapa marcada como não aplicável." };
  return { ok: true, message: labels[status] };
}

export type ScheduleImpact = { id: string; name: string; from_start: string | null; from_end: string | null; to_start: string; to_end: string }[];

function shift(d: string | null, days: number) {
  if (!d) return null;
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
}

/** Calcula (sem gravar) o efeito de mover o término de uma etapa sobre as dependentes. */
async function computeImpact(projectId: string, itemId: string, newStart: string | null, newEnd: string | null) {
  const supabase = await createClient();
  const { data: items } = await supabase.from("schedule_items").select("id, name, planned_start, planned_end, depends_on, status").eq("project_id", projectId);
  const all = items ?? [];
  const byId = new Map(all.map((i) => [i.id, { ...i }]));
  const target = byId.get(itemId);
  if (!target) return [];
  target.planned_start = newStart;
  target.planned_end = newEnd;
  const changed: ScheduleImpact = [];
  // propagação em largura: dependente começa no dia seguinte ao fim da predecessora mais tardia
  const queue = [itemId];
  const seen = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    for (const dep of all.filter((i) => (i.depends_on as string[]).includes(cur))) {
      const d = byId.get(dep.id)!;
      if (d.status === "done" || d.status === "skipped") continue;
      const preds = (d.depends_on as string[]).map((p) => byId.get(p)?.planned_end).filter(Boolean) as string[];
      if (!preds.length || !d.planned_start) continue;
      const latest = preds.sort().at(-1)!;
      const wantStart = shift(latest, 1)!;
      if (wantStart === d.planned_start) continue;
      const delta = Math.round((new Date(wantStart).getTime() - new Date(d.planned_start).getTime()) / 86_400_000);
      const orig = all.find((x) => x.id === d.id)!;
      d.planned_start = wantStart;
      d.planned_end = shift(d.planned_end, delta);
      if (!seen.has(d.id)) {
        seen.add(d.id);
        changed.push({ id: d.id, name: d.name, from_start: orig.planned_start, from_end: orig.planned_end, to_start: d.planned_start!, to_end: d.planned_end ?? d.planned_start! });
      } else {
        const c = changed.find((x) => x.id === d.id)!;
        c.to_start = d.planned_start!;
        c.to_end = d.planned_end ?? d.planned_start!;
      }
      queue.push(d.id);
    }
  }
  return changed;
}

export async function previewReschedule(input: { projectId: string; itemId: string; start: string | null; end: string | null }) {
  if (!isUuid(input.projectId) || !isUuid(input.itemId)) return [];
  return computeImpact(input.projectId, input.itemId, input.start, input.end);
}

export async function saveScheduleItem(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const projectId = fd.get("project_id");
  const id = fd.get("id");
  const name = str(fd, "name", 200);
  if (!isUuid(projectId)) return { ok: false, message: "Projeto inválido." };
  if (!name) return { ok: false, message: "Informe o nome da etapa.", errors: { name: "Obrigatório" } };
  const start = dateStr(fd, "planned_start");
  const end = dateStr(fd, "planned_end");
  if (start && end && end < start) return { ok: false, message: "O término não pode ser anterior ao início.", errors: { planned_end: "Antes do início" } };
  const weight = parseBRNumber(fd.get("weight")) ?? 1;
  const dependsOn = list(fd, "depends_on").filter(isUuid).filter((d) => d !== id);
  const row = {
    project_id: projectId,
    name,
    planned_start: start,
    planned_end: end,
    actual_start: dateStr(fd, "actual_start"),
    actual_end: dateStr(fd, "actual_end"),
    weight: Math.max(0, Math.min(weight, 100)),
    is_milestone: fd.get("is_milestone") === "on",
    owner: str(fd, "owner", 120),
    priority: oneOf(fd, "priority", [...PRIORITIES, ""] as const, "") || null,
    notes: str(fd, "notes"),
    depends_on: dependsOn,
  };
  if (isUuid(id)) {
    const { error } = await supabase.from("schedule_items").update(row).eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar a etapa." };
    if (fd.get("cascade") === "on") {
      const impact = await computeImpact(projectId, id, start, end);
      for (const c of impact) {
        await supabase.from("schedule_items").update({ planned_start: c.to_start, planned_end: c.to_end }).eq("id", c.id);
      }
      revalidatePath(`/projetos/${projectId}`);
      return { ok: true, message: impact.length ? `Etapa salva e ${impact.length} dependente(s) reprogramada(s).` : "Etapa salva." };
    }
  } else {
    const { data: last } = await supabase.from("schedule_items").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("schedule_items").insert({ ...row, position: (last?.position ?? 0) + 1, baseline_start: start, baseline_end: end });
    if (error) return { ok: false, message: "Não foi possível criar a etapa." };
  }
  revalidatePath(`/projetos/${projectId}`);
  return { ok: true, message: isUuid(id) ? "Etapa salva." : "Etapa adicionada." };
}

export async function moveScheduleItem(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  const dir = fd.get("dir") === "up" ? -1 : 1;
  if (!isUuid(id)) return { ok: false, message: "Etapa inválida." };
  const supabase = await createClient();
  const { data: it } = await supabase.from("schedule_items").select("id, project_id, position").eq("id", id).single();
  if (!it) return { ok: false, message: "Etapa não encontrada." };
  const { data: other } = await supabase
    .from("schedule_items")
    .select("id, position")
    .eq("project_id", it.project_id)
    .filter("position", dir < 0 ? "lt" : "gt", it.position)
    .order("position", { ascending: dir > 0 })
    .limit(1)
    .maybeSingle();
  if (!other) return { ok: true };
  await supabase.from("schedule_items").update({ position: other.position }).eq("id", it.id);
  await supabase.from("schedule_items").update({ position: it.position }).eq("id", other.id);
  revalidatePath(`/projetos/${it.project_id}`);
  return { ok: true };
}

export async function deleteScheduleItem(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Etapa inválida." };
  const supabase = await createClient();
  const { data: it } = await supabase.from("schedule_items").select("project_id").eq("id", id).single();
  // remove referências de dependência antes de excluir
  const { data: deps } = await supabase.from("schedule_items").select("id, depends_on").contains("depends_on", [id]);
  for (const d of deps ?? []) {
    await supabase.from("schedule_items").update({ depends_on: (d.depends_on as string[]).filter((x) => x !== id) }).eq("id", d.id);
  }
  const { error } = await supabase.from("schedule_items").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir a etapa." };
  if (it) revalidatePath(`/projetos/${it.project_id}`);
  return { ok: true, message: "Etapa excluída." };
}

/* ------------------------------- Abas do projeto -------------------------------- */

/** Copia as abas padrão para o projeto (personalização) e aplica a mudança pedida. */
export async function customizeProjectTabs(fd: FormData): Promise<ActionResult> {
  const projectId = fd.get("project_id");
  const op = String(fd.get("op"));
  const key = str(fd, "key", 60);
  if (!isUuid(projectId)) return { ok: false, message: "Projeto inválido." };
  const supabase = await createClient();
  const { data: own } = await supabase.from("project_tabs").select("*").eq("project_id", projectId).order("position");
  let tabs = own ?? [];
  if (tabs.length === 0) {
    const { data: defaults } = await supabase.from("project_tabs").select("*").is("project_id", null).order("position");
    const { data: inserted, error } = await supabase
      .from("project_tabs")
      .insert((defaults ?? []).map(({ id: _id, org_id: _o, ...t }) => { void _id; void _o; return { ...t, project_id: projectId }; }))
      .select("*");
    if (error) return { ok: false, message: "Não foi possível personalizar as abas." };
    tabs = (inserted ?? []).sort((a, b) => a.position - b.position);
  }
  if (op === "add") {
    const label = str(fd, "label", 60);
    if (!label) return { ok: false, message: "Informe o nome da aba." };
    const slug = "custom-" + label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    if (tabs.some((t) => t.key === slug)) return { ok: false, message: "Já existe uma aba com esse nome." };
    const { error } = await supabase.from("project_tabs").insert({ project_id: projectId, key: slug, label, icon: str(fd, "icon", 40) ?? "Sparkles", kind: "custom", position: (tabs.at(-1)?.position ?? 0) + 1 });
    if (error) return { ok: false, message: "Não foi possível criar a aba." };
  } else if (key) {
    const t = tabs.find((x) => x.key === key);
    if (!t) return { ok: false, message: "Aba não encontrada." };
    if (op === "toggle") await supabase.from("project_tabs").update({ visible: !t.visible }).eq("id", t.id);
    if (op === "up" || op === "down") {
      const idx = tabs.findIndex((x) => x.key === key);
      const other = tabs[op === "up" ? idx - 1 : idx + 1];
      if (other) {
        await supabase.from("project_tabs").update({ position: other.position }).eq("id", t.id);
        await supabase.from("project_tabs").update({ position: t.position }).eq("id", other.id);
      }
    }
    if (op === "remove" && t.kind === "custom") await supabase.from("project_tabs").delete().eq("id", t.id);
  }
  revalidatePath(`/projetos/${projectId}`);
  return { ok: true, message: op === "add" ? "Aba criada." : "Abas atualizadas." };
}

export async function saveCustomTabContent(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const projectId = fd.get("project_id");
  const key = str(fd, "key", 60);
  if (!isUuid(projectId) || !key) return { ok: false, message: "Dados inválidos." };
  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("custom_data").eq("id", projectId).single();
  const data = (p?.custom_data ?? {}) as Record<string, unknown>;
  const tabsData = (data.tabs ?? {}) as Record<string, unknown>;
  tabsData[key] = { content: str(fd, "content", 50000), updated_at: new Date().toISOString() };
  const { error } = await supabase.from("projects").update({ custom_data: { ...data, tabs: tabsData } }).eq("id", projectId);
  if (error) return { ok: false, message: "Não foi possível salvar." };
  revalidatePath(`/projetos/${projectId}`);
  return { ok: true, message: "Conteúdo salvo." };
}
