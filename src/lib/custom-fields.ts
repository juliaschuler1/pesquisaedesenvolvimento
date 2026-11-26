/** Campos personalizados: tipos, leitura do formulário e formatação para exibição. */
import { formatCurrency, formatDate, formatNumber, parseBRNumber } from "./format";

export type CustomField = {
  id: string;
  entity: string;
  key: string;
  label: string;
  field_type: "short_text" | "long_text" | "number" | "currency" | "percent" | "date" | "single_select" | "multi_select" | "checkbox" | "link" | string;
  section: string | null;
  position: number;
  required: boolean;
  settings: { choices?: string[] };
  visibility: "internal" | "shareable";
  archived_at: string | null;
  version: number;
};

export const FIELD_TYPE_LABEL: Record<string, string> = {
  short_text: "Texto curto",
  long_text: "Texto longo",
  number: "Número",
  currency: "Moeda (R$)",
  percent: "Porcentagem",
  date: "Data",
  single_select: "Seleção única",
  multi_select: "Seleção múltipla",
  checkbox: "Sim / não",
  link: "Link",
};

/** Tipos previstos para o construtor visual completo (Fase 6). */
export const FIELD_TYPES_PLANNED = ["Período", "Seleção por imagens", "Upload de imagens", "Upload de documentos", "Tabelas", "Paletas de cores", "Campos calculados", "Campos condicionais", "Relacionamentos"];

/** Lê os campos cf_<key> do FormData. Retorna dados e erros de validação. */
export function readCustomData(fd: FormData, fields: CustomField[], previous: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...previous };
  const errors: Record<string, string> = {};
  for (const f of fields.filter((x) => !x.archived_at)) {
    const name = `cf_${f.key}`;
    let v: unknown = null;
    switch (f.field_type) {
      case "number":
      case "currency":
      case "percent": {
        const raw = fd.get(name);
        v = parseBRNumber(raw);
        if (raw && String(raw).trim() && v === null) errors[name] = "Número inválido.";
        break;
      }
      case "checkbox":
        v = fd.get(name) === "on";
        break;
      case "multi_select":
        v = fd.getAll(name).map(String).filter((x) => (f.settings.choices ?? []).includes(x));
        break;
      case "single_select": {
        const s = String(fd.get(name) ?? "");
        v = (f.settings.choices ?? []).includes(s) ? s : null;
        break;
      }
      case "date": {
        const s = String(fd.get(name) ?? "");
        v = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
        break;
      }
      case "link": {
        const s = String(fd.get(name) ?? "").trim();
        v = s ? (/^https?:\/\//i.test(s) ? s : `https://${s}`) : null;
        break;
      }
      default: {
        const s = String(fd.get(name) ?? "").trim();
        v = s ? s.slice(0, f.field_type === "long_text" ? 20000 : 500) : null;
      }
    }
    const empty = v === null || v === "" || (Array.isArray(v) && v.length === 0);
    if (f.required && empty && f.field_type !== "checkbox") errors[name] = "Obrigatório.";
    data[f.key] = v;
  }
  return { data, errors };
}

export function displayCustomValue(f: CustomField, v: unknown): string {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
  switch (f.field_type) {
    case "currency":
      return formatCurrency(Number(v));
    case "percent":
      return `${formatNumber(Number(v), 1)}%`;
    case "number":
      return formatNumber(Number(v), Number(v) % 1 ? 2 : 0);
    case "date":
      return formatDate(String(v));
    case "checkbox":
      return v ? "Sim" : "Não";
    case "multi_select":
      return (v as string[]).join(", ");
    default:
      return String(v);
  }
}
