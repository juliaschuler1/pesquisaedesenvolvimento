/**
 * Cálculo dos indicadores do dashboard a partir dos dados reais.
 * Função pura (sem acesso ao banco) para poder ser testada.
 */
import { addDaysISO, diffDays } from "@/lib/format";
import { isProjectLate, type ActivityRow, type ProgressRow, type ProjectStatus, type Priority, type ScheduleStatus, type SkuStatus } from "@/lib/domain";

export type DashProject = {
  id: string;
  name: string;
  code: string | null;
  client_id: string;
  client_name: string;
  category: string | null;
  status: ProjectStatus;
  priority: Priority;
  launch_date: string | null;
  start_date: string | null;
  is_demo: boolean;
};

export type DashScheduleItem = {
  project_id: string;
  name: string;
  status: ScheduleStatus;
  position: number;
  planned_end: string | null;
  is_milestone: boolean;
};

export type DashSku = { project_id: string; status: SkuStatus };

export type DashInput = {
  today: string;
  clientsCount: number;
  projects: DashProject[];
  progress: ProgressRow[];
  schedule: DashScheduleItem[];
  skus: DashSku[];
  activities: (Pick<ActivityRow, "id" | "kind" | "title" | "status" | "priority" | "starts_at" | "due_at" | "project_id" | "client_id" | "location">)[];
};

export type Segment = { name: string; state: "done" | "active" | "late" | "todo" | "skipped"; milestone: boolean };

export type PipelineRow = DashProject & {
  progress: number | null;
  currentStage: string | null;
  late: boolean;
  lateItems: number;
  segments: Segment[];
  daysToLaunch: number | null;
};

const ACTIVE_SKU: SkuStatus[] = ["concept", "in_development", "sampling", "approved"];

export function computeDashboard(input: DashInput) {
  const { today } = input;
  const weekEnd = addDaysISO(today, 7);
  const progressById = new Map(input.progress.map((p) => [p.project_id, p]));

  const open = input.projects.filter((p) => p.status !== "completed" && p.status !== "cancelled");
  const lateProjects = open.filter((p) => isProjectLate(p, progressById.get(p.id), today));
  const lateIds = new Set(lateProjects.map((p) => p.id));
  const projectIds = new Set(input.projects.map((p) => p.id));

  const skusInDev = input.skus.filter((s) => projectIds.has(s.project_id) && ACTIVE_SKU.includes(s.status)).length;

  const upcomingLaunches = open
    .filter((p) => p.launch_date && p.launch_date >= today && p.launch_date <= addDaysISO(today, 90))
    .sort((a, b) => (a.launch_date! < b.launch_date! ? -1 : 1));

  // Atividades: restritas aos projetos filtrados (ou sem projeto, quando não há filtro de projeto)
  const acts = input.activities.filter((a) => !a.project_id || projectIds.has(a.project_id));
  const pending = acts.filter((a) => a.status === "pending" || a.status === "in_progress");
  const dateOf = (a: (typeof acts)[number]) => (a.starts_at ?? a.due_at ?? "").slice(0, 10);

  const approvalsPending = pending.filter((a) => a.kind === "approval");
  const followUpsPending = pending.filter((a) => a.kind === "follow_up");
  const thisWeek = pending
    .filter((a) => {
      const d = dateOf(a);
      return d && d >= today && d <= weekEnd;
    })
    .sort((a, b) => (dateOf(a) < dateOf(b) ? -1 : 1));
  const meetings = thisWeek.filter((a) => a.kind === "meeting");
  const visits = thisWeek.filter((a) => a.kind === "technical_visit");
  const critical = pending
    .filter((a) => {
      const d = (a.due_at ?? a.starts_at ?? "").slice(0, 10);
      if (!d) return false;
      const overdue = d < today;
      const soon = d <= weekEnd && (a.priority === "critical" || a.priority === "high" || a.kind === "deadline");
      return overdue || soon;
    })
    .sort((a, b) => ((a.due_at ?? a.starts_at ?? "") < (b.due_at ?? b.starts_at ?? "") ? -1 : 1));

  // Esteira de desenvolvimento
  const byProject = new Map<string, DashScheduleItem[]>();
  for (const s of input.schedule) {
    if (!byProject.has(s.project_id)) byProject.set(s.project_id, []);
    byProject.get(s.project_id)!.push(s);
  }
  const pipeline: PipelineRow[] = open
    .map((p) => {
      const pr = progressById.get(p.id);
      const items = (byProject.get(p.id) ?? []).sort((a, b) => a.position - b.position);
      const segments: Segment[] = items.map((s) => ({
        name: s.name,
        milestone: s.is_milestone,
        state:
          s.status === "done"
            ? "done"
            : s.status === "skipped"
              ? "skipped"
              : s.planned_end && s.planned_end < today
                ? "late"
                : s.status === "in_progress"
                  ? "active"
                  : "todo",
      }));
      return {
        ...p,
        progress: pr?.progress ?? null,
        currentStage: pr?.current_stage ?? null,
        late: lateIds.has(p.id),
        lateItems: pr?.late_items ?? 0,
        segments,
        daysToLaunch: p.launch_date ? diffDays(today, p.launch_date) : null,
      };
    })
    .sort((a, b) => {
      const pr = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      if (a.status !== b.status) return a.status === "active" ? -1 : b.status === "active" ? 1 : 0;
      return pr[a.priority] - pr[b.priority] || (a.launch_date ?? "9") .localeCompare(b.launch_date ?? "9");
    });

  // Distribuições
  const byCategory = countBy(input.projects.filter((p) => p.status !== "cancelled"), (p) => p.category || "Sem categoria");
  const byStage = countBy(
    open.map((p) => progressById.get(p.id)?.current_stage ?? (progressById.get(p.id)?.total_items ? "Concluído" : "Sem cronograma")),
    (x) => x,
  );

  return {
    kpis: {
      clients: input.clientsCount,
      active: input.projects.filter((p) => p.status === "active").length,
      planning: input.projects.filter((p) => p.status === "planning").length,
      completed: input.projects.filter((p) => p.status === "completed").length,
      paused: input.projects.filter((p) => p.status === "paused").length,
      late: lateProjects.length,
      skusInDev,
      upcomingLaunches: upcomingLaunches.length,
      approvalsPending: approvalsPending.length,
      followUpsPending: followUpsPending.length,
      meetingsThisWeek: meetings.length,
      visitsThisWeek: visits.length,
      activitiesThisWeek: thisWeek.length,
    },
    pipeline,
    upcomingLaunches,
    thisWeek,
    critical,
    byCategory,
    byStage,
  };
}

export function countBy<T>(items: T[], key: (t: T) => string): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}
