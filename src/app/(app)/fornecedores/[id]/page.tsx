import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { displayCustomValue } from "@/lib/custom-fields";
import { Avatar, Badge, ButtonLink, Card, CardHeader, DemoBadge, EmptyState } from "@/components/ui/primitives";
import { ConfirmAction, QuickAction } from "@/components/ui/interactive";
import { Icon } from "@/components/ui/icon";
import { QueryTabs } from "@/components/records/view-tabs";
import { LifecycleActions } from "@/components/records/lifecycle";
import { AttachmentsPanel } from "@/components/attachments/panel";
import { AuditTimeline } from "@/components/records/audit-timeline";
import { QUALITY_LABEL } from "@/lib/import/targets";
import { formatCurrency } from "@/lib/format";
import { duplicateSupplier, unlinkSupplierFromProject } from "../actions";
import { CapabilityMatrix, LinkProjectForm, SupplierContacts } from "./panels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Fornecedor" };
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Fornecedor" };
}

const TABS = [
  { value: "", label: "Visão geral" },
  { value: "aptidao", label: "Aptidão" },
  { value: "contatos", label: "Contatos" },
  { value: "projetos", label: "Projetos" },
  { value: "embalagens", label: "Embalagens" },
  { value: "documentos", label: "Catálogos e documentos" },
  { value: "historico", label: "Histórico" },
];

function Stars({ n }: { n: number | null }) {
  if (!n) return <span className="text-ink-soft">—</span>;
  return <span className="tracking-[2px] text-deep" aria-label={`${n} de 5`}>{"★".repeat(n)}<span className="text-pastel">{"★".repeat(5 - n)}</span></span>;
}

export default async function SupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const { aba = "" } = await searchParams;
  if (!isUuid(id)) notFound();
  const s = await getSession();
  const supabase = await createClient();
  const { data: f } = await supabase.from("suppliers").select("*, supplier_contacts(*), supplier_capabilities(capability, status)").eq("id", id).maybeSingle();
  if (!f) notFound();
  const urls = await signedUrls(supabase, [f.logo_path]);
  const caps = (f.supplier_capabilities ?? []) as { capability: string; status: "apto" | "em_avaliacao" | "suspenso" | "na" }[];
  const apt = caps.filter((c) => c.status === "apto");

  return (
    <div>
      <Link href="/fornecedores" className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-deep">‹ Fornecedores</Link>
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center">
          {f.logo_path && urls[f.logo_path] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[f.logo_path]} alt="" className="h-20 w-20 rounded-3xl bg-white object-contain p-2 ring-1 ring-blush" />
          ) : (
            <Avatar name={f.name} size={80} className="rounded-3xl" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[30px] leading-tight text-ink">{f.name}</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-soft">{[f.legal_name, f.cnpj && `CNPJ ${f.cnpj}`, [f.city, f.state].filter(Boolean).join("/"), f.country].filter(Boolean).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(f.categories as string[]).map((c) => <Badge key={c} tone="rose">{c}</Badge>)}
              {f.quality_status && <Badge tone={QUALITY_LABEL[f.quality_status].tone}>Qualidade: {QUALITY_LABEL[f.quality_status].label}{f.quality_evaluated_year ? ` (${f.quality_evaluated_year})` : ""}</Badge>}
              {f.is_demo && <DemoBadge />}
              {f.archived_at && <Badge tone="warning">Arquivado</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t border-blush px-4 py-2.5">
          <ButtonLink href={`/fornecedores/${id}/editar`} variant="ghost" size="sm" icon="Pencil">Editar</ButtonLink>
          <QuickAction action={duplicateSupplier} fields={{ id }} label="Duplicar" icon="Copy" />
          <LifecycleActions entity="suppliers" id={id} name={f.name} archivedAt={f.archived_at} deletedAt={f.deleted_at} noun="este fornecedor" />
        </div>
      </Card>

      <div className="mb-6"><QueryTabs base={`/fornecedores/${id}`} param="aba" current={aba} tabs={TABS} /></div>

      {aba === "" && <Overview f={f} apt={apt} />}
      {aba === "aptidao" && <CapabilityMatrix supplierId={id} all={(await loadOptionSets(["supplier_capabilities"])).supplier_capabilities} current={Object.fromEntries(caps.map((c) => [c.capability, c.status]))} />}
      {aba === "contatos" && <SupplierContacts supplierId={id} contacts={f.supplier_contacts ?? []} />}
      {aba === "projetos" && <SupplierProjects supplierId={id} />}
      {aba === "embalagens" && <SupplierPackaging supplierId={id} />}
      {aba === "documentos" && <AttachmentsPanel orgId={s.orgId} entityType="suppliers" entityId={id} back={`/fornecedores/${id}`} tz={s.settings.timezone} title="Catálogos, propostas e documentos" />}
      {aba === "historico" && <AuditTimeline filter={{ entity: { type: "suppliers", id } }} tz={s.settings.timezone} />}
    </div>
  );
}

async function Overview({ f, apt }: { f: Record<string, unknown>; apt: { capability: string }[] }) {
  const fields = await loadCustomFields("suppliers");
  const g = (k: string) => (f[k] as string | null) ?? null;
  const list = (k: string) => ((f[k] as string[]) ?? []).join(", ");
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Especialidades" />
          <div className="p-5">
            {apt.length ? (
              <ul className="flex flex-wrap gap-1.5">{apt.map((c) => <li key={c.capability} className="rounded-full bg-blush px-3 py-1 text-[12.5px] text-deep">{c.capability}</li>)}</ul>
            ) : (
              <p className="text-[13px] text-ink-soft">Nenhuma aptidão informada.</p>
            )}
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Info label="Categorias de produto" value={list("product_categories")} />
              <Info label="Certificações" value={list("certifications")} />
              <Info label="Tecnologias" value={g("technologies")} wide />
              <Info label="Pontos fortes" value={g("strengths")} />
              <Info label="Diferenciais" value={g("differentials")} />
              <Info label="Observações" value={g("notes")} wide />
              {fields.map((cf) => <Info key={cf.id} label={cf.label} value={displayCustomValue(cf, (f.custom_data as Record<string, unknown>)?.[cf.key])} />)}
            </dl>
          </div>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Contato" />
          <ul className="flex flex-col gap-2.5 p-5 text-[14px]">
            {g("email") && <li className="flex items-center gap-2"><Icon name="Mail" size={15} className="text-deep" /><a className="hover:text-deep" href={`mailto:${g("email")}`}>{g("email")}</a></li>}
            {g("phone") && <li className="flex items-center gap-2"><Icon name="Phone" size={15} className="text-deep" />{g("phone")}</li>}
            {g("whatsapp") && <li className="flex items-center gap-2"><Icon name="MessageCircle" size={15} className="text-deep" /><a className="hover:text-deep" href={`https://wa.me/${String(g("whatsapp")).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{g("whatsapp")}</a></li>}
            {g("website") && <li className="flex items-center gap-2"><Icon name="Globe" size={15} className="text-deep" /><a className="truncate hover:text-deep" href={g("website")!} target="_blank" rel="noreferrer">{g("website")}</a></li>}
            {g("address") && <li className="flex items-center gap-2"><Icon name="MapPin" size={15} className="text-deep" />{g("address")}</li>}
            {!g("email") && !g("phone") && !g("whatsapp") && !g("website") && <li className="text-ink-soft">Sem contato geral. Veja a aba Contatos.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Condições comerciais" description="Uso interno" />
          <dl className="grid grid-cols-2 gap-4 p-5">
            <Info label="MOQ" value={g("moq")} />
            <Info label="Lead time" value={g("lead_time")} />
            <Info label="Faixa de preço" value={g("price_range")} />
            <Info label="Moeda" value={g("currency")} />
            <Info label="Modelo de operação" value={g("operation_model")} wide />
            <Info label="Condições" value={g("commercial_terms")} wide />
          </dl>
        </Card>
        <Card className="bg-[#fffafc]">
          <CardHeader title="Avaliação interna" description="Nunca exibida a clientes ou fornecedores." />
          <dl className="grid grid-cols-3 gap-3 p-5 text-[13px]">
            <div><dt className="text-ink-soft">Qualidade</dt><dd><Stars n={f.rating_quality as number | null} /></dd></div>
            <div><dt className="text-ink-soft">Atendimento</dt><dd><Stars n={f.rating_service as number | null} /></dd></div>
            <div><dt className="text-ink-soft">Prazo</dt><dd><Stars n={f.rating_deadline as number | null} /></dd></div>
          </dl>
          {g("internal_notes") && <p className="px-5 pb-5 text-[13.5px] whitespace-pre-line text-ink">{g("internal_notes")}</p>}
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 col-span-2" : undefined}>
      <dt className="text-[12.5px] text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-[14px] whitespace-pre-line text-ink">{value || <span className="text-ink-soft/60">—</span>}</dd>
    </div>
  );
}

async function SupplierProjects({ supplierId }: { supplierId: string }) {
  const supabase = await createClient();
  const [{ data: links }, { data: projects }] = await Promise.all([
    supabase.from("project_suppliers").select("id, role, projects(id, name, status, clients(name))").eq("supplier_id", supplierId),
    supabase.from("projects").select("id, name").is("deleted_at", null).is("archived_at", null).order("name"),
  ]);
  return (
    <Card>
      <CardHeader title="Histórico de projetos" description="Projetos em que este fornecedor participa ou participou." />
      {(links ?? []).length === 0 ? (
        <EmptyState icon="FolderKanban" title="Nenhum projeto vinculado" className="!py-8" />
      ) : (
        <ul className="mt-3 divide-y divide-blush">
          {(links ?? []).map((l) => {
            const p = l.projects as unknown as { id: string; name: string; clients: { name: string } | null };
            return (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                <Link href={`/projetos/${p.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink hover:text-deep">{p.name}</span>
                  <span className="block text-[12.5px] text-ink-soft">{p.clients?.name}{l.role ? ` · ${l.role}` : ""}</span>
                </Link>
                <ConfirmAction action={unlinkSupplierFromProject} fields={{ id: l.id }} label="" icon="Trash2" title="Remover vínculo?" description="O fornecedor deixa de aparecer neste projeto." confirmLabel="Remover" danger className="!px-2" />
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-blush"><LinkProjectForm supplierId={supplierId} projects={projects ?? []} /></div>
    </Card>
  );
}

async function SupplierPackaging({ supplierId }: { supplierId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("packaging_items").select("id, name, code, packaging_type, capacity, capacity_unit, unit_cost, currency").eq("supplier_id", supplierId).is("deleted_at", null).order("name");
  return (
    <Card>
      <CardHeader title="Embalagens deste fornecedor" action={<ButtonLink href={`/embalagens/novo?fornecedor=${supplierId}`} size="sm" icon="Plus">Nova embalagem</ButtonLink>} />
      {(data ?? []).length === 0 ? (
        <EmptyState icon="Package" title="Nenhuma embalagem cadastrada" className="!py-8" />
      ) : (
        <ul className="mt-3 divide-y divide-blush">
          {(data ?? []).map((e) => (
            <li key={e.id}>
              <Link href={`/embalagens/${e.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fff8fb]">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-ink">{e.name}</span>
                  <span className="block text-[12.5px] text-ink-soft">{[e.code, e.packaging_type, e.capacity && `${e.capacity} ${e.capacity_unit ?? ""}`].filter(Boolean).join(" · ")}</span>
                </span>
                {e.unit_cost !== null && <span className="text-[13px] text-ink tabular">{formatCurrency(Number(e.unit_cost), e.currency)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
