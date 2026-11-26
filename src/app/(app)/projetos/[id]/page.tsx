import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import { Badge, ButtonLink, Card, CardHeader, DemoBadge, EmptyState, ProgressBar, cx } from "@/components/ui/primitives";
import { ConfirmAction, QuickAction } from "@/components/ui/interactive";
import { Icon } from "@/components/ui/icon";
import { LifecycleActions } from "@/components/records/lifecycle";
import { PlannedPanel } from "@/components/records/planned-panel";
import { AttachmentsPanel } from "@/components/attachments/panel";
import { AuditTimeline } from "@/components/records/audit-timeline";
import { ActivityTable, type ActivityWithRefs } from "@/components/activities/activity-table";
import { ActivityDialogButton } from "@/components/activities/activity-form";
import {
  PRIORITY, PROJECT_STATUS, SCHEDULE_STATUS, SKU_STATUS, effectiveSku, isProjectLate,
  type ProgressRow, type ProjectRow, type ScheduleItemRow, type SkuRow,
} from "@/lib/domain";
import { diffDays, formatCurrency, formatDate, formatNumber, formatPercent, todayISO } from "@/lib/format";
import { applyTemplate, deleteScheduleItem, duplicateProject, duplicateSku, moveScheduleItem, setScheduleStatus } from "../actions";
import { SkuDialogButton } from "./sku-dialog";
import { ScheduleItemButton } from "./schedule-dialog";
import { TabsCustomizer } from "./tabs-customizer";
import { CustomTabEditor } from "./custom-tab-editor";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { displayCustomValue } from "@/lib/custom-fields";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Projeto" };
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Projeto" };
}

const PLANNED: Record<string, string[]> = {
  pesquisa: ["Concorrentes em cards com fotos, preços e claims", "Pesquisa inteligente por link ou nome com IA", "Menor, maior, médio e mediano preço por ml/g", "Matriz de posicionamento e lacunas de mercado", "Exportação da pesquisa em PDF"],
  benchmark: ["Benchmarks de fórmula, textura, sensorial, embalagem e mais", "Fórmula de referência com INCI e OCR de rótulos", "Diferenciação entre dados declarados, inferidos e não confirmados", "Seleção do que vai para o briefing do terceirista"],
  briefing: ["Formulário em 10 etapas com salvamento automático", "Seleção visual de embalagens e características", "Modo reunião sem informações internas", "Versões, aprovação e exportação em PDF"],
  identidade: ["Moodboard com arrastar e soltar", "Paletas, Pantones, tipografia e mockups", "Versões e seleção para briefing/relatório"],
  "embalagem-primaria": ["Frasco, tampa, válvula, pump, aplicador e retentor por componente", "Material, acabamento, decoração, MOQ, custo e lead time", "Seleção direta da biblioteca de embalagens"],
  "embalagem-secundaria": ["Cartucho, sleeve, shrink, rótulo e combinações", "Campos condicionais por tipo (gramatura, micras, acabamentos)", "Fornecedor, MOQ, custo e lead time"],
  target: ["Custos unitários, fixos e por lote", "Cenários de 1.000 a 100.000 unidades", "Margem bruta e markup estimados", "Volume de granel com densidade quando necessário"],
  cotacoes: ["Propostas por fornecedor, versão e volume", "Matriz comparativa full service × parcial", "Atualização do custo estimado mediante confirmação"],
  amostras: ["Rodadas de amostras com avaliação sensorial e técnica", "Comparação lado a lado entre versões", "Histórico de ajustes e decisões"],
  testes: ["Estabilidade, compatibilidade, micro, segurança e eficácia", "Laudos e evidências anexados", "Claims só comprovados com evidência e aprovação"],
};

export default async function ProjectFolder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const { id } = await params;
  const { aba: abaParam } = await searchParams;
  if (!isUuid(id)) notFound();
  const s = await getSession();
  const tz = s.settings.timezone;
  const today = todayISO(tz);
  const supabase = await createClient();

  const [{ data: project }, { data: progressRow }, { data: ownTabs }, { data: defaultTabs }] = await Promise.all([
    supabase.from("projects").select("*, clients(id, name, brand_name)").eq("id", id).maybeSingle(),
    supabase.from("project_progress").select("*").eq("project_id", id).maybeSingle(),
    supabase.from("project_tabs").select("*").eq("project_id", id).order("position"),
    supabase.from("project_tabs").select("*").is("project_id", null).order("position"),
  ]);
  if (!project) notFound();
  const p = project as ProjectRow & { clients: { id: string; name: string; brand_name: string | null } };
  const progress = progressRow as ProgressRow | null;
  const tabs = (ownTabs && ownTabs.length ? ownTabs : defaultTabs ?? []) as { key: string; label: string; icon: string; kind: string; availability: string; phase: number | null; visible: boolean }[];
  const visibleTabs = tabs.filter((t) => t.visible);
  const aba = abaParam && tabs.some((t) => t.key === abaParam) ? abaParam : "visao-geral";
  const tab = tabs.find((t) => t.key === aba)!;
  const late = isProjectLate(p, progress ?? undefined, today);
  const urls = await signedUrls(supabase, [p.cover_path]);

  return (
    <div>
      <Link href="/projetos" className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-deep">‹ Projetos</Link>

      <Card className="mb-6 overflow-hidden">
        <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="p-6 md:p-7">
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
              <Link href={`/clientes/${p.clients.id}`} className="hover:text-deep">{p.clients.brand_name || p.clients.name}</Link>
              {p.code && <span>· {p.code}</span>}
              {p.category && <span>· {p.category}</span>}
              {p.product_type && <span>· {p.product_type}</span>}
            </p>
            <h1 className="mt-1 font-serif text-[32px] leading-tight text-ink md:text-[38px]">{p.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Badge>
              <Badge tone={PRIORITY[p.priority].tone}>Prioridade {PRIORITY[p.priority].label.toLowerCase()}</Badge>
              {late && <Badge tone="danger">Atrasado</Badge>}
              {p.is_demo && <DemoBadge />}
              {p.archived_at && <Badge tone="warning">Arquivado</Badge>}
            </div>
            <div className="mt-6 grid max-w-xl grid-cols-3 gap-4">
              <Stat label="Progresso" value={formatPercent(progress?.progress ?? null)} />
              <Stat label="Início" value={formatDate(p.start_date)} />
              <Stat label="Lançamento" value={formatDate(p.launch_date)} hint={p.launch_date ? (diffDays(today, p.launch_date) >= 0 ? `em ${diffDays(today, p.launch_date)} dias` : "data passada") : undefined} />
            </div>
            <div className="mt-4 max-w-xl">
              <ProgressBar value={progress?.progress ?? 0} tone={late ? "danger" : "rose"} />
              <p className="mt-2 text-[12.5px] text-ink-soft">
                {progress?.current_stage ? <>Etapa atual: <span className="text-ink">{progress.current_stage}</span></> : progress?.total_items ? "Todas as etapas concluídas" : "Sem cronograma"}
                {progress && progress.late_items > 0 && <span className="text-danger"> · {progress.late_items} etapa(s) atrasada(s)</span>}
              </p>
            </div>
          </div>
          <div className="relative min-h-40 bg-gradient-to-br from-blush to-pastel/60">
            {p.cover_path && urls[p.cover_path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[p.cover_path]} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <Link href={`/projetos/${id}/editar`} className="rounded-full bg-white/70 px-4 py-2 text-[13px] text-deep backdrop-blur hover:bg-white">+ Imagem de capa</Link>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t border-blush px-4 py-2.5">
          <ButtonLink href={`/projetos/${id}/editar`} variant="ghost" size="sm" icon="Pencil">Editar</ButtonLink>
          <QuickAction action={duplicateProject} fields={{ id }} label="Duplicar" icon="Copy" />
          <LifecycleActions entity="projects" id={id} name={p.name} archivedAt={p.archived_at} deletedAt={p.deleted_at} noun="este projeto" />
          <span className="ml-auto"><TabsCustomizer projectId={id} tabs={tabs} /></span>
        </div>
      </Card>

      <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Abas do projeto">
        {visibleTabs.map((t) => (
          <Link
            key={t.key}
            href={`/projetos/${id}?aba=${t.key}`}
            scroll={false}
            aria-current={aba === t.key ? "page" : undefined}
            className={cx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors",
              aba === t.key ? "bg-ink text-white" : t.availability === "planned" ? "text-ink-soft/70 hover:bg-blush" : "text-ink-soft hover:bg-blush hover:text-ink",
            )}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </Link>
        ))}
      </nav>

      {tab.availability === "planned" ? (
        <PlannedPanel icon={tab.icon} title={tab.label} phase={tab.phase ?? 2} items={PLANNED[tab.key] ?? ["Funcionalidade prevista no plano de implementação."]} />
      ) : tab.kind === "custom" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader title={tab.label} description="Aba personalizada deste projeto." />
            <CustomTabEditor projectId={id} tabKey={tab.key} content={(((p.custom_data?.tabs as Record<string, { content?: string }>) ?? {})[tab.key]?.content) ?? ""} />
          </Card>
          <AttachmentsPanel orgId={s.orgId} entityType="projects" entityId={id} back={`/projetos/${id}`} tz={tz} title="Arquivos do projeto" />
        </div>
      ) : aba === "visao-geral" ? (
        <Overview p={p} id={id} today={today} tz={tz} />
      ) : aba === "skus" ? (
        <Skus p={p} id={id} />
      ) : aba === "cronograma" ? (
        <Schedule id={id} today={today} />
      ) : aba === "atividades" ? (
        <ProjectActivities id={id} clientId={p.client_id} today={today} tz={tz} />
      ) : aba === "documentos" ? (
        <AttachmentsPanel orgId={s.orgId} entityType="projects" entityId={id} back={`/projetos/${id}`} tz={tz} title="Documentos e imagens do projeto" />
      ) : aba === "historico" ? (
        <AuditTimeline filter={{ project_id: id }} tz={tz} />
      ) : (
        <PlannedPanel icon={tab.icon} title={tab.label} phase={tab.phase ?? 2} items={["Conteúdo em implementação."]} />
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[12px] text-ink-soft">{label}</p>
      <p className="font-serif text-[22px] leading-tight text-ink tabular">{value}</p>
      {hint && <p className="text-[11.5px] text-ink-soft">{hint}</p>}
    </div>
  );
}

/* --------------------------------- Visão geral ---------------------------------- */

async function Overview({ p, id, today, tz }: { p: ProjectRow; id: string; today: string; tz: string }) {
  const supabase = await createClient();
  const [{ data: skus }, { data: acts }, cfields] = await Promise.all([
    supabase.from("skus").select("id, name, status, color").eq("project_id", id).is("deleted_at", null).order("position"),
    supabase.from("activities").select("*, projects(id, name), clients(id, name)").eq("project_id", id).is("deleted_at", null).in("status", ["pending", "in_progress"]).order("due_at", { ascending: true, nullsFirst: false }).limit(5),
    loadCustomFields("projects"),
  ]);
  const sh = p.sku_shared ?? {};
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Conceito e estratégia" />
          <dl className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
            <Info label="Conceito" value={p.concept} wide />
            <Info label="Objetivo" value={p.objective} />
            <Info label="Justificativa" value={p.rationale} />
            <Info label="Responsáveis" value={p.owners.join(", ")} />
            <Info label="Observações" value={p.notes} />
            {cfields.map((f) => (
              <Info key={f.id} label={f.label} value={displayCustomValue(f, p.custom_data?.[f.key])} wide={f.field_type === "long_text"} />
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Próximas atividades" action={<Link href={`/projetos/${id}?aba=atividades`} className="text-[12.5px] text-deep hover:underline">Ver todas</Link>} />
          <div className="mt-1"><ActivityTable rows={(acts ?? []) as ActivityWithRefs[]} today={today} tz={tz} showProject={false} emptyTitle="Nenhuma atividade em aberto" /></div>
        </Card>
        {p.private_notes && (
          <Card className="bg-[#fffafc]">
            <CardHeader title="Observações internas" description="Nunca exibidas a clientes ou fornecedores." />
            <p className="px-5 pt-3 pb-5 text-[14px] whitespace-pre-line text-ink">{p.private_notes}</p>
          </Card>
        )}
      </div>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Comercial" />
          <dl className="grid grid-cols-2 gap-4 p-5">
            <Info label="Custo-alvo unitário" value={p.target_cost !== null ? formatCurrency(p.target_cost) : null} />
            <Info label="Orçamento" value={p.budget !== null ? formatCurrency(p.budget) : null} />
          </dl>
          <p className="border-t border-blush px-5 py-3 text-[12.5px] text-ink-soft">Cenários de custo e viabilidade chegam na Fase 4.</p>
        </Card>
        <Card>
          <CardHeader title="Comum a todos os SKUs" />
          <dl className="grid gap-3 p-5">
            <Info label="Fragrância" value={sh.fragrance} />
            <Info label="Volumetria" value={sh.volume ? `${formatNumber(Number(sh.volume), Number(sh.volume) % 1 ? 2 : 0)} ${sh.volume_unit ?? ""}` : null} />
            <Info label="Embalagem" value={sh.packaging} />
          </dl>
        </Card>
        <Card>
          <CardHeader title={`SKUs (${(skus ?? []).length})`} action={<Link href={`/projetos/${id}?aba=skus`} className="text-[12.5px] text-deep hover:underline">Gerenciar</Link>} />
          <ul className="flex flex-col gap-1 p-3">
            {(skus ?? []).length === 0 && <li className="px-2 py-2 text-[13px] text-ink-soft">Nenhum SKU cadastrado.</li>}
            {(skus ?? []).map((sk) => (
              <li key={sk.id} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-[13.5px]">
                <span className="truncate text-ink">{sk.name}</span>
                <Badge tone={SKU_STATUS[sk.status as SkuRow["status"]].tone}>{SKU_STATUS[sk.status as SkuRow["status"]].label}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
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

/* ------------------------------------- SKUs ------------------------------------- */

async function Skus({ p, id }: { p: ProjectRow; id: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("skus").select("*").eq("project_id", id).is("deleted_at", null).order("position");
  const skus = (data ?? []) as (SkuRow & { archived_at: string | null; deleted_at: string | null })[];
  const urls = await signedUrls(supabase, skus.map((s) => s.image_path));
  const sh = p.sku_shared ?? {};
  const totalQty = skus.reduce((a, s) => a + (s.planned_quantity ?? 0), 0);
  const missingQty = skus.some((s) => s.planned_quantity === null);

  return (
    <Card>
      <CardHeader
        title={`SKUs · ${skus.length}`}
        description={totalQty ? `Quantidade prevista: ${formatNumber(totalQty)} un.${missingQty ? " (há SKUs sem quantidade informada)" : ""}` : "Variações de cor, fragrância ou volume deste projeto."}
        action={<SkuDialogButton projectId={id} shared={sh} />}
      />
      {skus.length === 0 ? (
        <EmptyState icon="Boxes" title="Nenhum SKU" description="Cadastre as variações. Informações comuns do projeto são herdadas automaticamente." />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13.5px]">
            <thead>
              <tr className="border-y border-blush bg-[#fffafc] text-[12px] text-ink-soft">
                <th className="px-5 py-2.5 font-medium">SKU</th>
                <th className="px-3 py-2.5 font-medium">Cor / Pantone</th>
                <th className="px-3 py-2.5 font-medium">Fragrância</th>
                <th className="px-3 py-2.5 font-medium">Volume</th>
                <th className="px-3 py-2.5 font-medium">Qtd. prevista</th>
                <th className="px-3 py-2.5 font-medium">GTIN/EAN</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-blush">
              {skus.map((sk) => {
                const frag = effectiveSku(sk, sh, "fragrance");
                const vol = effectiveSku(sk, sh, "volume");
                const unit = sk.volume !== null ? sk.volume_unit : sh.volume_unit;
                return (
                  <tr key={sk.id} className={cx("group", sk.archived_at && "opacity-60")}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {sk.image_path && urls[sk.image_path] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={urls[sk.image_path]} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-blush" />
                        ) : (
                          <span className="h-10 w-10 shrink-0 rounded-xl bg-blush" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-ink">{sk.name}</p>
                          <p className="text-[12px] text-ink-soft">{sk.code ?? "sem código"}{sk.sample_version && ` · amostra ${sk.sample_version}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink">{[sk.color, sk.pantone && `Pantone ${sk.pantone}`].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-3"><Inherited value={frag.value as string | null} inherited={frag.inherited} /></td>
                    <td className="px-3 py-3"><Inherited value={vol.value !== null ? `${formatNumber(Number(vol.value), Number(vol.value) % 1 ? 2 : 0)} ${unit ?? ""}` : null} inherited={vol.inherited} /></td>
                    <td className="px-3 py-3 tabular text-ink">{sk.planned_quantity !== null ? formatNumber(sk.planned_quantity) : <span className="text-ink-soft">não informada</span>}</td>
                    <td className="px-3 py-3 tabular text-ink">{sk.gtin ?? "—"}</td>
                    <td className="px-3 py-3"><Badge tone={SKU_STATUS[sk.status].tone}>{SKU_STATUS[sk.status].label}</Badge></td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-0.5">
                        <SkuDialogButton projectId={id} sku={sk} shared={sh} label={`Editar ${sk.name}`} icon="Pencil" variant="ghost" size="sm" iconOnly />
                        <QuickAction action={duplicateSku} fields={{ id: sk.id }} label="Duplicar SKU" icon="Copy" iconOnly />
                        <LifecycleActions entity="skus" id={sk.id} name={sk.name} archivedAt={sk.archived_at} deletedAt={sk.deleted_at} noun="este SKU" compact />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Inherited({ value, inherited }: { value: string | null; inherited: boolean }) {
  if (!value) return <span className="text-ink-soft">—</span>;
  return (
    <span className="text-ink">
      {value}
      {inherited && <span className="ml-1.5 rounded-full bg-blush px-1.5 py-0.5 text-[10.5px] text-deep" title="Herdado das informações comuns do projeto">comum</span>}
    </span>
  );
}

/* ---------------------------------- Cronograma ---------------------------------- */

async function Schedule({ id, today }: { id: string; today: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("schedule_items").select("*").eq("project_id", id).order("position");
  const items = (data ?? []) as ScheduleItemRow[];
  const siblings = items.map((i) => ({ id: i.id, name: i.name }));
  const totalW = items.filter((i) => i.status !== "skipped").reduce((a, i) => a + Number(i.weight), 0);
  const doneW = items.filter((i) => i.status === "done").reduce((a, i) => a + Number(i.weight), 0);

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="GanttChart"
          title="Cronograma vazio"
          description="Aplique o modelo de 27 etapas (pesquisa → lançamento) ou adicione etapas manualmente."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <QuickAction action={applyTemplate} fields={{ project_id: id }} label="Aplicar modelo inicial" icon="Sparkles" variant="primary" size="md" />
              <ScheduleItemButton projectId={id} siblings={[]} label="Adicionar etapa" icon="Plus" variant="secondary" size="md" />
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Cronograma"
        description={`${items.filter((i) => i.status === "done").length} de ${items.length} etapas concluídas · progresso ponderado ${totalW ? formatPercent((doneW / totalW) * 100) : "—"}`}
        action={<ScheduleItemButton projectId={id} siblings={siblings} label="Nova etapa" icon="Plus" variant="primary" />}
      />
      <p className="mx-5 mt-3 rounded-xl bg-[#fffafc] px-3 py-2 text-[12.5px] text-ink-soft">
        Visualização em lista. Kanban, calendário e Gantt interativo com arrastar e soltar chegam na Fase 5, sobre estes mesmos dados.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[13.5px]">
          <thead>
            <tr className="border-y border-blush bg-[#fffafc] text-[12px] text-ink-soft">
              <th className="w-12 px-5 py-2.5 font-medium" />
              <th className="px-2 py-2.5 font-medium">Etapa</th>
              <th className="px-3 py-2.5 font-medium">Previsto</th>
              <th className="px-3 py-2.5 font-medium">Desvio</th>
              <th className="px-3 py-2.5 font-medium">Realizado</th>
              <th className="px-3 py-2.5 font-medium">Peso</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-blush">
            {items.map((it, idx) => {
              const late = it.status !== "done" && it.status !== "skipped" && it.planned_end !== null && it.planned_end < today;
              const deviation = it.baseline_end && it.planned_end ? diffDays(it.baseline_end, it.planned_end) : 0;
              const next = it.status === "done" ? "not_started" : "done";
              return (
                <tr key={it.id} className={cx("group", it.status === "done" && "bg-[#fffcfd]")}>
                  <td className="px-5 py-2.5">
                    <QuickAction
                      action={setScheduleStatus}
                      fields={{ id: it.id, status: next }}
                      label={it.status === "done" ? "Reabrir etapa" : "Concluir etapa"}
                      icon={it.status === "done" ? "CheckCircle2" : "Circle"}
                      iconOnly
                      className={cx("!h-7 !w-7 !rounded-full", it.status === "done" ? "!text-success" : "!text-ink-soft hover:!text-deep")}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <p className={cx("flex items-center gap-1.5", it.status === "done" ? "text-ink-soft" : "text-ink")}>
                      <span className="w-6 text-[11.5px] text-ink-soft/70 tabular">{idx + 1}</span>
                      {it.is_milestone && <Icon name="Flag" size={13} className="text-deep" />}
                      {it.name}
                    </p>
                    {(it.owner || it.depends_on.length > 0) && (
                      <p className="pl-[30px] text-[11.5px] text-ink-soft">
                        {it.owner}
                        {it.owner && it.depends_on.length > 0 && " · "}
                        {it.depends_on.length > 0 && `depende de ${it.depends_on.map((d) => items.find((x) => x.id === d)?.name).filter(Boolean).join(", ")}`}
                      </p>
                    )}
                  </td>
                  <td className={cx("px-3 py-2.5 whitespace-nowrap tabular", late ? "font-medium text-danger" : "text-ink")}>
                    {it.planned_start ? `${formatDate(it.planned_start).slice(0, 5)} – ${formatDate(it.planned_end)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular">
                    {deviation === 0 ? <span className="text-ink-soft">—</span> : <span className={deviation > 0 ? "text-danger" : "text-success"}>{deviation > 0 ? `+${deviation}` : deviation} d</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-soft tabular">{it.actual_start ? `${formatDate(it.actual_start).slice(0, 5)} – ${it.actual_end ? formatDate(it.actual_end) : "…"}` : "—"}</td>
                  <td className="px-3 py-2.5 text-ink-soft tabular">{formatNumber(Number(it.weight), Number(it.weight) % 1 ? 1 : 0)}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={late ? "danger" : SCHEDULE_STATUS[it.status].tone}>{late ? "Atrasada" : SCHEDULE_STATUS[it.status].label}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-0.5 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                      {it.status === "not_started" && <QuickAction action={setScheduleStatus} fields={{ id: it.id, status: "in_progress" }} label="Iniciar" icon="Play" iconOnly />}
                      {it.status === "in_progress" && <QuickAction action={setScheduleStatus} fields={{ id: it.id, status: "paused" }} label="Pausar" icon="Pause" iconOnly />}
                      {it.status === "paused" && <QuickAction action={setScheduleStatus} fields={{ id: it.id, status: "in_progress" }} label="Reativar" icon="Play" iconOnly />}
                      <QuickAction action={moveScheduleItem} fields={{ id: it.id, dir: "up" }} label="Mover para cima" icon="ArrowUp" iconOnly />
                      <QuickAction action={moveScheduleItem} fields={{ id: it.id, dir: "down" }} label="Mover para baixo" icon="ArrowDown" iconOnly />
                      <ScheduleItemButton projectId={id} item={it} siblings={siblings} label="Editar etapa" icon="Pencil" />
                      <ConfirmAction action={deleteScheduleItem} fields={{ id: it.id }} label="" icon="Trash2" title="Excluir etapa?" description={`“${it.name}” será removida do cronograma.`} confirmLabel="Excluir etapa" danger className="!px-2" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------------------------------- Atividades ---------------------------------- */

async function ProjectActivities({ id, clientId, today, tz }: { id: string; clientId: string; today: string; tz: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activities")
    .select("*, projects(id, name), clients(id, name)")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("status")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(300);
  return (
    <Card>
      <CardHeader
        title="Atividades do projeto"
        description="Tarefas, reuniões, visitas técnicas, aprovações e follow-ups."
        action={<ActivityDialogButton size="sm" draft={{ project_id: id, client_id: clientId }} />}
      />
      <div className="mt-2">
        <ActivityTable rows={(data ?? []) as ActivityWithRefs[]} today={today} tz={tz} showProject={false} emptyTitle="Nenhuma atividade" emptyDescription="Registre a próxima tarefa, reunião ou follow-up deste projeto." />
      </div>
    </Card>
  );
}
