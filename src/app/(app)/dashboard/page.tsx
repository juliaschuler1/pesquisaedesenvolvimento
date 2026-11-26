import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { loadDashboard } from "@/lib/data/dashboard";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PlannedBadge, cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { Pipeline, PipelineLegend } from "@/components/dashboard/pipeline";
import { HBars } from "@/components/dashboard/bars";
import { ActivityList } from "@/components/dashboard/activity-list";
import { describeAudit, type AuditRow } from "@/lib/audit";
import { formatDate, formatDateTime, greeting } from "@/lib/format";
import { PRIORITY, PROJECT_STATUS, options } from "@/lib/domain";

export const metadata: Metadata = { title: "Dashboard" };

type SP = Promise<Record<string, string | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const s = await getSession();
  const tz = s.settings.timezone;
  const d = await loadDashboard(
    { cliente: sp.cliente, categoria: sp.categoria, prioridade: sp.prioridade, status: sp.status, periodo: sp.periodo },
    tz,
  );
  const firstName = s.fullName.split(" ")[0];
  const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date());

  const kpis: { label: string; value: number; href: string; note?: string; alert?: boolean }[] = [
    { label: "Clientes", value: d.kpis.clients, href: "/clientes" },
    { label: "Projetos ativos", value: d.kpis.active, href: "/projetos?status=active" },
    { label: "Atrasados", value: d.kpis.late, href: "/projetos?atrasados=1", alert: d.kpis.late > 0 },
    { label: "SKUs em desenvolvimento", value: d.kpis.skusInDev, href: "/skus" },
    { label: "Lançamentos em 90 dias", value: d.kpis.upcomingLaunches, href: "/projetos?lancamento=90" },
    { label: "Aprovações pendentes", value: d.kpis.approvalsPending, href: "/atividades?tipo=approval" },
    { label: "Follow-ups pendentes", value: d.kpis.followUpsPending, href: "/atividades?tipo=follow_up" },
  ];

  const secondary = [
    { label: "Em planejamento", value: d.kpis.planning, href: "/projetos?status=planning" },
    { label: "Pausados", value: d.kpis.paused, href: "/projetos?status=paused" },
    { label: "Concluídos", value: d.kpis.completed, href: "/projetos?status=completed" },
    { label: "Reuniões na semana", value: d.kpis.meetingsThisWeek, href: "/agenda" },
    { label: "Visitas técnicas na semana", value: d.kpis.visitsThisWeek, href: "/agenda" },
    { label: "Atividades na semana", value: d.kpis.activitiesThisWeek, href: "/atividades?periodo=semana" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <p className="text-[13.5px] text-ink-soft first-letter:uppercase">{longDate}</p>
          <h1 className="mt-1 font-serif text-[34px] leading-tight text-ink md:whitespace-nowrap md:text-[40px]">
            {greeting(tz)}
            {firstName ? `, ${firstName}` : ""}.
          </h1>
        </div>
        <nav aria-label="Atalhos" className="flex flex-wrap gap-2">
          <ButtonLink href="/clientes/novo" variant="secondary" icon="Users" size="sm">Novo cliente</ButtonLink>
          <ButtonLink href="/projetos/novo" variant="secondary" icon="FolderKanban" size="sm">Novo projeto</ButtonLink>
          <ButtonLink href="/atividades?nova=1" variant="secondary" icon="ListChecks" size="sm">Nova atividade</ButtonLink>
          <ButtonLink href="/atividades?nova=1&tipo=follow_up" variant="secondary" icon="MessagesSquare" size="sm">Novo follow-up</ButtonLink>
          <Link href="/briefings" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] text-ink-soft border border-dashed border-pastel hover:bg-blush" title="Gerador de briefings — Fase 4">
            <Icon name="ClipboardList" size={15} /> Novo briefing <PlannedBadge phase={4} />
          </Link>
          <Link href="/fornecedores" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[13px] text-ink-soft border border-dashed border-pastel hover:bg-blush" title="Banco de fornecedores — Fase 2">
            <Icon name="Contact" size={15} /> Novo fornecedor <PlannedBadge phase={2} />
          </Link>
        </nav>
      </header>

      {!d.hasAnyData ? (
        <Card>
          <EmptyState
            icon="Flower2"
            title="Seu estúdio está pronto"
            description="Cadastre a primeira cliente e o primeiro projeto. Os indicadores, a esteira de desenvolvimento e a agenda passam a ser calculados a partir dos seus registros."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/clientes/novo" icon="Users">Cadastrar cliente</ButtonLink>
                <ButtonLink href="/configuracoes#demonstracao" variant="secondary">Explorar com dados demonstrativos</ButtonLink>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <FilterBar
            filters={[
              { name: "cliente", label: "Cliente", options: d.clients.map((c) => ({ value: c.id, label: c.name })) },
              { name: "categoria", label: "Categoria", options: d.categories.map((c) => ({ value: c, label: c })) },
              { name: "status", label: "Status", options: options(PROJECT_STATUS) },
              { name: "prioridade", label: "Prioridade", options: options(PRIORITY) },
              {
                name: "periodo",
                label: "Lançamento",
                options: [
                  { value: "30", label: "próximos 30 dias" },
                  { value: "90", label: "próximos 90 dias" },
                  { value: "180", label: "próximos 6 meses" },
                  { value: "365", label: "próximos 12 meses" },
                ],
              },
            ]}
          />

          {/* Indicadores principais: uma régua única, cada número leva aos registros */}
          <Card className="overflow-hidden">
            <ul className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7">
              {kpis.map((k, i) => (
                <li key={k.label} className={cx("border-blush", i > 0 && "xl:border-l", i % 2 === 1 && "border-l sm:border-l-0", i % 4 !== 0 && "sm:border-l", i >= 2 && "border-t sm:border-t-0", i >= 4 && "sm:border-t xl:border-t-0")}>
                  <Link href={k.href} className="group block h-full px-5 py-5 transition-colors hover:bg-[#fff8fb]">
                    <span className={cx("block font-serif text-[34px] leading-none tabular", k.alert ? "text-danger" : "text-ink group-hover:text-deep")}>{k.value}</span>
                    <span className="mt-2 block text-[12.5px] leading-snug text-ink-soft">{k.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-blush bg-[#fffafc] px-5 py-3 text-[12.5px] text-ink-soft">
              {secondary.map((k) => (
                <Link key={k.label} href={k.href} className="hover:text-deep">
                  {k.label} <span className="font-semibold text-ink tabular">{k.value}</span>
                </Link>
              ))}
              <span className="inline-flex items-center gap-1.5" title="Módulos de amostras e testes chegam na Fase 5">
                Amostras e testes <PlannedBadge phase={5} />
              </span>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <Card>
              <CardHeader
                title="Esteira de desenvolvimento"
                description="Cada faixa é o cronograma real do projeto, etapa por etapa."
                action={<PipelineLegend />}
                className="flex-col md:flex-row"
              />
              <div className="mt-3">
                {d.pipeline.length > 0 ? (
                  <Pipeline rows={d.pipeline} />
                ) : (
                  <EmptyState icon="FolderKanban" title="Nenhum projeto em aberto" description={d.filtered ? "Nenhum projeto corresponde aos filtros." : "Crie um projeto para acompanhar sua esteira."} action={<ButtonLink href="/projetos/novo" size="sm">Novo projeto</ButtonLink>} />
                )}
              </div>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader title="Prazos críticos" description="Vencidos ou de alta prioridade nos próximos 7 dias" action={<Link href="/atividades" className="text-[12.5px] text-deep hover:underline">Ver todas</Link>} />
                <div className="mt-2">
                  <ActivityList items={d.critical.slice(0, 6)} today={d.today} tz={tz} empty="Nenhum prazo crítico. Tudo em dia." />
                </div>
              </Card>
              <Card>
                <CardHeader title="Esta semana" description="Reuniões, visitas técnicas e entregas" action={<Link href="/agenda" className="text-[12.5px] text-deep hover:underline">Agenda</Link>} />
                <div className="mt-2">
                  <ActivityList items={d.thisWeek.slice(0, 6)} today={d.today} tz={tz} empty="Nada agendado para os próximos 7 dias." />
                </div>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Projetos por categoria" />
              <div className="mt-4">
                <HBars data={d.byCategory} emptyText="Sem projetos." hrefFor={(l) => (l === "Sem categoria" ? "/projetos" : `/projetos?categoria=${encodeURIComponent(l)}`)} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Projetos por etapa atual" />
              <div className="mt-4">
                <HBars data={d.byStage} emptyText="Sem projetos em aberto." />
              </div>
            </Card>
            <Card>
              <CardHeader title="Próximos lançamentos" description="Próximos 90 dias" />
              <ul className="mt-3 flex flex-col px-2 pb-3">
                {d.upcomingLaunches.length === 0 && <li className="px-3 pb-3 text-[13px] text-ink-soft">Nenhum lançamento previsto nos próximos 90 dias.</li>}
                {d.upcomingLaunches.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link href={`/projetos/${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#fff6f9]">
                      <span className="grid w-12 shrink-0 place-items-center rounded-xl bg-blush py-1.5 text-center leading-none">
                        <span className="font-serif text-[18px] text-ink">{p.launch_date!.slice(8, 10)}</span>
                        <span className="text-[10.5px] text-ink-soft">
                          {new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(p.launch_date! + "T12:00:00Z")).replace(".", "")}
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] text-ink">{p.name}</span>
                        <span className="block truncate text-[12px] text-ink-soft">{p.client_name}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader title="Atividade recente" description="Últimas alterações registradas" action={<Link href="/historico" className="text-[12.5px] text-deep hover:underline">Histórico completo</Link>} />
            <ul className="mt-3 grid gap-x-8 px-5 pb-5 md:grid-cols-2">
              {d.recent.length === 0 && <li className="text-[13px] text-ink-soft">Nenhuma alteração registrada ainda.</li>}
              {(d.recent as AuditRow[]).map((r) => {
                const t = describeAudit(r);
                return (
                  <li key={r.id} className="flex items-start gap-3 border-b border-blush/70 py-2.5 last:border-0">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    <span className="min-w-0 flex-1 text-[13px] text-ink">
                      {t.entity}{" "}
                      {t.href ? <Link href={t.href} className="font-medium hover:text-deep">{t.title}</Link> : <span className="font-medium">{t.title}</span>}{" "}
                      {t.verb}
                      <span className="block text-[11.5px] text-ink-soft">{formatDateTime(r.created_at, tz)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
      <p className="sr-only">Atualizado em {formatDate(d.today)}</p>
      {s.role === "client_viewer" && <Badge>Acesso de cliente</Badge>}
    </div>
  );
}
