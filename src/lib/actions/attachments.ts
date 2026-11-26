"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { isUuid } from "@/lib/forms";
import { DOCUMENT_TYPES, IMAGE_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/storage-rules";
import type { ActionResult } from "@/components/ui/interactive";

const ENTITY_TYPES = ["clients", "projects", "skus", "custom_records", "suppliers", "packaging_items", "library_items"];

/**
 * Registra um arquivo já enviado diretamente do navegador ao Storage privado.
 * Confere se o caminho pertence ao workspace e à entidade informada.
 */
export async function registerAttachment(input: {
  entityType: string;
  entityId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  visibility: "internal" | "shareable";
  back: string;
}): Promise<ActionResult> {
  const s = await getSession();
  const { entityType, entityId, storagePath } = input;
  if (!ENTITY_TYPES.includes(entityType) || !isUuid(entityId)) return { ok: false, message: "Destino inválido." };
  const prefix = `${s.orgId}/${entityType}/${entityId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) return { ok: false, message: "Caminho de arquivo inválido." };
  if (!DOCUMENT_TYPES.includes(input.mimeType) || input.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: "Tipo ou tamanho de arquivo não permitido." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert({
    entity_type: entityType,
    entity_id: entityId,
    storage_path: storagePath,
    file_name: input.fileName.slice(0, 200),
    mime_type: input.mimeType,
    size_bytes: input.size,
    kind: IMAGE_TYPES.includes(input.mimeType) ? "image" : "document",
    visibility: input.visibility === "shareable" ? "shareable" : "internal",
  });
  if (error) {
    await supabase.storage.from("files").remove([storagePath]);
    return { ok: false, message: `Não foi possível registrar ${input.fileName}.` };
  }
  if (input.back.startsWith("/")) revalidatePath(input.back.split("?")[0]);
  return { ok: true };
}

export async function deleteAttachment(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Arquivo inválido." };
  const supabase = await createClient();
  const { data: att } = await supabase.from("attachments").select("storage_path").eq("id", id).single();
  if (!att) return { ok: false, message: "Arquivo não encontrado." };
  const { error } = await supabase.from("attachments").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir o arquivo." };
  await supabase.storage.from("files").remove([att.storage_path]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Arquivo excluído." };
}

export async function toggleAttachmentVisibility(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  const to = fd.get("to") === "shareable" ? "shareable" : "internal";
  if (!isUuid(id)) return { ok: false, message: "Arquivo inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("attachments").update({ visibility: to }).eq("id", id);
  if (error) return { ok: false, message: "Não foi possível alterar a visibilidade." };
  revalidatePath("/", "layout");
  return { ok: true, message: to === "shareable" ? "Arquivo marcado como compartilhável." : "Arquivo marcado como interno." };
}
