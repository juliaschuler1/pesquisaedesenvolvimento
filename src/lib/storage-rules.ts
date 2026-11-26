/** Regras de upload compartilhadas entre servidor e navegador. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
export const DOCUMENT_TYPES = [
  ...IMAGE_TYPES,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
];
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;


export function safeFileName(name: string) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return base.slice(-80) || "arquivo";
}
