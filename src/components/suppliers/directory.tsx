import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { loadOptionSets } from "@/lib/data/options";
import { Avatar, Badge, ButtonLink, Card, DemoBadge, EmptyState, PageHeader, cx } from "@/components/ui/primitives";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { QueryTabs } from "@/components/records/view-tabs";
import { SearchBox } from "@/components/records/search-box";
import { QUALITY_LABEL } from "@/lib/import/targets";
import { MailingExport } from "./mailing-export";

export const MANUFACTURER_CATEGORIES = ["Fabricantes terceiristas", "Fabricantes full service", "Empresas de envase"];

type SP = { ver?: string; q?: string; categoria?: string; capacidade?: string; qualidade?: string; pais?: string; vista?: string };

export async function SupplierDirectory({ sp, base, title, description, manufacturersOnly }: { sp: SP; base: string; title: string; description: string; manufacturersOnly?: boolean }) {
  const supabase = await createClient();
  const opts = await loadOptionSets(["supplier_categories", "supplier_capabilities"]);

  let capIds: string[] | null = null;
  if (sp.capacidade) {
    const { data } = await supabase.from("supplier_capabilities").select("supplier_id").eq("capability", sp.capacidade).eq("status", "apto");
    capIds = (data ?? []).map((d) => d.supplier_id);
  }

  let q = supabase
    .from("suppliers")
    .select("id, name, legal_name, logo_path, categories, city, state, country, email, phone, whatsapp, website, quality_status, quality_evaluated_year, rating_quality, moq, lead_time, is_demo, archived_at, supplier_capabilities(capability, status), supplier_contacts(name, role, email, phone, is_primary)")
    .is("deleted_at", null)
    .order("name")
    .limit(1000);
  q = sp.ver === "arquivados" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (manufacturersOnly) q = q.overlaps("categories", MANUFACTURER_CATEGORIES);
  if (sp.categoria) q = q.contains("categories", [sp.categoria]);
  if (sp.qualidade && sp.qualidade in QUALITY_LABEL) q = q.eq("quality_status", sp.qualidade);
  if (sp.pais) q = q.eq("country", sp.pais);
  if (capIds) q = q.in("id", capIds.length ? capIds : ["00000000-0000-0000-0000-000000000000"]);
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, "");
    q = q.or(`name.ilike.%${t}%,legal_name.ilike.%${t}%,cnpj.ilike.%${t}%,city.ilike.%${t}%`);
  }
  const [{ data }, { data: countries }] = await Promise.all([q, supabase.from("suppliers").select("country").is("deleted_at", null).not("country", "is", null)]);
  const rows = data ?? [];
  const urls = await signedUrls(supabase, rows.map((r) => r.logo_path));
  const filtered = Boolean(sp.q || sp.categoria || sp.capacidade || sp.qualidade || sp.pais);
  const table = sp.vista === "tabela";

  const mailing = rows.map((r) => {
    const c = ((r.supplier_contacts ?? []) as { name: string; role: string | null; email: string | null; phone: string | null; is_primary: boolean }[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
    return {
      Fornecedor: r.name,
      "Razão social": r.legal_name ?? "",
      Categorias: (r.categories as string[]).join(", "),
      "E-mail": r.email ?? "",
      Telefone: r.phone ?? "",
      WhatsApp: r.whatsapp ?? "",
      Site: r.website ?? "",
      Cidade: r.city ?? "",
      UF: r.state ?? "",
      País: r.country ?? "",
      Contato: c?.name ?? "",
      Cargo: c?.role ?? "",
      "E-mail do contato": c?.email ?? "",
      "Telefone do contato": c?.phone ?? "",
      "Apto a": ((r.supplier_capabilities ?? []) as { capability: string; status: string }[]).filter((x) => x.status === "apto").map((x) => x.capability).join(", "),
    };
  });

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <ButtonLink href="/importacao?destino=suppliers" variant="secondary" icon="FileSpreadsheet">Importar planilha</ButtonLink>
            <MailingExport rows={mailing} />
            <ButtonLink href={manufacturersOnly ? "/fornecedores/novo?categoria=Fabricantes%20terceiristas" : "/fornecedores/novo"} icon="Plus">{manufacturersOnly ? "Novo terceirista" : "Novo fornecedor"}</ButtonLink>
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <QueryTabs
            base={base}
            param="ver"
            current={sp.ver ?? ""}
            keep={{ vista: sp.vista }}
            tabs={[{ value: "", label: "Ativos" }, { value: "arquivados", label: "Arquivados", muted: true }]}
          />
          <div className="flex items-center gap-2">
            <QueryTabs base={base} param="vista" current={sp.vista ?? ""} keep={{ ver: sp.ver, categoria: sp.categoria, capacidade: sp.capacidade, qualidade: sp.qualidade, q: sp.q }} tabs={[{ value: "", label: "Cards" }, { value: "tabela", label: "Tabela" }]} />
            <SearchBox placeholder="Nome, CNPJ ou cidade" />
          </div>
        </div>
        <FilterBar
          filters={[
            ...(manufacturersOnly ? [] : [{ name: "categoria", label: "Categoria", options: opts.supplier_categories.map((c) => ({ value: c, label: c })) }]),
            { name: "capacidade", label: "Apto a", options: opts.supplier_capabilities.map((c) => ({ value: c, label: c })) },
            { name: "qualidade", label: "Qualidade", options: Object.entries(QUALITY_LABEL).map(([value, x]) => ({ value, label: x.label })) },
            { name: "pais", label: "País", options: [...new Set((countries ?? []).map((c) => c.country as string))].sort().map((c) => ({ value: c, label: c })) },
          ]}
        />
      </div>
      <p className="mb-3 text-[13px] text-ink-soft">{rows.length} {rows.length === 1 ? "fornecedor" : "fornecedores"}</p>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon="Contact"
            title={filtered ? "Nenhum fornecedor corresponde aos filtros" : "Nenhum fornecedor ainda"}
            description={filtered ? "Ajuste ou limpe os filtros." : "Cadastre um por um ou importe a sua planilha de fornecedores."}
            action={!filtered ? <div className="flex flex-wrap justify-center gap-2"><ButtonLink href="/importacao?destino=suppliers" icon="FileSpreadsheet">Importar planilha</ButtonLink><ButtonLink href="/fornecedores/novo" variant="secondary">Cadastrar manualmente</ButtonLink></div> : undefined}
          />
        </Card>
      ) : table ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-blush bg-[#fffafc] text-[12px] text-ink-soft">
                <th className="px-5 py-2.5 font-medium">Fornecedor</th>
                <th className="px-3 py-2.5 font-medium">Categorias</th>
                <th className="px-3 py-2.5 font-medium">Apto a</th>
                <th className="px-3 py-2.5 font-medium">Local</th>
                <th className="px-3 py-2.5 font-medium">Contato</th>
                <th className="px-3 py-2.5 font-medium">Qualidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush">
              {rows.map((r, i) => {
                const caps = ((r.supplier_capabilities ?? []) as { capability: string; status: string }[]).filter((c) => c.status === "apto");
                return (
                  <tr key={r.id}>
                    <td className="px-5 py-3"><Link href={`/fornecedores/${r.id}`} className="text-ink hover:text-deep">{r.name}</Link> {r.is_demo && <DemoBadge />}</td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-soft">{(r.categories as string[]).join(", ") || "—"}</td>
                    <td className="max-w-[280px] px-3 py-3 text-[12.5px] text-ink-soft">{caps.map((c) => c.capability).join(", ") || "—"}</td>
                    <td className="px-3 py-3 text-ink-soft">{[r.city, r.state, r.country !== "Brasil" ? r.country : null].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-3 text-[12.5px] text-ink-soft">{mailing[i].Contato || r.email || "—"}</td>
                    <td className="px-3 py-3">{r.quality_status ? <Badge tone={QUALITY_LABEL[r.quality_status].tone}>{QUALITY_LABEL[r.quality_status].label}</Badge> : <span className="text-ink-soft">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const caps = ((r.supplier_capabilities ?? []) as { capability: string; status: string }[]).filter((c) => c.status === "apto");
            return (
              <li key={r.id}>
                <Link href={`/fornecedores/${r.id}`} className="group block h-full">
                  <Card as="article" className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-[var(--shadow-lift)]">
                    <div className="flex items-start gap-4">
                      {r.logo_path && urls[r.logo_path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urls[r.logo_path]} alt="" className="h-12 w-12 shrink-0 rounded-2xl bg-white object-contain ring-1 ring-blush" />
                      ) : (
                        <Avatar name={r.name} size={48} className="rounded-2xl" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-serif text-[18px] leading-tight text-ink group-hover:text-deep">{r.name}</h2>
                        <p className="truncate text-[12.5px] text-ink-soft">{(r.categories as string[]).join(" · ") || "Sem categoria"}</p>
                      </div>
                      {r.is_demo && <DemoBadge />}
                    </div>
                    {caps.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Apto a">
                        {caps.slice(0, 6).map((c) => <li key={c.capability} className="rounded-full bg-blush px-2.5 py-0.5 text-[11.5px] text-deep">{c.capability}</li>)}
                        {caps.length > 6 && <li className="px-1 text-[11.5px] text-ink-soft">+{caps.length - 6}</li>}
                      </ul>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 text-[12.5px] text-ink-soft">
                      {r.quality_status && <Badge tone={QUALITY_LABEL[r.quality_status].tone}>{QUALITY_LABEL[r.quality_status].label}{r.quality_evaluated_year ? ` · ${r.quality_evaluated_year}` : ""}</Badge>}
                      <span className={cx(!r.city && !r.country && "hidden")}>{[r.city, r.state].filter(Boolean).join("/")}{r.country && r.country !== "Brasil" ? ` · ${r.country}` : ""}</span>
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
