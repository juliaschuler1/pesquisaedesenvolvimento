import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import { loadPackagingTypes } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { displayCustomValue } from "@/lib/custom-fields";
import { Badge, ButtonLink, Card, CardHeader, DemoBadge } from "@/components/ui/primitives";
import { ConfirmAction, QuickAction } from "@/components/ui/interactive";
import { LifecycleActions } from "@/components/records/lifecycle";
import { AttachmentsPanel } from "@/components/attachments/panel";
import { AuditTimeline } from "@/components/records/audit-timeline";
import { COMPONENTS } from "@/lib/packaging";
import { formatCurrency, formatNumber } from "@/lib/format";
import { duplicatePackaging, unlinkCompatible } from "../actions";
import { CompatForm } from "./compat-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Embalagem" };
  const supabase = await createClient();
  const { data } = await supabase.from("packaging_items").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Embalagem" };
}

export default async function PackagingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const s = await getSession();
  const supabase = await createClient();
  const { data: e } = await supabase.from("packaging_items").select("*, suppliers(id, name)").eq("id", id).maybeSingle();
  if (!e) notFound();
  const [urls, types, fields, { data: compat }, { data: others }] = await Promise.all([
    signedUrls(supabase, [e.photo_path]),
    loadPackagingTypes(),
    loadCustomFields("packaging_items"),
    supabase.from("packaging_compat").select("item_a, item_b, notes").or(`item_a.eq.${id},item_b.eq.${id}`),
    supabase.from("packaging_items").select("id, name, component").is("deleted_at", null).neq("id", id).order("name"),
  ]);
  const illustrative = types.find((t) => t.label === e.packaging_type)?.image ?? null;
  const photo = e.photo_path ? urls[e.photo_path] : null;
  const otherById = new Map((others ?? []).map((o) => [o.id, o]));
  const compatItems = (compat ?? []).map((c) => ({ ...c, other: otherById.get(c.item_a === id ? c.item_b : c.item_a) })).filter((c) => c.other);
  const supplier = e.suppliers as unknown as { id: string; name: string } | null;
  const num = (v: unknown) => (v === null || v === undefined ? null : formatNumber(Number(v), Number(v) % 1 ? 2 : 0));

  const spec: [string, string | null][] = [
    ["Componente", COMPONENTS[e.component]],
    ["Tipo", e.packaging_type],
    ["Código", e.code],
    ["Material", e.material],
    ["Capacidade nominal", e.capacity !== null ? `${num(e.capacity)} ${e.capacity_unit ?? ""}` : null],
    ["Volume de envase", e.fill_volume !== null ? `${num(e.fill_volume)} ${e.capacity_unit ?? ""}` : null],
    ["Dimensões", e.dimensions],
    ["Peso", e.weight],
    ["Acabamento", e.finish],
    ["Cor", e.color],
    ["Pantone", e.pantone],
    ["Fechamento", e.closure],
    ["Rosca", e.thread],
    ["Válvula / pump", e.valve],
    ["Aplicador", e.applicator],
    ["Retentor", e.retainer],
    ["Decoração", e.decoration],
    ["Personalização", e.customization],
    ...fields.map((f) => [f.label, displayCustomValue(f, (e.custom_data as Record<string, unknown>)?.[f.key])] as [string, string]),
  ];

  return (
    <div>
      <Link href="/embalagens" className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-deep">‹ Biblioteca de embalagens</Link>
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            <div className="relative aspect-square bg-white">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={e.name} className="h-full w-full object-contain p-6" />
              ) : illustrative ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={illustrative} alt="" className="h-full w-full object-contain p-10 opacity-50" />
                  <p className="absolute right-4 bottom-4 left-4 rounded-2xl bg-white/90 px-3 py-2 text-center text-[12.5px] text-ink-soft">
                    Imagem ilustrativa do tipo “{e.packaging_type}”. <Link href={`/embalagens/${id}/editar`} className="text-deep hover:underline">Enviar foto do modelo real</Link>
                  </p>
                </>
              ) : (
                <div className="grid h-full place-items-center text-pastel"><Package size={64} strokeWidth={1} /></div>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="Comercial" description="Uso interno" />
            <dl className="grid grid-cols-2 gap-4 p-5">
              <Info label="Fornecedor" value={supplier ? <Link href={`/fornecedores/${supplier.id}`} className="hover:text-deep">{supplier.name}</Link> : null} />
              <Info label="Custo unitário" value={e.unit_cost !== null ? formatCurrency(Number(e.unit_cost), e.currency) : null} />
              <Info label="MOQ" value={e.moq} />
              <Info label="Lead time" value={e.lead_time} />
            </dl>
            {e.internal_notes && <p className="border-t border-blush px-5 py-4 text-[13.5px] whitespace-pre-line text-ink">{e.internal_notes}</p>}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <div className="p-6">
              <p className="text-[13px] text-ink-soft">{[COMPONENTS[e.component], e.packaging_type].filter(Boolean).join(" · ")}</p>
              <h1 className="mt-1 font-serif text-[30px] leading-tight text-ink">{e.name}</h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.code && <Badge>{e.code}</Badge>}
                {e.is_demo && <DemoBadge />}
                {e.archived_at && <Badge tone="warning">Arquivada</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t border-blush px-4 py-2.5">
              <ButtonLink href={`/embalagens/${id}/editar`} variant="ghost" size="sm" icon="Pencil">Editar</ButtonLink>
              <QuickAction action={duplicatePackaging} fields={{ id }} label="Duplicar" icon="Copy" />
              <LifecycleActions entity="packaging_items" id={id} name={e.name} archivedAt={e.archived_at} deletedAt={e.deleted_at} noun="esta embalagem" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Ficha técnica" />
            <dl className="grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
              {spec.filter(([, v]) => v && v !== "—").map(([k, v]) => <Info key={k} label={k} value={v} />)}
              {e.notes && <Info label="Observações" value={e.notes} wide />}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Componentes compatíveis" description="Ex.: frasco ↔ tampa ↔ aplicador ↔ retentor" />
            <ul className="flex flex-col gap-1 px-3 pt-3">
              {compatItems.length === 0 && <li className="px-2 pb-2 text-[13px] text-ink-soft">Nenhum componente relacionado.</li>}
              {compatItems.map((c) => (
                <li key={c.other!.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
                  <Link href={`/embalagens/${c.other!.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-ink hover:text-deep">{c.other!.name}</span>
                    <span className="block text-[12px] text-ink-soft">{COMPONENTS[c.other!.component]}{c.notes ? ` · ${c.notes}` : ""}</span>
                  </Link>
                  <ConfirmAction action={unlinkCompatible} fields={{ a: c.item_a, b: c.item_b }} label="" icon="Trash2" title="Remover compatibilidade?" description="Os dois itens continuam na biblioteca." confirmLabel="Remover" danger className="!px-2" />
                </li>
              ))}
            </ul>
            <CompatForm itemId={id} others={(others ?? []).map((o) => ({ id: o.id, label: `${o.name} (${COMPONENTS[o.component]})` }))} />
          </Card>

          <AttachmentsPanel orgId={s.orgId} entityType="packaging_items" entityId={id} back={`/embalagens/${id}`} tz={s.settings.timezone} title="Desenho técnico, catálogo, mockups e fotos" />
          <AuditTimeline filter={{ entity: { type: "packaging_items", id } }} tz={s.settings.timezone} limit={30} />
          <p className="text-[12.5px] text-ink-soft">O histórico de projetos que usaram esta embalagem aparece quando ela for selecionada em briefings (Fase 4).</p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[12.5px] text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-[14px] whitespace-pre-line text-ink">{value || <span className="text-ink-soft/60">—</span>}</dd>
    </div>
  );
}
