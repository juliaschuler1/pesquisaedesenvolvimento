import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { loadOptionSets, loadPackagingTypes } from "@/lib/data/options";
import { Badge, ButtonLink, Card, DemoBadge, EmptyState, PageHeader, cx } from "@/components/ui/primitives";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { QueryTabs } from "@/components/records/view-tabs";
import { SearchBox } from "@/components/records/search-box";
import { COMPONENTS, LIBRARIES } from "@/lib/packaging";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Package } from "lucide-react";

type SP = { ver?: string; q?: string; tipo?: string; componente?: string; material?: string; fornecedor?: string; acabamento?: string; vista?: string };

export async function PackagingLibrary({ lib, sp }: { lib: keyof typeof LIBRARIES; sp: SP }) {
  const cfg = LIBRARIES[lib];
  const base = `/${lib}`;
  const supabase = await createClient();
  const [types, opts, { data: suppliers }] = await Promise.all([
    loadPackagingTypes(),
    loadOptionSets(["packaging_materials", "packaging_finishes"]),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
  ]);
  const typeImage = Object.fromEntries(types.map((t) => [t.label, t.image]));

  let q = supabase
    .from("packaging_items")
    .select("id, name, code, component, packaging_type, material, capacity, capacity_unit, finish, color, unit_cost, currency, moq, lead_time, photo_path, is_demo, archived_at, suppliers(id, name)")
    .is("deleted_at", null)
    .order("name")
    .limit(1000);
  q = sp.ver === "arquivados" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (cfg.components) q = q.in("component", cfg.components as unknown as string[]);
  if (sp.componente && sp.componente in COMPONENTS) q = q.eq("component", sp.componente);
  if (sp.tipo) q = q.eq("packaging_type", sp.tipo);
  if (sp.material) q = q.eq("material", sp.material);
  if (sp.acabamento) q = q.eq("finish", sp.acabamento);
  if (sp.fornecedor) q = q.eq("supplier_id", sp.fornecedor);
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, "");
    q = q.or(`name.ilike.%${t}%,code.ilike.%${t}%,color.ilike.%${t}%`);
  }
  const { data } = await q;
  const rows = data ?? [];
  const urls = await signedUrls(supabase, rows.map((r) => r.photo_path));
  const view = sp.vista ?? "";
  const filtered = Boolean(sp.q || sp.tipo || sp.componente || sp.material || sp.fornecedor || sp.acabamento);
  const keep = { ver: sp.ver, vista: sp.vista, q: sp.q, componente: sp.componente, material: sp.material, fornecedor: sp.fornecedor, acabamento: sp.acabamento };

  const img = (r: (typeof rows)[number]) =>
    r.photo_path && urls[r.photo_path] ? { src: urls[r.photo_path], illustrative: false } : r.packaging_type && typeImage[r.packaging_type] ? { src: typeImage[r.packaging_type]!, illustrative: true } : null;

  return (
    <div>
      <PageHeader
        title={cfg.title}
        description={cfg.description}
        actions={
          <>
            <ButtonLink href="/importacao?destino=packaging_items" variant="secondary" icon="FileSpreadsheet">Importar</ButtonLink>
            <ButtonLink href={`/embalagens/novo${cfg.components ? `?componente=${cfg.components[0]}` : ""}`} icon="Plus">{lib === "aplicadores" ? "Novo aplicador" : lib === "componentes" ? "Novo componente" : "Nova embalagem"}</ButtonLink>
          </>
        }
      />

      {lib === "embalagens" && (
        <nav aria-label="Tipos de embalagem" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-2">
          {types.filter((t) => t.image).map((t) => {
            const on = sp.tipo === t.label;
            const qs = new URLSearchParams(Object.entries(keep).filter(([, v]) => v) as [string, string][]);
            if (!on) qs.set("tipo", t.label);
            return (
              <Link key={t.label} href={`${base}${qs.toString() ? `?${qs}` : ""}`} scroll={false} aria-current={on ? "true" : undefined} className={cx("flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 text-center ring-1 transition-colors", on ? "bg-blush ring-2 ring-deep" : "bg-white ring-blush hover:ring-mid")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image!} alt="" className="aspect-square w-full rounded-xl object-contain" />
                <span className="line-clamp-2 text-[11px] leading-tight text-ink">{t.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <QueryTabs base={base} param="ver" current={sp.ver ?? ""} keep={{ vista: sp.vista }} tabs={[{ value: "", label: "Ativos" }, { value: "arquivados", label: "Arquivados", muted: true }]} />
          <div className="flex items-center gap-2">
            <QueryTabs base={base} param="vista" current={view} keep={{ ...keep, vista: undefined, tipo: sp.tipo }} tabs={[{ value: "", label: "Galeria" }, { value: "cards", label: "Cards" }, { value: "tabela", label: "Tabela" }]} />
            <SearchBox placeholder="Nome, código ou cor" />
          </div>
        </div>
        <FilterBar
          filters={[
            ...(cfg.components ? [{ name: "componente", label: "Componente", options: cfg.components.map((c) => ({ value: c, label: COMPONENTS[c] })) }] : [{ name: "componente", label: "Componente", options: Object.entries(COMPONENTS).map(([value, label]) => ({ value, label })) }]),
            ...(lib === "embalagens" ? [] : [{ name: "tipo", label: "Tipo", options: types.map((t) => ({ value: t.label, label: t.label })) }]),
            { name: "material", label: "Material", options: opts.packaging_materials.map((m) => ({ value: m, label: m })) },
            { name: "acabamento", label: "Acabamento", options: opts.packaging_finishes.map((m) => ({ value: m, label: m })) },
            { name: "fornecedor", label: "Fornecedor", options: (suppliers ?? []).map((x) => ({ value: x.id, label: x.name })) },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="Package"
            title={filtered ? "Nenhum item corresponde aos filtros" : "Biblioteca vazia"}
            description={filtered ? "Ajuste ou limpe os filtros." : "Cadastre embalagens com foto, ficha técnica e fornecedor, ou importe uma planilha."}
            action={!filtered ? <ButtonLink href="/embalagens/novo" icon="Plus">Nova embalagem</ButtonLink> : undefined}
          />
        </Card>
      ) : view === "tabela" ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-blush bg-[#fffafc] text-[12px] text-ink-soft">
                <th className="px-5 py-2.5 font-medium">Embalagem</th>
                <th className="px-3 py-2.5 font-medium">Componente / tipo</th>
                <th className="px-3 py-2.5 font-medium">Material</th>
                <th className="px-3 py-2.5 font-medium">Capacidade</th>
                <th className="px-3 py-2.5 font-medium">Fornecedor</th>
                <th className="px-3 py-2.5 font-medium">MOQ · lead time</th>
                <th className="px-3 py-2.5 text-right font-medium">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3"><Link href={`/embalagens/${r.id}`} className="text-ink hover:text-deep">{r.name}</Link><p className="text-[12px] text-ink-soft">{r.code ?? "sem código"}</p></td>
                  <td className="px-3 py-3 text-ink-soft">{COMPONENTS[r.component]}{r.packaging_type ? ` · ${r.packaging_type}` : ""}</td>
                  <td className="px-3 py-3 text-ink">{r.material ?? "—"}</td>
                  <td className="px-3 py-3 text-ink tabular">{r.capacity !== null ? `${formatNumber(Number(r.capacity), Number(r.capacity) % 1 ? 2 : 0)} ${r.capacity_unit ?? ""}` : "—"}</td>
                  <td className="px-3 py-3 text-ink-soft">{(r.suppliers as unknown as { name: string } | null)?.name ?? "—"}</td>
                  <td className="px-3 py-3 text-[12.5px] text-ink-soft">{[r.moq, r.lead_time].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-3 text-right text-ink tabular">{r.unit_cost !== null ? formatCurrency(Number(r.unit_cost), r.currency) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <ul className={cx("grid gap-4", view === "cards" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5")}>
          {rows.map((r) => {
            const im = img(r);
            const sup = (r.suppliers as unknown as { name: string } | null)?.name;
            return (
              <li key={r.id}>
                <Link href={`/embalagens/${r.id}`} className="group block h-full">
                  <Card as="article" className={cx("h-full overflow-hidden transition-shadow group-hover:shadow-[var(--shadow-lift)]", view === "cards" && "flex")}>
                    <div className={cx("relative bg-white", view === "cards" ? "w-32 shrink-0" : "aspect-square")}>
                      {im ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={im.src} alt="" className={cx("h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.03]", im.illustrative && "opacity-55")} />
                      ) : (
                        <span className="grid h-full w-full place-items-center bg-[#fffafc] text-pastel"><Package size={36} strokeWidth={1.2} /></span>
                      )}
                      {im?.illustrative && <span className="absolute right-2 bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-center text-[10.5px] text-ink-soft">imagem ilustrativa do tipo</span>}
                      {r.is_demo && <span className="absolute top-2 left-2"><DemoBadge /></span>}
                    </div>
                    <div className="p-4">
                      <p className="text-[11.5px] text-ink-soft">{[COMPONENTS[r.component], r.packaging_type].filter(Boolean).join(" · ")}</p>
                      <h3 className="mt-0.5 line-clamp-2 text-[14px] font-medium text-ink group-hover:text-deep">{r.name}</h3>
                      <p className="mt-1 text-[12.5px] text-ink-soft">{[r.material, r.capacity !== null && `${formatNumber(Number(r.capacity), Number(r.capacity) % 1 ? 2 : 0)} ${r.capacity_unit ?? ""}`, r.finish].filter(Boolean).join(" · ")}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-soft">
                        {sup && <span className="truncate">{sup}</span>}
                        {r.unit_cost !== null && <Badge tone="neutral">{formatCurrency(Number(r.unit_cost), r.currency)}</Badge>}
                      </div>
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
