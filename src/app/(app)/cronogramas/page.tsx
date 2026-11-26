import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { loadDashboard } from "@/lib/data/dashboard";
import { Card, CardHeader, EmptyState, ButtonLink, PageHeader } from "@/components/ui/primitives";
import { Pipeline, PipelineLegend } from "@/components/dashboard/pipeline";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PRIORITY, PROJECT_STATUS, options } from "@/lib/domain";

export const metadata: Metadata = { title: "Cronogramas" };

export default async function SchedulesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await getSession();
  const d = await loadDashboard({ cliente: sp.cliente, categoria: sp.categoria, prioridade: sp.prioridade, status: sp.status }, s.settings.timezone);
  return (
    <div>
      <PageHeader title="Cronogramas" description="Todos os projetos em aberto, etapa por etapa. Clique em um projeto para editar o cronograma." />
      <div className="mb-4">
        <FilterBar
          filters={[
            { name: "cliente", label: "Cliente", options: d.clients.map((c) => ({ value: c.id, label: c.name })) },
            { name: "categoria", label: "Categoria", options: d.categories.map((c) => ({ value: c, label: c })) },
            { name: "status", label: "Status", options: options(PROJECT_STATUS) },
            { name: "prioridade", label: "Prioridade", options: options(PRIORITY) },
          ]}
        />
      </div>
      <Card>
        <CardHeader title="Cronograma consolidado" description="Gantt interativo, Kanban e calendário de etapas chegam na Fase 5." action={<PipelineLegend />} className="flex-col md:flex-row" />
        <div className="mt-3">
          {d.pipeline.length ? (
            <Pipeline rows={d.pipeline} />
          ) : (
            <EmptyState icon="GanttChart" title="Nenhum projeto em aberto" action={<ButtonLink href="/projetos/novo" size="sm">Novo projeto</ButtonLink>} />
          )}
        </div>
      </Card>
    </div>
  );
}
