"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { dateStr, isUuid, str } from "@/lib/forms";
import { isFile, uploadToStorage, validateFile } from "@/lib/storage";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { readCustomData } from "@/lib/custom-fields";
import { isLibraryKey } from "@/lib/libraries";
import type { ActionResult } from "@/components/ui/interactive";

export async function saveLibraryItem(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  const library = String(fd.get("library") ?? "");
  if (!isLibraryKey(library)) return { ok: false, message: "Biblioteca inválida." };
  const id = fd.get("id");
  const name = str(fd, "name", 200);
  if (!name) return { ok: false, message: "Informe o nome.", errors: { name: "Obrigatório" } };
  const image = fd.get("image");
  if (isFile(image)) {
    const e = validateFile(image, "image");
    if (e) return { ok: false, message: e, errors: { image: e } };
  }
  let url = str(fd, "source_url", 500);
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  const supplierId = str(fd, "supplier_id");
  const supabase = await createClient();
  const fields = await loadCustomFields(`library:${library}`);
  let previous: Record<string, unknown> = {};
  if (isUuid(id)) {
    const { data } = await supabase.from("library_items").select("data").eq("id", id).single();
    previous = (data?.data as Record<string, unknown>) ?? {};
  }
  const custom = readCustomData(fd, fields, previous);
  if (Object.keys(custom.errors).length) return { ok: false, message: "Revise os campos destacados.", errors: custom.errors };

  const row = {
    library,
    name,
    category: str(fd, "category", 120),
    description: str(fd, "description"),
    tags: (str(fd, "tags", 500) ?? "").split(/[,;]/).map((t) => t.trim()).filter(Boolean).slice(0, 30),
    supplier_id: isUuid(supplierId) ? supplierId : null,
    source_name: str(fd, "source_name", 200),
    source_url: url,
    reviewed_on: dateStr(fd, "reviewed_on"),
    notes: str(fd, "notes"),
    data: custom.data,
  };
  let itemId: string;
  if (isUuid(id)) {
    const { error } = await supabase.from("library_items").update(row).eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar." };
    itemId = id;
  } else {
    const { data, error } = await supabase.from("library_items").insert(row).select("id").single();
    if (error || !data) return { ok: false, message: "Não foi possível criar." };
    itemId = data.id;
  }
  if (isFile(image)) {
    try {
      const path = await uploadToStorage(supabase, s.orgId, "library_items", itemId, image);
      await supabase.from("library_items").update({ image_path: path }).eq("id", itemId);
    } catch {
      return { ok: false, message: "Item salvo, mas a imagem não pôde ser enviada." };
    }
  }
  revalidatePath(`/${library}`);
  revalidatePath(`/biblioteca/${itemId}`);
  return { ok: true, message: isUuid(id) ? "Item atualizado." : "Item adicionado à biblioteca." };
}
