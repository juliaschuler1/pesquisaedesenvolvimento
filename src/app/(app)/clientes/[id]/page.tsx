import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import { Avatar, Badge, ButtonLink, Card, CardHeader, DemoBadge, EmptyState } from "@/components/ui/primitives";
import { QuickAction } from "@/components/ui/interactive";
import { Icon } from "@/components/ui/icon";
import { QueryTabs } from "@/components/records/view-tabs";
import { LifecycleActions } from "@/components/records/lifecycle";
import { PlannedPanel } from "@/components/records/planned-panel";
import { AttachmentsPanel } from "@/components/attachments/panel";
import { ProjectCard } from "@/components/projects/project-card";
import { ActivityTable, type ActivityWithRefs } from "@/components/activities/activity-table";
import { ActivityDialogButton } from "@/components/activities/activity-form";
import { AuditTimeline } from "@/components/records/audit-timeline";
import { loadProjectCards } from "@/lib/data/project-cards";
import { formatDate, todayISO } from "@/lib/format";
import { duplicateClient } from "../actions";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { displayCustomValue } from "@/lib/custom-fields";
import { ContactsPanel } from "./contacts-panel";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Cliente" };
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Cliente" };
}

const TABS = [
  { value: "", label: "Visão geral" },
  { value: "projetos", label: "Projetos" },
  { value: "contatos", label: "Contatos" },
  { value: "reunioes", label: "Reuniões e atividades" },
  { value: "cronogramas", label: "Cronogramas" },
  { value: "documentos", label: "Documentos" },
  { value: "briefings", label: "Briefings", muted: true },
  { value: "follow-ups", label: "Follow-ups", muted: true },
  { value: "relatorios", label: "Relatórios", muted: true },
  { value: "historico", label: "Histórico" },
];

export default async function ClientFolder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const { aba = "" } = await searchParams;
  if (!isUuid(id)) notFound();
  const s = await getSession();
  const tz = s.settings.timezone;
  const supabase = await createClient();
  const { data: c } = await supabase.from("clients").select("*, client_contacts(*)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const urls = await signedUrls(supabase, [c.logo_path]);
  const today = todayISO(tz);
  const [projects, cfields] = await Promise.all([loadProjectCards({ clientId: id, tz }), loadCustomFields("clients")]);

  return (
    <div>
      <Link href="/clientes" className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-deep">
        ‹ Clientes
      </Link>
      <Card className="mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-blush via-[#fbe7ef] to-pastel/50" />
        <div className="flex flex-col gap-5 px-6 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="-mt-10 flex items-end gap-5">
            {c.logo_path && urls[c.logo_path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[c.logo_path]} alt="" className="h-24 w-24 rounded-3xl bg-white object-contain p-2 shadow-[var(--shadow-soft)] ring-4 ring-white" />
            ) : (
              <Avatar name={c.brand_name || c.name} size={96} className="rounded-3xl ring-4 ring-white" />
            )}
            <div className="pb-1">
              <h1 className="font-serif text-[30px] leading-tight text-ink">{c.brand_name || c.name}</h1>
              <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink-soft">
                {c.brand_name && <span>{c.name}</span>}
                {c.segment && <span>· {c.segment}</span>}
                {c.is_demo && <DemoBadge />}
                {c.archived_at && <Badge tone="warning">Arquivado</Badge>}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <ButtonLink href={`/projetos/novo?cliente=${id}`} icon="Plus" size="sm">Novo projeto</ButtonLink>
            <ButtonLink href={`/clientes/${id}/editar`} variant="secondary" icon="Pencil" size="sm">Editar</ButtonLink>
            <QuickAction action={duplicateClient} fields={{ id }} label="Duplicar" icon="Copy" />
            <LifecycleActions entity="clients" id={id} name={c.name} archivedAt={c.archived_at} deletedAt={c.deleted_at} noun="este cliente" />
          </div>
        </div>
      </Card>

      <div className="mb-6">
        <QueryTabs base={`/clientes/${id}`} param="aba" current={aba} tabs={TABS} />
      </div>

      {aba === "" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title="Perfil da marca" />
              <dl className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
                <Info label="Posicionamento" value={c.positioning} />
                <Info label="Público-alvo" value={c.target_audience} />
                <Info label="Canais de venda" value={(c.sales_channels as string[]).join(", ")} />
                <Info label="Início da consultoria" value={c.consulting_started_on ? formatDate(c.consulting_started_on) : null} />
                <Info label="Informações comerciais" value={c.commercial_info} wide />
                <Info label="Observações" value={c.notes} wide />
                {cfields.map((f) => (
                  <Info key={f.id} label={f.label} value={displayCustomValue(f, (c.custom_data as Record<string, unknown>)?.[f.key])} wide={f.field_type === "long_text"} />
                ))}
              </dl>
            </Card>
            {c.private_notes && (
              <Card className="bg-[#fffafc]">
                <CardHeader title="Observações internas" description="Visíveis apenas para a equipe — nunca exibidas a clientes." />
                <p className="px-5 pt-3 pb-5 text-[14px] whitespace-pre-line text-ink">{c.private_notes}</p>
              </Card>
            )}
            <Card>
              <CardHeader title="Projetos" action={<Link href={`/clientes/${id}?aba=projetos`} className="text-[12.5px] text-deep hover:underline">Ver todos</Link>} />
              {projects.length === 0 ? (
                <EmptyState icon="FolderKanban" title="Nenhum projeto" description="Crie o primeiro projeto desta cliente." action={<ButtonLink href={`/projetos/novo?cliente=${id}`} size="sm">Novo projeto</ButtonLink>} className="!py-8" />
              ) : (
                <ul className="grid gap-4 p-5 sm:grid-cols-2">
                  {projects.slice(0, 4).map((p) => (
                    <li key={p.id}><ProjectCard p={{ ...p, client_name: undefined }} /></li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card className="h-fit">
            <CardHeader title="Contato" />
            <ul className="flex flex-col gap-3 p-5 text-[14px]">
              <ContactLine icon="Mail" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
              <ContactLine icon="Phone" value={c.phone} href={c.phone ? `tel:${c.phone}` : undefined} />
              <ContactLine icon="MessageCircle" value={c.whatsapp} href={c.whatsapp ? `https://wa.me/${String(c.whatsapp).replace(/\D/g, "")}` : undefined} />
              <ContactLine icon="Globe" value={c.website} href={c.website ?? undefined} />
              <ContactLine icon="Building2" value={c.cnpj ? `CNPJ ${c.cnpj}` : null} />
              {Object.entries((c.social ?? {}) as Record<string, string>).map(([k, v]) => (
                <ContactLine key={k} icon="ExternalLink" value={`${k[0].toUpperCase() + k.slice(1)}: ${v}`} />
              ))}
              {!c.email && !c.phone && !c.whatsapp && !c.website && <li className="text-ink-soft">Nenhum contato cadastrado.</li>}
            </ul>
            <div className="border-t border-blush px-5 py-4 text-[13px]">
              <span className="text-ink-soft">{(c.client_contacts ?? []).length} responsáveis cadastrados · </span>
              <Link href={`/clientes/${id}?aba=contatos`} className="text-deep hover:underline">gerenciar</Link>
            </div>
          </Card>
        </div>
      )}

      {aba === "projetos" && (
        projects.length === 0 ? (
          <Card><EmptyState icon="FolderKanban" title="Nenhum projeto" action={<ButtonLink href={`/projetos/novo?cliente=${id}`}>Novo projeto</ButtonLink>} /></Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => <li key={p.id}><ProjectCard p={{ ...p, client_name: undefined }} /></li>)}
          </ul>
        )
      )}

      {aba === "contatos" && <ContactsPanel clientId={id} contacts={c.client_contacts ?? []} />}

      {aba === "reunioes" && <ClientActivities clientId={id} today={today} tz={tz} projects={projects.map((p) => ({ id: p.id, name: p.name, client_name: c.name }))} />}

      {aba === "cronogramas" && (
        <Card>
          <CardHeader title="Cronogramas dos projetos" description="Progresso ponderado pelas etapas concluídas." />
          <ul className="divide-y divide-blush p-2">
            {projects.length === 0 && <li className="p-4 text-[13px] text-ink-soft">Nenhum projeto.</li>}
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projetos/${p.id}?aba=cronograma`} className="flex items-center gap-4 rounded-xl px-3 py-3 hover:bg-[#fff6f9]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">{p.name}</span>
                    <span className="block text-[12.5px] text-ink-soft">{p.current_stage ?? "Sem etapas pendentes"}</span>
                  </span>
                  <span className="w-40"><span className="mb-1 block text-right text-[12px] tabular text-ink">{p.progress === null ? "—" : `${Math.round(p.progress)}%`}</span><span className="block h-1.5 rounded-full bg-blush"><span className="block h-full rounded-full bg-deep" style={{ width: `${p.progress ?? 0}%` }} /></span></span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {aba === "documentos" && <AttachmentsPanel orgId={s.orgId} entityType="clients" entityId={id} back={`/clientes/${id}`} tz={tz} title="Contratos e documentos" />}

      {aba === "briefings" && <PlannedPanel icon="ClipboardList" title="Briefings desta cliente" phase={4} items={["Lista de briefings por projeto e versão", "Briefings aprovados com data e responsável", "Exportação em PDF com identidade editorial", "Comparação entre versões"]} />}
      {aba === "follow-ups" && <PlannedPanel icon="MessagesSquare" title="Timeline de follow-ups" phase={5} items={["Atualizações com decisões, pendências e próximos passos", "Classificação interna ou compartilhável", "Lembretes e alertas de retorno", "Vínculo com etapas do cronograma"]} />}
      {aba === "relatorios" && <PlannedPanel icon="FileBarChart" title="Relatórios da cliente" phase={5} items={["Relatórios semanais, quinzenais e mensais", "Resumo executivo das atividades registradas", "Exclusão automática de informações internas", "Exportação em PDF"]} />}

      {aba === "historico" && <AuditTimeline filter={{ client_id: id }} tz={tz} />}
    </div>
  );
}

async function ClientActivities({ clientId, today, tz, projects }: { clientId: string; today: string; tz: string; projects: { id: string; name: string; client_name: string }[] }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("*, projects(id, name), clients(id, name)")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(200);
  return (
    <Card>
      <CardHeader title="Reuniões e atividades" action={<ActivityDialogButton size="sm" draft={{ kind: "meeting", client_id: clientId }} projects={projects} label="Nova reunião" icon="CalendarClock" />} />
      <div className="mt-2">
        <ActivityTable rows={(data ?? []) as ActivityWithRefs[]} today={today} tz={tz} emptyTitle="Nenhuma reunião ou atividade" emptyDescription="Registre reuniões, visitas e tarefas desta cliente." />
      </div>
    </Card>
  );
}

function Info({ label, value, wide }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[12.5px] text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-[14px] whitespace-pre-line text-ink">{value || <span className="text-ink-soft/60">—</span>}</dd>
    </div>
  );
}

function ContactLine({ icon, value, href }: { icon: string; value: string | null | undefined; href?: string }) {
  if (!value) return null;
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blush text-deep">
        <Icon name={icon} size={15} />
      </span>
      {href ? (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="min-w-0 truncate text-ink hover:text-deep">{value}</a>
      ) : (
        <span className="min-w-0 truncate text-ink">{value}</span>
      )}
    </li>
  );
}
