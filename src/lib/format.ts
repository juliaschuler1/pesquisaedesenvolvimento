/** Formatação regional brasileira (pt-BR, BRL, DD/MM/AAAA, America/Sao_Paulo por padrão). */

export const DEFAULT_TZ = "America/Sao_Paulo";

export function formatCurrency(value: number | null | undefined, currency = "BRL"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumber(value, digits)}%`;
}

/** Datas "puras" (YYYY-MM-DD) não sofrem conversão de fuso. */
export function formatDate(value: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!value) return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(value: string | Date | null | undefined, tz = DEFAULT_TZ): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Data de hoje (YYYY-MM-DD) no fuso configurado. */
export function todayISO(tz = DEFAULT_TZ, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA já produz YYYY-MM-DD
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas ISO (b - a). */
export function diffDays(a: string, b: string): number {
  const ms = new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime();
  return Math.round(ms / 86_400_000);
}

export function relativeDays(target: string | null | undefined, today: string): string {
  if (!target) return "";
  const n = diffDays(today, target.slice(0, 10));
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}

export function greeting(tz = DEFAULT_TZ, now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Converte texto digitado no padrão brasileiro ("1.234,56") em número. Vazio → null (nunca zero). */
export function parseBRNumber(input: FormDataEntryValue | string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  let normalized: string;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  // "5.000" ou "1.250.000" sem vírgula: pontos são separadores de milhar (padrão brasileiro)
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  else normalized = s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const clean = name.replace(/\[.*?\]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** ISO → "YYYY-MM-DDTHH:mm" no fuso informado (para <input type="datetime-local">). */
export function toLocalInput(iso: string | null | undefined, tz = DEFAULT_TZ): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}
