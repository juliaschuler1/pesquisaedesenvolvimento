/**
 * Motor de importação de planilhas (funções puras, usadas no navegador e testadas).
 * Entende planilhas "em matriz" (fornecedor × tipo de produto), seções e cabeçalhos repetidos.
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type Grid = Cell[][];

export type FieldType = "text" | "longtext" | "number" | "money" | "email" | "url" | "list" | "year" | "quality" | "cnpj" | "component" | "unit";

export type TargetField = { key: string; label: string; type: FieldType; aliases: string[]; required?: boolean };

export type TargetConfig = {
  key: "suppliers" | "clients" | "packaging_items";
  label: string;
  fields: TargetField[];
  supportsCapabilities: boolean;
  supportsSections: boolean;
  dedupeLabel: string;
};

export type ColumnMode = "field" | "capability" | "custom" | "ignore";
export type ColumnMap = { col: number; header: string; mode: ColumnMode; field?: string; customLabel?: string; capability?: string };

export type ImportMapping = {
  headerRow: number;
  columns: ColumnMap[];
  sectionCategories: Record<string, string | null>; // rótulo da seção → categoria
  qualityYear: number | null;
};

export type ParsedRecord = {
  row: number; // linha da planilha (1-based)
  section: string | null;
  key: string; // nome normalizado (deduplicação)
  data: Record<string, unknown>;
  capabilities: Record<string, CapabilityStatus>;
  custom: Record<string, string>;
  errors: string[];
  warnings: string[];
};

export type CapabilityStatus = "apto" | "em_avaliacao" | "suspenso" | "na";

export const NO_SECTION = "(início da planilha)";

/* --------------------------------- Texto --------------------------------- */

export function cellText(c: Cell): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).replace(/\s+/g, " ").trim();
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP = new Set(["e", "de", "da", "do", "das", "dos", "a", "o"]);
function tokens(s: string) {
  return normalize(s)
    .split(" ")
    .filter((t) => t && !STOP.has(t));
}

/** "BATOM /CORRETIVO\nBALA" → "Batom/corretivo bala" */
export function prettyLabel(header: string): string {
  const t = cellText(header).replace(/\s*\/\s*/g, "/").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Encontra a opção existente equivalente (ignora acentos, caixa, "e/de" e barras). */
export function matchOption(label: string, options: string[]): string | null {
  const want = tokens(label).join(" ");
  if (!want) return null;
  for (const o of options) if (tokens(o).join(" ") === want) return o;
  return null;
}

/* ------------------------------ Estrutura -------------------------------- */

function nonEmpty(row: Cell[] | undefined) {
  return (row ?? []).map(cellText).filter(Boolean);
}

/** Linha de cabeçalho: a primeira com mais células de texto preenchidas (entre as 30 primeiras). */
export function detectHeaderRow(grid: Grid): number {
  let best = 0;
  let bestCount = -1;
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const texts = (grid[i] ?? []).filter((c) => typeof c === "string" && cellText(c)).length;
    if (texts > bestCount) {
      bestCount = texts;
      best = i;
    }
  }
  return best;
}

export function headersOf(grid: Grid, headerRow: number): string[] {
  const row = grid[headerRow] ?? [];
  const width = Math.max(...grid.slice(headerRow, headerRow + 200).map((r) => r?.length ?? 0), row.length);
  return Array.from({ length: width }, (_, i) => cellText(row[i]) || `Coluna ${columnLetter(i)}`);
}

export function columnLetter(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Linha de seção: só a primeira coluna preenchida, depois do cabeçalho. */
export function isSectionRow(row: Cell[] | undefined): boolean {
  const cells = (row ?? []).map(cellText);
  return Boolean(cells[0]) && cells.slice(1).every((c) => !c);
}

export function isRepeatedHeader(row: Cell[] | undefined, headerRowCells: Cell[] | undefined): boolean {
  const a = (row ?? []).map(cellText);
  const b = (headerRowCells ?? []).map(cellText);
  if (!a[0] || normalize(a[0]) !== normalize(b[0] ?? "")) return false;
  const filled = a.filter(Boolean).length;
  return filled >= 2;
}

export function detectSections(grid: Grid, headerRow: number): string[] {
  const out: string[] = [];
  let sawData = false;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i];
    if (isRepeatedHeader(row, grid[headerRow])) continue;
    if (isSectionRow(row) && looksLikeSectionLabel(cellText(row![0]))) {
      out.push(cellText(row![0]));
    } else if (nonEmpty(row).length) sawData = true;
  }
  return sawData || out.length ? [NO_SECTION, ...out] : [];
}

/** Rótulos de seção costumam estar em maiúsculas ou conter "/" — evita confundir com fornecedor sem dados. */
function looksLikeSectionLabel(s: string) {
  return s.length >= 3 && (s === s.toUpperCase() || s.includes("/")) && /[A-ZÀ-Ú]/.test(s);
}

/* ------------------------------ Valores ------------------------------------ */

export function capabilityStatus(c: Cell): CapabilityStatus | null {
  const v = normalize(cellText(c));
  if (!v) return null;
  if (["apto", "apta", "sim", "x", "ok", "s", "yes", "aprovado", "1", "true"].includes(v)) return "apto";
  if (v.startsWith("em avaliac") || v === "avaliando" || v === "em teste") return "em_avaliacao";
  if (v.startsWith("suspens")) return "suspenso";
  if (["n a", "na", "nao", "n", "no", "0", "false", "nao apto", "inapto"].includes(v)) return "na";
  return null;
}

const QUALITY: Record<string, string> = {
  aprovado: "approved",
  "aprovado condicionalmente": "approved_conditional",
  "reprovado condicionalmente": "rejected_conditional",
  reprovado: "rejected",
  pendente: "pending",
};
export function qualityStatus(c: Cell): string | null | undefined {
  const v = normalize(cellText(c));
  if (!v) return null;
  return QUALITY[v]; // undefined = valor não reconhecido
}

export function parseNumberCell(c: Cell): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const s = cellText(c).replace(/\s|R\$/g, "");
  if (!s) return null;
  let n: string;
  if (s.includes(",")) n = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) n = s.replace(/\./g, "");
  else n = s;
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

/* ------------------------------ Mapeamento --------------------------------- */

export function autoMap(target: TargetConfig, grid: Grid, headerRow: number, capabilityOptions: string[] = []): ImportMapping {
  const headers = headersOf(grid, headerRow);
  const used = new Set<string>();
  let qualityYear: number | null = null;
  const sample = dataRows(grid, headerRow).slice(0, 80);

  const columns: ColumnMap[] = headers.map((header, col) => {
    const h = normalize(header);
    const emptyHeader = header.startsWith("Coluna ");
    const field = target.fields.find((f) => !used.has(f.key) && f.aliases.some((a) => h === a || h.startsWith(a + " ") || (a.length > 4 && h.includes(a))));
    if (field && !emptyHeader) {
      used.add(field.key);
      if (field.type === "quality") {
        const y = header.match(/(19|20)\d{2}/);
        if (y) qualityYear = Number(y[0]);
      }
      return { col, header, mode: "field", field: field.key };
    }
    if (target.supportsCapabilities && !emptyHeader) {
      const values = sample.map((r) => r.cells[col]).filter((c) => cellText(c));
      // coluna de matriz: a maioria (≥ 60%) dos valores preenchidos são status (Apto, N/A…); o resto vira aviso
      const ok = values.filter((c) => capabilityStatus(c) !== null).length;
      if (values.length && ok / values.length >= 0.6) {
        return { col, header, mode: "capability", capability: matchOption(header, capabilityOptions) ?? prettyLabel(header) };
      }
    }
    return { col, header, mode: "ignore" };
  });

  return { headerRow, columns, sectionCategories: {}, qualityYear };
}

/** Linhas de dados com a seção correspondente (ignora seções, cabeçalhos repetidos e linhas vazias). */
export function dataRows(grid: Grid, headerRow: number) {
  const out: { index: number; cells: Cell[]; section: string }[] = [];
  let section = NO_SECTION;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    if (!nonEmpty(row).length) continue;
    if (isRepeatedHeader(row, grid[headerRow])) continue;
    if (isSectionRow(row) && looksLikeSectionLabel(cellText(row[0]))) {
      section = cellText(row[0]);
      continue;
    }
    out.push({ index: i, cells: row, section });
  }
  return out;
}

function sanitize(field: TargetField, c: Cell): { value: unknown; error?: string } {
  const t = cellText(c);
  if (!t) return { value: null };
  switch (field.type) {
    case "number":
    case "money": {
      const n = parseNumberCell(c);
      return n === null ? { value: null, error: `${field.label}: “${t}” não é um número` } : { value: n };
    }
    case "year": {
      const n = parseNumberCell(c);
      return n && n >= 1990 && n <= 2100 ? { value: Math.round(n) } : { value: null, error: `${field.label}: ano inválido` };
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? { value: t.toLowerCase() } : { value: null, error: `${field.label}: e-mail inválido (“${t}”)` };
    case "url":
      return { value: /^https?:\/\//i.test(t) ? t : `https://${t}` };
    case "list":
      return { value: t.split(/[;,\n|]/).map((x) => x.trim()).filter(Boolean) };
    case "cnpj": {
      const d = t.replace(/\D/g, "");
      return d.length === 14 ? { value: t } : { value: t, error: `${field.label}: CNPJ deveria ter 14 dígitos` };
    }
    case "quality": {
      const q = qualityStatus(c);
      return q === undefined ? { value: null, error: `${field.label}: “${t}” não é um status conhecido` } : { value: q };
    }
    case "unit": {
      const u = t.toLowerCase() === "l" ? "L" : t.toLowerCase();
      return ["ml", "g", "kg", "L", "un"].includes(u) ? { value: u } : { value: null, error: `${field.label}: unidade inválida` };
    }
    case "component": {
      const map: Record<string, string> = { frasco: "frasco", pote: "pote", bisnaga: "bisnaga", tampa: "tampa", valvula: "valvula", pump: "pump", spray: "spray", aplicador: "aplicador", retentor: "retentor", compacto: "compacto", batom: "batom", lapiseira: "lapiseira", sache: "sache", refil: "refil", cartucho: "cartucho", rotulo: "rotulo", sleeve: "sleeve" };
      return { value: map[normalize(t)] ?? "outro" };
    }
    default:
      return { value: t.slice(0, field.type === "longtext" ? 20000 : 500) };
  }
}

export function buildRecords(target: TargetConfig, grid: Grid, mapping: ImportMapping): ParsedRecord[] {
  const fieldBy = new Map(target.fields.map((f) => [f.key, f]));
  const nameField = target.fields.find((f) => f.required)!;
  const records: ParsedRecord[] = [];
  const seen = new Map<string, number>();

  for (const r of dataRows(grid, mapping.headerRow)) {
    const rec: ParsedRecord = { row: r.index + 1, section: r.section, key: "", data: {}, capabilities: {}, custom: {}, errors: [], warnings: [] };
    for (const m of mapping.columns) {
      const c = r.cells[m.col];
      if (m.mode === "field" && m.field) {
        const f = fieldBy.get(m.field);
        if (!f) continue;
        const { value, error } = sanitize(f, c);
        if (error) rec.warnings.push(error);
        if (value !== null && value !== undefined) {
          const prev = rec.data[f.key];
          rec.data[f.key] = f.type === "list" && Array.isArray(prev) ? [...new Set([...(prev as string[]), ...(value as string[])])] : value;
        }
      } else if (m.mode === "capability" && m.capability) {
        const st = capabilityStatus(c);
        if (st) rec.capabilities[m.capability] = st;
        else if (cellText(c)) rec.warnings.push(`${m.header}: valor “${cellText(c)}” não reconhecido`);
      } else if (m.mode === "custom" && m.customLabel) {
        const t = cellText(c);
        if (t) rec.custom[m.customLabel] = t;
      }
    }
    if (target.supportsSections) {
      const cat = mapping.sectionCategories[r.section];
      if (cat) {
        const prev = (rec.data.categories as string[] | undefined) ?? [];
        rec.data.categories = [...new Set([...prev, cat])];
      }
    }
    if (mapping.qualityYear && rec.data.quality_status) rec.data.quality_evaluated_year ??= mapping.qualityYear;

    const name = rec.data[nameField.key];
    if (!name) rec.errors.push(`Sem ${nameField.label.toLowerCase()}`);
    rec.key = normalize(String(name ?? ""));
    if (rec.key) {
      const first = seen.get(rec.key);
      if (first !== undefined) rec.warnings.push(`Repetido na planilha (linha ${first}); será mesclado`);
      else seen.set(rec.key, rec.row);
    }
    records.push(rec);
  }
  return records;
}

/** Mescla linhas repetidas (mesmo nome) numa só, unindo listas e capacidades. */
export function mergeDuplicates(records: ParsedRecord[]): ParsedRecord[] {
  const byKey = new Map<string, ParsedRecord>();
  const out: ParsedRecord[] = [];
  for (const r of records) {
    if (!r.key || r.errors.length) {
      out.push(r);
      continue;
    }
    const prev = byKey.get(r.key);
    if (!prev) {
      byKey.set(r.key, { ...r, data: { ...r.data }, capabilities: { ...r.capabilities }, custom: { ...r.custom }, warnings: [...r.warnings] });
      out.push(byKey.get(r.key)!);
      continue;
    }
    for (const [k, v] of Object.entries(r.data)) {
      if (Array.isArray(v) && Array.isArray(prev.data[k])) prev.data[k] = [...new Set([...(prev.data[k] as unknown[]), ...v])];
      else if (prev.data[k] === null || prev.data[k] === undefined) prev.data[k] = v;
    }
    Object.assign(prev.capabilities, r.capabilities);
    Object.assign(prev.custom, r.custom);
    prev.warnings.push(`Mesclado com a linha ${r.row}`);
  }
  return out;
}

/** Lê CSV (separador ; ou , detectado automaticamente, aspas e BOM do Excel). */
export function parseCsv(text: string): Grid {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: Grid = [];
  let row: Cell[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => (c === "" ? null : c)));
}
