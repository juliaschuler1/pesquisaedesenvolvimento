import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { SearchBox } from "@/components/records/search-box";
import { SKU_STATUS, effectiveSku, options, type SkuRow, type SkuShared } from "@/lib/domain";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "SKUs" };

export default async function SkusPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from("skus")
    .select("*, projects!inner(id, name, code, sku_shared, deleted_at, archived_at, clients(name))")
    .is("deleted_at", null)
    .is("archived_at", null)
    .is("projects.deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (sp.status && sp.status in SKU_STATUS) q = q.eq("status", sp.status);
  else q = q.not("status", "in", "(launched,cancelled)");
  if (sp.q) {
    const t = sp.q.replace(/[%,()]/g, "");
    q = q.or(`name.ilike.%${t}%,code.ilike.%${t}%,gtin.ilike.%${t}%`);
  }
  const { data } = await q;
  const rows = (data ?? []) as (SkuRow & { projects: { id: string; name: string; code: string | null; sku_shared: SkuShared; clients: { name: string } | null } })[];

  return (
    <div>
      <PageHeader title="SKUs" description="Todas as variações em desenvolvimento, de todos os projetos. Para cadastrar, abra o projeto." />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterBar filters={[{ name: "status", label: "Status", options: options(SKU_STATUS) }]} />
        <SearchBox placeholder="Nome, código ou GTIN" />
      </div>
      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState icon="Boxes" title="Nenhum SKU encontrado" description="SKUs são cadastrados dentro de cada projeto, na aba SKUs." />
        ) : (
          <table className="w-full min-w-[820px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-blush bg-[#fffafc] text-[12px] text-ink-soft">
                <th className="px-5 py-2.5 font-medium">SKU</th>
                <th className="px-3 py-2.5 font-medium">Projeto</th>
                <th className="px-3 py-2.5 font-medium">Cor</th>
                <th className="px-3 py-2.5 font-medium">Volume</th>
                <th className="px-3 py-2.5 font-medium">Qtd. prevista</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush">
              {rows.map((sk) => {
                const vol = effectiveSku(sk, sk.projects.sku_shared, "volume");
                const unit = sk.volume !== null ? sk.volume_unit : sk.projects.sku_shared?.volume_unit;
                return (
                  <tr key={sk.id}>
                    <td className="px-5 py-3">
                      <Link href={`/projetos/${sk.projects.id}?aba=skus`} className="text-ink hover:text-deep">{sk.name}</Link>
                      <p className="text-[12px] text-ink-soft">{sk.code ?? "sem código"}{sk.gtin && ` · ${sk.gtin}`}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/projetos/${sk.projects.id}`} className="text-ink hover:text-deep">{sk.projects.name}</Link>
                      <p className="text-[12px] text-ink-soft">{sk.projects.clients?.name}</p>
                    </td>
                    <td className="px-3 py-3 text-ink">{[sk.color, sk.pantone && `Pantone ${sk.pantone}`].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-3 text-ink tabular">{vol.value !== null ? `${formatNumber(Number(vol.value), Number(vol.value) % 1 ? 2 : 0)} ${unit ?? ""}` : "—"}</td>
                    <td className="px-3 py-3 text-ink tabular">{sk.planned_quantity !== null ? formatNumber(sk.planned_quantity) : "—"}</td>
                    <td className="px-3 py-3"><Badge tone={SKU_STATUS[sk.status].tone}>{SKU_STATUS[sk.status].label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
