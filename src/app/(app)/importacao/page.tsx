import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { loadOptionSets } from "@/lib/data/options";
import { undoImport } from "@/lib/actions/import";
import { TARGETS } from "@/lib/import/targets";
import { formatDateTime } from "@/lib/format";
import { ImportWizard } from "./wizard";

export const metadata: Metadata = { title: "Importação de dados" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ destino?: string }> }) {
  const { destino } = await searchParams;
  const s = await getSession();
  const supabase = await createClient();
  const [opts, { data: batches }] = await Promise.all([
    loadOptionSets(["supplier_categories", "supplier_capabilities"]),
    supabase.from("import_batches").select("id, target, file_name, sheet_name, stats, report, created_at, undone_at").order("created_at", { ascending: false }).limit(30),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Importação de dados" description="Traga suas planilhas de fornecedores, clientes e embalagens. Você confere tudo antes de gravar e pode desfazer depois." />
      <ImportWizard supplierCategories={opts.supplier_categories} capabilityOptions={opts.supplier_capabilities} initialTarget={destino as keyof typeof TARGETS | undefined} />

      <Card>
        <CardHeader title="Histórico de importações" description="Desfazer remove o que foi criado e restaura o que foi atualizado pela importação." />
        {(batches ?? []).length === 0 ? (
          <p className="px-5 pt-3 pb-5 text-[13.5px] text-ink-soft">Nenhuma importação ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-blush">
            {(batches ?? []).map((b) => {
              const st = (b.stats ?? {}) as Record<string, number>;
              const errors = ((b.report ?? []) as { row: number; status: string; message?: string }[]).filter((r) => r.status === "erro");
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Badge>{TARGETS[b.target as keyof typeof TARGETS]?.label ?? b.target}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">{b.file_name}{b.sheet_name && b.sheet_name !== b.file_name ? ` · aba ${b.sheet_name}` : ""}</span>
                    <span className="block text-[12px] text-ink-soft">
                      {formatDateTime(b.created_at, s.settings.timezone)} · {st.created ?? 0} criados · {st.updated ?? 0} atualizados · {st.skipped ?? 0} ignorados
                      {errors.length > 0 && <span className="text-danger"> · {errors.length} erros (linhas {errors.slice(0, 8).map((e) => e.row).join(", ")})</span>}
                    </span>
                  </span>
                  {b.undone_at ? (
                    <Badge tone="warning">Desfeita em {formatDateTime(b.undone_at, s.settings.timezone)}</Badge>
                  ) : (
                    <ConfirmAction
                      action={undoImport}
                      fields={{ id: b.id }}
                      label="Desfazer"
                      icon="Undo2"
                      variant="secondary"
                      title="Desfazer esta importação?"
                      description="Os registros criados por ela serão excluídos (junto com contatos e capacidades) e os campos alterados voltam ao valor anterior."
                      confirmLabel="Desfazer importação"
                      danger
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
