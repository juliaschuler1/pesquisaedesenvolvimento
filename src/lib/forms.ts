/** Utilitários para ler FormData de forma segura (strings vazias viram null). */

export function str(fd: FormData, key: string, max = 5000): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

export function list(fd: FormData, key: string): string[] {
  return fd
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function dateStr(fd: FormData, key: string): string | null {
  const v = str(fd, key, 10);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function oneOf<T extends string>(fd: FormData, key: string, allowed: readonly T[], fallback: T): T {
  const v = str(fd, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
