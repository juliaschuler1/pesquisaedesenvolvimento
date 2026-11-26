import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { Avatar, ButtonLink, Card, DemoBadge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { QueryTabs } from "@/components/records/view-tabs";
import { SearchBox } from "@/components/records/search-box";
import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ ver?: string; q?: string }> }) {
  const { ver = "", q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id, name, brand_name, logo_path, segment, positioning, email, consulting_started_on, is_demo, archived_at, projects(id, status, deleted_at)")
    .is("deleted_at", null)
    .order("name");
  query = ver === "arquivados" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,brand_name.ilike.%${q.replace(/[%,()]/g, "")}%`);

  const [{ data: clients }, { count: archivedCount }] = await Promise.all([
    query,
    supabase.from("clients").select("id", { count: "exact", head: true }).is("deleted_at", null).not("archived_at", "is", null),
  ]);
  const urls = await signedUrls(supabase, (clients ?? []).map((c) => c.logo_path));

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Uma pasta digital por cliente, com projetos, contatos, reuniões e documentos."
        actions={<ButtonLink href="/clientes/novo" icon="Plus">Novo cliente</ButtonLink>}
      />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <QueryTabs
          base="/clientes"
          param="ver"
          current={ver}
          keep={{ q }}
          tabs={[
            { value: "", label: "Ativos" },
            { value: "arquivados", label: "Arquivados", count: archivedCount ?? 0, muted: true },
          ]}
        />
        <SearchBox placeholder="Buscar por nome ou marca" />
      </div>

      {(clients ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon="Users"
            title={q ? "Nenhum cliente encontrado" : ver ? "Nenhum cliente arquivado" : "Nenhum cliente ainda"}
            description={q ? `Nada corresponde a “${q}”.` : ver ? "Clientes arquivados aparecem aqui." : "Cadastre a primeira cliente para começar a organizar os projetos."}
            action={!q && !ver ? <ButtonLink href="/clientes/novo" icon="Plus">Cadastrar cliente</ButtonLink> : undefined}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(clients ?? []).map((c) => {
            const projects = ((c.projects ?? []) as { status: string; deleted_at: string | null }[]).filter((p) => !p.deleted_at);
            const active = projects.filter((p) => p.status === "active" || p.status === "planning").length;
            return (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="group block h-full">
                  <Card as="article" className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-[var(--shadow-lift)]">
                    <div className="flex items-start gap-4">
                      {c.logo_path && urls[c.logo_path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urls[c.logo_path]} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain ring-1 ring-blush" />
                      ) : (
                        <Avatar name={c.brand_name || c.name} size={56} className="rounded-2xl" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-serif text-[19px] leading-tight text-ink group-hover:text-deep">{c.brand_name || c.name}</h2>
                        {c.brand_name && <p className="truncate text-[12.5px] text-ink-soft">{c.name}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.segment && <span className="text-[12.5px] text-ink-soft">{c.segment}</span>}
                          {c.is_demo && <DemoBadge />}
                        </div>
                      </div>
                    </div>
                    {c.positioning && <p className="mt-4 line-clamp-2 text-[13.5px] text-ink/85">{c.positioning}</p>}
                    <div className="mt-auto flex items-center gap-4 pt-5 text-[12.5px] text-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="FolderKanban" size={14} />
                        <span className="tabular text-ink">{active}</span> em andamento · <span className="tabular">{projects.length}</span> no total
                      </span>
                      {c.consulting_started_on && <span className="ml-auto">desde {formatDate(c.consulting_started_on)}</span>}
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
