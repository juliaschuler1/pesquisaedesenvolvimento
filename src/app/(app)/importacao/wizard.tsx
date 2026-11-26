"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import {
  autoMap, buildRecords, cellText, columnLetter, dataRows, detectHeaderRow, detectSections, headersOf, mergeDuplicates, parseCsv,
  type ColumnMap, type Grid, type ImportMapping, type ParsedRecord,
} from "@/lib/import/engine";
import { CAPABILITY_LABEL, QUALITY_LABEL, TARGETS } from "@/lib/import/targets";
import { commitImport, findExisting, type CommitRow, type ExistingMatch } from "@/lib/actions/import";
import { Badge, Button, Card, CardHeader, Select, cx, inputClass } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/interactive";
import { Icon } from "@/components/ui/icon";

type TargetKey = keyof typeof TARGETS;
type Sheet = { name: string; grid: Grid };
type Step = "upload" | "map" | "preview" | "done";

const TARGET_CARDS: { key: TargetKey; icon: string; hint: string }[] = [
  { key: "suppliers", icon: "Contact", hint: "Inclui planilhas em matriz (fornecedor × tipo de produto)" },
  { key: "clients", icon: "Users", hint: "Nome, marca, contatos, segmento" },
  { key: "packaging_items", icon: "Package", hint: "Código, material, capacidade, fornecedor" },
];

export function ImportWizard({ supplierCategories, capabilityOptions, initialTarget }: { supplierCategories: string[]; capabilityOptions: string[]; initialTarget?: TargetKey }) {
  const [step, setStep] = useState<Step>("upload");
  const [target, setTarget] = useState<TargetKey>(initialTarget && initialTarget in TARGETS ? initialTarget : "suppliers");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [existing, setExisting] = useState<Record<string, ExistingMatch>>({});
  const [decisions, setDecisions] = useState<Record<number, "create" | "update" | "skip">>({});
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<{ message?: string; stats?: Record<string, number> } | null>(null);
  const [busy, start] = useTransition();
  const [reading, setReading] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const cfg = TARGETS[target];
  const grid = useMemo<Grid>(() => sheets[sheetIdx]?.grid ?? [], [sheets, sheetIdx]);

  function setup(g: Grid, t: TargetKey = target) {
    const h = detectHeaderRow(g);
    const m = autoMap(TARGETS[t], g, h, capabilityOptions);
    const sections = detectSections(g, h);
    // seção inicial → primeira categoria (fabricantes); seções de embalagem → fornecedores de embalagens
    for (const sname of sections) {
      const n = sname.toLowerCase();
      m.sectionCategories[sname] = n.includes("embalag") ? (supplierCategories.find((c) => c.toLowerCase().includes("embalagens primárias")) ?? null) : n.includes("início") ? (supplierCategories[0] ?? null) : null;
    }
    setMapping(m);
  }

  async function onFile(f: File) {
    setReading(true);
    try {
      let list: Sheet[];
      if (/\.csv$/i.test(f.name) || f.type === "text/csv") {
        list = [{ name: f.name, grid: parseCsv(await f.text()) }];
      } else if (/\.xlsx$/i.test(f.name)) {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const read = await readXlsxFile(f);
        list = read.map((s) => ({ name: s.sheet, grid: s.data as Grid }));
      } else {
        toast("error", "Envie um arquivo .xlsx ou .csv. Arquivos .xls antigos: abra no Excel e salve como .xlsx.");
        return;
      }
      const best = list.reduce((bi, s, i) => (s.grid.length > list[bi].grid.length ? i : bi), 0);
      setFileName(f.name);
      setSheets(list);
      setSheetIdx(best);
      setup(list[best].grid);
      setStep("map");
    } catch {
      toast("error", "Não foi possível ler o arquivo. Confira se ele abre no Excel.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  const records = useMemo<ParsedRecord[]>(() => (mapping && grid.length ? mergeDuplicates(buildRecords(cfg, grid, mapping)) : []), [cfg, grid, mapping]);

  function updateColumn(col: number, patch: Partial<ColumnMap>) {
    setMapping((m) => (m ? { ...m, columns: m.columns.map((c) => (c.col === col ? { ...c, ...patch } : c)) } : m));
  }

  function goPreview() {
    const keys = records.filter((r) => r.key).map((r) => r.key);
    start(async () => {
      const found = await findExisting(target, keys);
      setExisting(found);
      setDecisions(Object.fromEntries(records.map((r) => [r.row, r.errors.length ? "skip" : found[r.key] ? "update" : "create"])));
      setStep("preview");
    });
  }

  function commit() {
    const rows: CommitRow[] = records.map((r) => ({
      row: r.row,
      action: decisions[r.row] ?? "skip",
      existingId: existing[r.key]?.id,
      data: r.data,
      capabilities: r.capabilities,
      custom: r.custom,
    }));
    start(async () => {
      const res = await commitImport({ target, fileName, sheetName: sheets[sheetIdx]?.name ?? "", mapping: mapping!, overwrite, rows });
      if (res?.message) toast(res.ok ? "success" : "error", res.message);
      if (res?.batchId) {
        setResult(res);
        setStep("done");
        router.refresh();
      }
    });
  }

  function reset() {
    setStep("upload");
    setSheets([]);
    setMapping(null);
    setResult(null);
  }

  /* ----------------------------- Etapa 1: arquivo ----------------------------- */
  if (step === "upload") {
    return (
      <Card>
        <CardHeader title="1. Escolha o destino e o arquivo" description="Excel (.xlsx) ou CSV. Nada é gravado antes da sua confirmação." />
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {TARGET_CARDS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTarget(t.key)}
              aria-pressed={target === t.key}
              className={cx("flex items-start gap-3 rounded-2xl p-4 text-left ring-1 transition-colors", target === t.key ? "bg-blush ring-deep" : "bg-white ring-blush hover:ring-mid")}
            >
              <Icon name={t.icon} size={20} className="mt-0.5 text-deep" />
              <span>
                <span className="block text-[14px] font-medium text-ink">{TARGETS[t.key].label}</span>
                <span className="block text-[12.5px] text-ink-soft">{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="px-5 pb-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onFile(f);
            }}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-pastel bg-[#fffafc] px-6 py-10 text-center"
          >
            {reading ? <Loader2 className="animate-spin text-deep" /> : <UploadCloud className="text-deep" strokeWidth={1.6} />}
            <p className="text-[14px] text-ink">{reading ? "Lendo a planilha…" : "Arraste a planilha aqui ou"}</p>
            <button type="button" onClick={() => input.current?.click()} className="text-[14px] font-medium text-deep hover:underline">escolha no computador</button>
            <input ref={input} type="file" hidden accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} aria-label="Arquivo da planilha" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
            Não tem planilha? <TemplateButton target={target} capabilityOptions={capabilityOptions} />
          </div>
        </div>
      </Card>
    );
  }

  /* ----------------------------- Etapa 2: mapeamento ----------------------------- */
  if (step === "map" && mapping) {
    const headers = headersOf(grid, mapping.headerRow);
    const sections = cfg.supportsSections ? detectSections(grid, mapping.headerRow) : [];
    const rowsForSample = dataRows(grid, mapping.headerRow);
    const sample = (col: number) => rowsForSample.map((r) => cellText(r.cells[col])).filter(Boolean).slice(0, 3).join(" · ");
    const validCount = records.filter((r) => !r.errors.length).length;

    return (
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title={`2. Conferir a leitura de “${fileName}”`} description={`Destino: ${cfg.label}. A plataforma sugeriu o mapeamento; ajuste o que precisar.`} action={<Button variant="ghost" size="sm" onClick={reset}>Trocar arquivo</Button>} />
          <div className="grid gap-4 p-5 md:grid-cols-3">
            {sheets.length > 1 && (
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                Aba da planilha
                <Select
                  value={String(sheetIdx)}
                  onChange={(e) => {
                    const i = Number(e.target.value);
                    setSheetIdx(i);
                    setup(sheets[i].grid);
                  }}
                  options={sheets.map((s, i) => ({ value: String(i), label: `${s.name} (${s.grid.length} linhas)` }))}
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
              Linha do cabeçalho
              <Select
                value={String(mapping.headerRow)}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  const m = autoMap(cfg, grid, h, capabilityOptions);
                  m.sectionCategories = mapping.sectionCategories;
                  setMapping(m);
                }}
                options={grid.slice(0, 30).map((r, i) => ({ value: String(i), label: `Linha ${i + 1}: ${(r ?? []).map(cellText).filter(Boolean).slice(0, 4).join(" | ").slice(0, 60) || "(vazia)"}` }))}
              />
            </label>
            {cfg.supportsCapabilities && mapping.qualityYear !== null && (
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                Ano da avaliação de qualidade
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={mapping.qualityYear ?? ""}
                  onChange={(e) => setMapping({ ...mapping, qualityYear: Number(e.target.value) || null })}
                />
              </label>
            )}
          </div>

          {sections.length > 1 && (
            <div className="border-t border-blush p-5">
              <h3 className="text-[14px] font-medium text-ink">Seções encontradas na planilha</h3>
              <p className="mb-3 text-[12.5px] text-ink-soft">Cada seção pode virar uma categoria de fornecedor.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {sections.map((sname) => (
                  <label key={sname} className="flex items-center gap-3 rounded-xl bg-[#fffafc] px-3 py-2 ring-1 ring-blush">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{sname}</span>
                    <select
                      value={mapping.sectionCategories[sname] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, sectionCategories: { ...mapping.sectionCategories, [sname]: e.target.value || null } })}
                      className="h-9 max-w-[60%] rounded-lg border border-pastel bg-white px-2 text-[13px]"
                      aria-label={`Categoria da seção ${sname}`}
                    >
                      <option value="">Sem categoria</option>
                      {supplierCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Colunas" description="Escolha para onde vai cada coluna. “Capacidade produtiva” lê valores como Apto, Em avaliação, Suspenso ou N/A." />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead>
                <tr className="border-y border-blush bg-[#fffafc] text-[12px] text-ink-soft">
                  <th className="px-5 py-2 font-medium">Coluna</th>
                  <th className="px-3 py-2 font-medium">Exemplos</th>
                  <th className="px-3 py-2 font-medium">Destino</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blush">
                {mapping.columns.map((c) => {
                  const value = c.mode === "field" ? `field:${c.field}` : c.mode;
                  return (
                    <tr key={c.col} className={c.mode === "ignore" ? "opacity-60" : undefined}>
                      <td className="px-5 py-2.5">
                        <span className="text-[11.5px] text-ink-soft">{columnLetter(c.col)}</span> <span className="text-ink">{headers[c.col]}</span>
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 text-[12.5px] text-ink-soft">{sample(c.col) || "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={value}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.startsWith("field:")) updateColumn(c.col, { mode: "field", field: v.slice(6) });
                              else if (v === "capability") updateColumn(c.col, { mode: "capability", capability: c.capability ?? headers[c.col] });
                              else if (v === "custom") updateColumn(c.col, { mode: "custom", customLabel: c.customLabel ?? headers[c.col] });
                              else updateColumn(c.col, { mode: "ignore" });
                            }}
                            className="h-9 rounded-lg border border-pastel bg-white px-2 text-[13px]"
                            aria-label={`Destino da coluna ${headers[c.col]}`}
                          >
                            <option value="ignore">Ignorar</option>
                            <optgroup label="Campos">
                              {cfg.fields.map((f) => <option key={f.key} value={`field:${f.key}`}>{f.label}</option>)}
                            </optgroup>
                            {cfg.supportsCapabilities && <option value="capability">Capacidade produtiva (matriz)</option>}
                            <option value="custom">Novo campo personalizado</option>
                          </select>
                          {c.mode === "capability" && (
                            <input value={c.capability ?? ""} onChange={(e) => updateColumn(c.col, { capability: e.target.value })} className="h-9 w-56 rounded-lg border border-pastel px-2 text-[13px]" aria-label="Nome da capacidade" />
                          )}
                          {c.mode === "custom" && (
                            <input value={c.customLabel ?? ""} onChange={(e) => updateColumn(c.col, { customLabel: e.target.value })} className="h-9 w-56 rounded-lg border border-pastel px-2 text-[13px]" aria-label="Nome do novo campo" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blush px-5 py-4">
            <p className="text-[13px] text-ink-soft">
              {records.length} linhas de dados · {validCount} válidas
              {!mapping.columns.some((c) => c.mode === "field" && c.field === "name") && <span className="text-danger"> · Escolha a coluna do nome</span>}
            </p>
            <Button onClick={goPreview} disabled={busy || validCount === 0}>
              {busy && <Loader2 size={16} className="animate-spin" />}Pré-visualizar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ----------------------------- Etapa 3: prévia ----------------------------- */
  if (step === "preview") {
    const count = (a: string) => Object.values(decisions).filter((d) => d === a).length;
    return (
      <Card>
        <CardHeader
          title="3. Pré-visualização"
          description={`${count("create")} novos · ${count("update")} já existentes · ${count("skip")} ignorados. Ajuste linha a linha se quiser.`}
          action={<Button variant="ghost" size="sm" onClick={() => setStep("map")}>Voltar ao mapeamento</Button>}
        />
        {count("update") > 0 && (
          <fieldset className="mx-5 mt-4 rounded-2xl bg-warning-bg/60 p-4 text-[13.5px] text-ink">
            <legend className="sr-only">Registros existentes</legend>
            <p className="font-medium">Para registros que já existem:</p>
            <label className="mt-2 flex items-center gap-2"><input type="radio" checked={!overwrite} onChange={() => setOverwrite(false)} className="accent-[var(--brand-deep)]" /> Preencher só campos vazios e somar listas (recomendado)</label>
            <label className="mt-1 flex items-center gap-2"><input type="radio" checked={overwrite} onChange={() => setOverwrite(true)} className="accent-[var(--brand-deep)]" /> Substituir pelos valores da planilha</label>
          </fieldset>
        )}
        <div className="mt-4 max-h-[60vh] overflow-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="sticky top-0 bg-[#fffafc]">
              <tr className="border-y border-blush text-[12px] text-ink-soft">
                <th className="px-5 py-2 font-medium">Linha</th>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Dados</th>
                <th className="px-3 py-2 font-medium">Avisos</th>
                <th className="px-3 py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush">
              {records.map((r) => {
                const ex = existing[r.key];
                const caps = Object.entries(r.capabilities);
                return (
                  <tr key={r.row} className={cx(decisions[r.row] === "skip" && "opacity-55")}>
                    <td className="px-5 py-2.5 text-ink-soft tabular">{r.row}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-ink">{String(r.data.name ?? "—")}</span>
                      {ex && <span className="block text-[11.5px] text-warning">já cadastrado como “{ex.name}”</span>}
                    </td>
                    <td className="max-w-[360px] px-3 py-2.5 text-[12.5px] text-ink-soft">
                      {r.data.quality_status ? <Badge tone={QUALITY_LABEL[String(r.data.quality_status)]?.tone ?? "neutral"} className="mr-1">{QUALITY_LABEL[String(r.data.quality_status)]?.label}</Badge> : null}
                      {Array.isArray(r.data.categories) && (r.data.categories as string[]).join(", ")}
                      {caps.length > 0 && <span className="block">{caps.filter(([, s]) => s !== "na").length} capacidades: {caps.filter(([, s]) => s !== "na").map(([c, s]) => `${c}${s !== "apto" ? ` (${CAPABILITY_LABEL[s]})` : ""}`).join(", ")}</span>}
                      {Object.entries(r.data).filter(([k]) => !["name", "quality_status", "categories", "quality_evaluated_year"].includes(k)).slice(0, 4).map(([k, v]) => <span key={k} className="block truncate">{cfg.fields.find((f) => f.key === k)?.label}: {Array.isArray(v) ? v.join(", ") : String(v)}</span>)}
                    </td>
                    <td className="px-3 py-2.5 text-[12px]">
                      {r.errors.map((e) => <span key={e} className="block text-danger">{e}</span>)}
                      {r.warnings.map((w) => <span key={w} className="block text-warning">{w}</span>)}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={decisions[r.row]}
                        disabled={r.errors.length > 0}
                        onChange={(e) => setDecisions({ ...decisions, [r.row]: e.target.value as "create" | "update" | "skip" })}
                        className="h-8 rounded-lg border border-pastel bg-white px-2 text-[12.5px]"
                        aria-label={`Ação para a linha ${r.row}`}
                      >
                        <option value="create">Criar novo</option>
                        {ex && <option value="update">Atualizar existente</option>}
                        <option value="skip">Ignorar</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-blush px-5 py-4">
          <p className="mr-auto text-[12.5px] text-ink-soft">Você poderá desfazer esta importação depois, no histórico abaixo.</p>
          <Button onClick={commit} disabled={busy || count("create") + count("update") === 0}>
            {busy && <Loader2 size={16} className="animate-spin" />}Importar {count("create") + count("update")} registros
          </Button>
        </div>
      </Card>
    );
  }

  /* ----------------------------- Etapa 4: resultado ----------------------------- */
  return (
    <Card>
      <CardHeader title="Importação concluída" description={result?.message} />
      <div className="flex flex-wrap gap-2 p-5">
        <Link href={target === "suppliers" ? "/fornecedores" : target === "clients" ? "/clientes" : "/embalagens"} className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-deep px-4 text-[14px] font-medium text-white">
          Ver {cfg.label.toLowerCase()}
        </Link>
        <Button variant="secondary" onClick={reset}>Importar outra planilha</Button>
      </div>
    </Card>
  );
}

/** Baixa um modelo .xlsx com as colunas reconhecidas automaticamente. */
function TemplateButton({ target, capabilityOptions }: { target: TargetKey; capabilityOptions: string[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="soft"
      size="sm"
      icon="Download"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { default: writeXlsxFile } = await import("write-excel-file/browser");
          const cfg = TARGETS[target];
          const fields = cfg.fields.filter((f) => !["internal_notes", "quality_evaluated_year"].includes(f.key));
          const caps = target === "suppliers" ? capabilityOptions.slice(0, 6) : [];
          const header = [...fields.map((f) => f.label), ...caps].map((v) => ({ value: v, fontWeight: "bold" as const }));
          const example = [...fields.map((f) => (f.required ? "Exemplo Ltda." : "")), ...caps.map((_, i) => (i === 0 ? "Apto" : ""))].map((v) => ({ value: v }));
          await writeXlsxFile([header, example] as never).toFile(`modelo-${cfg.label.toLowerCase()}.xlsx`);
        } finally {
          setBusy(false);
        }
      }}
    >
      Baixar modelo de planilha de {TARGETS[target].label.toLowerCase()}
    </Button>
  );
}
