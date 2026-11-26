import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { QueryTabs } from "@/components/records/view-tabs";
import { SearchBox } from "@/components/records/search-box";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { ProjectCard } from "@/components/projects/project-card";
import { loadProjectCards } from "@/lib/data/project-cards";
import { PROJECT_STATUS, options } from "@/lib/domain";

export const metadata: Metadata = { title: "Projetos" };

type SP = Promise<{ ver?: string; q?: string; status?: string; categoria?: string; atrasados?: string; lancamento?: string; cliente?: string }>;

export default async function ProjectsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const s = await getSession();
  const supabase = await createClient();
  const [cards, { data: cats }, { data: clients }] = await Promise.all([
    loadProjectCards({
      tz: s.settings.timezone,
      archived: sp.ver === "arquivados",
      status: sp.status && sp.status in PROJECT_STATUS ? sp.status : undefined,
      category: sp.categoria,
      clientId: sp.cliente,
      q: sp.q,
      lateOnly: sp.atrasados === "1",
      launchWithinDays: sp.lancamento ? Number(sp.lancamento) || undefined : undefined,
    }),
    supabase.from("projects").select("category").is("deleted_at", null).not("category", "is", null),
    supabase.from("clients").select("id, name").is("deleted_at", null).order("name"),
  ]);
  const categories = [...new Set((cats ?? []).map((c) => c.category as string))].sort();
  const filtered = Boolean(sp.q || sp.status || sp.categoria || sp.atrasados || sp.lancamento || sp.cliente);

  return (
    <div>
      <PageHeader title="Projetos" description="Todos os desenvolvimentos, com progresso calculado pelo cronograma real." actions={<ButtonLink href="/projetos/novo" icon="Plus">Novo projeto</ButtonLink>} />
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <QueryTabs base="/projetos" param="ver" current={sp.ver ?? ""} tabs={[{ value: "", label: "Ativos" }, { value: "arquivados", label: "Arquivados", muted: true }]} />
          <SearchBox placeholder="Buscar por nome ou código" />
        </div>
        <FilterBar
          filters={[
            { name: "cliente", label: "Cliente", options: (clients ?? []).map((c) => ({ value: c.id, label: c.name })) },
            { name: "status", label: "Status", options: options(PROJECT_STATUS) },
            { name: "categoria", label: "Categoria", options: categories.map((c) => ({ value: c, label: c })) },
            { name: "atrasados", label: "Prazo", options: [{ value: "1", label: "somente atrasados" }] },
            { name: "lancamento", label: "Lançamento", options: [{ value: "30", label: "próximos 30 dias" }, { value: "90", label: "próximos 90 dias" }, { value: "180", label: "próximos 6 meses" }] },
          ]}
        />
      </div>
      {cards.length === 0 ? (
        <Card>
          <EmptyState
            icon="FolderKanban"
            title={filtered ? "Nenhum projeto corresponde aos filtros" : sp.ver ? "Nenhum projeto arquivado" : "Nenhum projeto ainda"}
            description={filtered ? "Ajuste ou limpe os filtros." : "Crie o primeiro projeto e acompanhe cada etapa do desenvolvimento."}
            action={!filtered && !sp.ver ? <ButtonLink href="/projetos/novo" icon="Plus">Novo projeto</ButtonLink> : undefined}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {cards.map((p) => (
            <li key={p.id}>
              <ProjectCard p={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
