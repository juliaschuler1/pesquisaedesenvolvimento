"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { isUuid, str } from "@/lib/forms";
import { parseBRNumber } from "@/lib/format";
import { isFile, uploadToStorage, validateFile } from "@/lib/storage";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { readCustomData } from "@/lib/custom-fields";
import { COMPONENTS } from "@/lib/packaging";
import type { ActionResult } from "@/components/ui/interactive";

export async function savePackaging(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  const supabase = await createClient();
  const id = fd.get("id");
  const errors: Record<string, string> = {};
  const name = str(fd, "name", 200);
  if (!name) errors.name = "Informe o nome da embalagem.";
  const component = str(fd, "component") ?? "frasco";
  if (!(component in COMPONENTS)) errors.component = "Componente inválido.";
  const capacity = parseBRNumber(fd.get("capacity"));
  if (fd.get("capacity") && capacity === null) errors.capacity = "Número inválido.";
  const fill = parseBRNumber(fd.get("fill_volume"));
  const cost = parseBRNumber(fd.get("unit_cost"));
  if (fd.get("unit_cost") && cost === null) errors.unit_cost = "Valor inválido.";
  const supplierId = str(fd, "supplier_id");
  const photo = fd.get("photo");
  if (isFile(photo)) {
    const e = validateFile(photo, "image");
    if (e) errors.photo = e;
  }
  const fields = await loadCustomFields("packaging_items");
  let previous: Record<string, unknown> = {};
  if (isUuid(id)) {
    const { data: cur } = await supabase.from("packaging_items").select("custom_data").eq("id", id).single();
    previous = (cur?.custom_data as Record<string, unknown>) ?? {};
  }
  const custom = readCustomData(fd, fields, previous);
  Object.assign(errors, custom.errors);
  if (Object.keys(errors).length) return { ok: false, message: "Revise os campos destacados.", errors };

  const unit = str(fd, "capacity_unit");
  const row = {
    component,
    packaging_type: str(fd, "packaging_type", 120),
    name,
    code: str(fd, "code", 80),
    supplier_id: isUuid(supplierId) ? supplierId : null,
    material: str(fd, "material", 120),
    capacity,
    capacity_unit: capacity !== null && unit && ["ml", "g", "kg", "L", "un"].includes(unit) ? unit : null,
    fill_volume: fill,
    dimensions: str(fd, "dimensions", 200),
    weight: str(fd, "weight", 80),
    finish: str(fd, "finish", 120),
    color: str(fd, "color", 120),
    pantone: str(fd, "pantone", 60),
    closure: str(fd, "closure", 120),
    thread: str(fd, "thread", 80),
    valve: str(fd, "valve", 200),
    applicator: str(fd, "applicator", 200),
    retainer: str(fd, "retainer", 200),
    decoration: str(fd, "decoration", 300),
    customization: str(fd, "customization"),
    moq: str(fd, "moq", 120),
    lead_time: str(fd, "lead_time", 120),
    unit_cost: cost,
    currency: (str(fd, "currency", 3) ?? "BRL").toUpperCase(),
    notes: str(fd, "notes"),
    internal_notes: str(fd, "internal_notes"),
    custom_data: custom.data,
  };

  let itemId: string;
  if (isUuid(id)) {
    const { error } = await supabase.from("packaging_items").update(row).eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar a embalagem." };
    itemId = id;
  } else {
    const { data, error } = await supabase.from("packaging_items").insert(row).select("id").single();
    if (error || !data) return { ok: false, message: "Não foi possível criar a embalagem." };
    itemId = data.id;
  }
  if (isFile(photo)) {
    try {
      const path = await uploadToStorage(supabase, s.orgId, "packaging_items", itemId, photo);
      await supabase.from("packaging_items").update({ photo_path: path }).eq("id", itemId);
    } catch {
      return { ok: false, message: "Embalagem salva, mas a foto não pôde ser enviada." };
    }
  }
  if (fd.get("remove_photo") === "on") await supabase.from("packaging_items").update({ photo_path: null }).eq("id", itemId);
  revalidatePath("/embalagens");
  redirect(`/embalagens/${itemId}`);
}

export async function duplicatePackaging(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Embalagem inválida." };
  const supabase = await createClient();
  const { data: e } = await supabase.from("packaging_items").select("*").eq("id", id).single();
  if (!e) return { ok: false, message: "Embalagem não encontrada." };
  const omit = ["id", "created_at", "updated_at", "archived_at", "deleted_at", "created_by", "is_demo", "photo_path", "import_batch_id"];
  const copy = Object.fromEntries(Object.entries(e).filter(([k]) => !omit.includes(k)));
  const { data: n, error } = await supabase.from("packaging_items").insert({ ...copy, name: `${e.name} (cópia)`, code: e.code ? `${e.code}-C` : null }).select("id").single();
  if (error || !n) return { ok: false, message: "Não foi possível duplicar." };
  redirect(`/embalagens/${n.id}/editar`);
}

export async function linkCompatible(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const a = fd.get("item_id");
  const b = fd.get("other_id");
  if (!isUuid(a) || !isUuid(b) || a === b) return { ok: false, message: "Escolha outro componente." };
  const [x, y] = [a, b].sort();
  const supabase = await createClient();
  const { error } = await supabase.from("packaging_compat").insert({ item_a: x, item_b: y, notes: str(fd, "notes", 300) });
  if (error) return { ok: false, message: error.code === "23505" ? "Já está marcado como compatível." : "Não foi possível vincular." };
  revalidatePath(`/embalagens/${a}`);
  return { ok: true, message: "Componente compatível adicionado." };
}

export async function unlinkCompatible(fd: FormData): Promise<ActionResult> {
  const a = fd.get("a");
  const b = fd.get("b");
  if (!isUuid(a) || !isUuid(b)) return { ok: false };
  const supabase = await createClient();
  await supabase.from("packaging_compat").delete().eq("item_a", a).eq("item_b", b);
  revalidatePath("/embalagens", "layout");
  return { ok: true, message: "Compatibilidade removida." };
}
