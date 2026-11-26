import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { Badge, ButtonLink, Card, DemoBadge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { QueryTabs } from "@/components/records/view-tabs";
import { SearchBox } from "@/components/records/search-box";
import { KNOWLEDGE_LIBRARIES, type LibraryKey } from "@/lib/libraries";
import { formatDate } from "@/lib/format";
import { isUuid } from "@/lib/forms";
import { LibraryItemButton } from "./item-form";

export async function KnowledgePage({ lib, sp }: { lib: LibraryKey; sp: { ver?: string; q?: string; categoria?: string; item?: string } }) {
  if (sp.item && isUuid(sp.item)) redirect(`/biblioteca/${sp.item}`);
  const cfg = KNOWLEDGE_LIBRARIES[lib];
  const supabase = await createClient();
  const [opts, fields, { data: suppliers }] = await Promise.all([
    loadOptionSets([cfg.categorySet]),
    loadCustomFields(`library:${lib}`),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
  ]);
  let q = supabase.from("library_items").select("id, name, category, description, tags, source_name, reviewed_on, image_path, is_demo, suppliers(name)").eq("library", lib).is("deleted_at", null).order("name").limit(1000);
  q = sp.ver === "arquivados" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (sp.categoria) q = q.eq("category", sp.categoria);
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, "");
    q = q.or(`name.ilike.%${t}%,description.ilike.%${t}%`);
  }
  const { data } = await q;
  const rows = data ?? [];
  const urls = await signedUrls(supabase, rows.map((r) => r.image_path));
  const formProps = { library: lib, singular: cfg.singular, categoryLabel: cfg.categoryLabel, categorySet: cfg.categorySet, categories: opts[cfg.categorySet], nameHint: cfg.nameHint, suppliers: suppliers ?? [], fields };

  return (
    <div>
      <PageHeader
        title={cfg.title}
        description={cfg.description}
        actions={
          <>
            <ButtonLink href={`/construtor-modulos?entidade=${encodeURIComponent(`library:${lib}`)}`} variant="secondary" icon="Settings">Campos</ButtonLink>
            <LibraryItemButton {...formProps} label="Adicionar" />
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <QueryTabs base={`/${lib}`} param="ver" current={sp.ver ?? ""} tabs={[{ value: "", label: "Ativos" }, { value: "arquivados", label: "Arquivados", muted: true }]} />
          <FilterBar filters={[{ name: "categoria", label: cfg.categoryLabel, options: opts[cfg.categorySet].map((c) => ({ value: c, label: c })) }]} />
        </div>
        <SearchBox placeholder="Buscar por nome ou descrição" />
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={cfg.icon} title="Nada cadastrado ainda" description={`Cada ${cfg.singular} fica disponível para reutilizar em projetos e briefings.`} action={<LibraryItemButton {...formProps} label="Adicionar" />} />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/biblioteca/${r.id}`} className="group block h-full">
                <Card as="article" className="flex h-full gap-4 p-5 transition-shadow group-hover:shadow-[var(--shadow-lift)]">
                  {r.image_path && urls[r.image_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urls[r.image_path]} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-blush" />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-blush text-deep"><Icon name={cfg.icon} size={22} /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-medium text-ink group-hover:text-deep">{r.name}</h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
                      {r.category && <Badge tone="rose">{r.category}</Badge>}
                      {(r.suppliers as unknown as { name: string } | null)?.name}
                      {r.is_demo && <DemoBadge />}
                    </p>
                    {r.description && <p className="mt-2 line-clamp-2 text-[13px] text-ink/85">{r.description}</p>}
                    <p className="mt-2 text-[11.5px] text-ink-soft">{[r.source_name, r.reviewed_on && `atualizado em ${formatDate(r.reviewed_on)}`].filter(Boolean).join(" · ")}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
