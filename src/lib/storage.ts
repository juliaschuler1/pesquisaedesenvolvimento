import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DOCUMENT_TYPES, IMAGE_TYPES, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from "./storage-rules";
import { safeFileName } from "./storage-rules";
export { DOCUMENT_TYPES, IMAGE_TYPES, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES };

export function isFile(v: FormDataEntryValue | null): v is File {
  return typeof v === "object" && v !== null && "size" in v && (v as File).size > 0;
}


export function validateFile(file: File, kind: "image" | "document"): string | null {
  const types = kind === "image" ? IMAGE_TYPES : DOCUMENT_TYPES;
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (!types.includes(file.type)) {
    return kind === "image" ? "Envie uma imagem PNG, JPG, WEBP, GIF ou SVG." : "Tipo de arquivo não permitido.";
  }
  if (file.size > max) return `O arquivo excede ${Math.round(max / 1024 / 1024)} MB.`;
  return null;
}

/** Envia ao bucket privado em <org>/<entidade>/<id>/<timestamp>-<nome>. */
export async function uploadToStorage(
  supabase: SupabaseClient,
  orgId: string,
  entityType: string,
  entityId: string,
  file: File,
) {
  const path = `${orgId}/${entityType}/${entityId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("files").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Falha ao enviar o arquivo.");
  return path;
}

/** URLs temporárias (1 h) para exibir arquivos privados. */
export async function signedUrls(supabase: SupabaseClient, paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (list.length === 0) return {} as Record<string, string>;
  const { data } = await supabase.storage.from("files").createSignedUrls(list, 60 * 60);
  const out: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}
