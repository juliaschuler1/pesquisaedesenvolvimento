/** Vocabulário do domínio: tipos e rótulos em português usados em toda a interface. */

export type ProjectStatus = "planning" | "active" | "paused" | "completed" | "cancelled";
export type Priority = "low" | "medium" | "high" | "critical";
export type SkuStatus =
  | "concept"
  | "in_development"
  | "sampling"
  | "approved"
  | "in_production"
  | "launched"
  | "paused"
  | "cancelled";
export type ActivityKind =
  | "task"
  | "meeting"
  | "technical_visit"
  | "follow_up"
  | "approval"
  | "deadline"
  | "other";
export type ActivityStatus = "pending" | "in_progress" | "done" | "cancelled";
export type ScheduleStatus = "not_started" | "in_progress" | "done" | "paused" | "skipped";
export type Tone = "neutral" | "rose" | "success" | "warning" | "danger" | "info";

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  planning: { label: "Planejamento", tone: "info" },
  active: { label: "Em andamento", tone: "rose" },
  paused: { label: "Pausado", tone: "warning" },
  completed: { label: "Concluído", tone: "success" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  low: { label: "Baixa", tone: "neutral" },
  medium: { label: "Média", tone: "info" },
  high: { label: "Alta", tone: "warning" },
  critical: { label: "Crítica", tone: "danger" },
};

export const SKU_STATUS: Record<SkuStatus, { label: string; tone: Tone }> = {
  concept: { label: "Conceito", tone: "neutral" },
  in_development: { label: "Em desenvolvimento", tone: "rose" },
  sampling: { label: "Em amostragem", tone: "info" },
  approved: { label: "Aprovado", tone: "success" },
  in_production: { label: "Em produção", tone: "rose" },
  launched: { label: "Lançado", tone: "success" },
  paused: { label: "Pausado", tone: "warning" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export const ACTIVITY_KIND: Record<ActivityKind, { label: string; icon: string }> = {
  task: { label: "Tarefa", icon: "CheckCircle2" },
  meeting: { label: "Reunião", icon: "Users" },
  technical_visit: { label: "Visita técnica", icon: "Factory" },
  follow_up: { label: "Follow-up", icon: "MessagesSquare" },
  approval: { label: "Aprovação", icon: "BadgeCheck" },
  deadline: { label: "Prazo", icon: "AlarmClock" },
  other: { label: "Outro", icon: "Circle" },
};

export const ACTIVITY_STATUS: Record<ActivityStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pendente", tone: "warning" },
  in_progress: { label: "Em andamento", tone: "rose" },
  done: { label: "Concluída", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
};

export const SCHEDULE_STATUS: Record<ScheduleStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Não iniciada", tone: "neutral" },
  in_progress: { label: "Em andamento", tone: "rose" },
  done: { label: "Concluída", tone: "success" },
  paused: { label: "Pausada", tone: "warning" },
  skipped: { label: "Não se aplica", tone: "neutral" },
};

export const VOLUME_UNITS = ["ml", "g", "kg", "L", "un"] as const;

export function options<T extends string>(map: Record<T, { label: string }>) {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value].label }));
}

export type ProjectRow = {
  id: string;
  org_id: string;
  client_id: string;
  code: string | null;
  name: string;
  cover_path: string | null;
  category: string | null;
  product_type: string | null;
  concept: string | null;
  objective: string | null;
  rationale: string | null;
  start_date: string | null;
  launch_date: string | null;
  priority: Priority;
  status: ProjectStatus;
  owners: string[];
  target_cost: number | null;
  budget: number | null;
  currency: string;
  sku_shared: SkuShared;
  notes: string | null;
  private_notes: string | null;
  custom_data: Record<string, unknown>;
  is_demo: boolean;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SkuShared = {
  fragrance?: string | null;
  volume?: number | null;
  volume_unit?: string | null;
  packaging?: string | null;
  specs?: string | null;
};

export type ClientRow = {
  id: string;
  org_id: string;
  name: string;
  brand_name: string | null;
  logo_path: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  social: Record<string, string>;
  segment: string | null;
  positioning: string | null;
  target_audience: string | null;
  sales_channels: string[];
  commercial_info: string | null;
  consulting_started_on: string | null;
  notes: string | null;
  private_notes: string | null;
  custom_data: Record<string, unknown>;
  is_demo: boolean;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SkuRow = {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
  gtin: string | null;
  color: string | null;
  pantone: string | null;
  fragrance: string | null;
  volume: number | null;
  volume_unit: string | null;
  planned_quantity: number | null;
  sample_version: string | null;
  packaging: string | null;
  specs: string | null;
  status: SkuStatus;
  approvals: string | null;
  image_path: string | null;
  position: number;
  is_demo: boolean;
  archived_at: string | null;
};

export type ScheduleItemRow = {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  status: ScheduleStatus;
  weight: number;
  is_milestone: boolean;
  planned_start: string | null;
  planned_end: string | null;
  baseline_start: string | null;
  baseline_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  depends_on: string[];
  owner: string | null;
  notes: string | null;
};

export type ActivityRow = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  sku_id: string | null;
  kind: ActivityKind;
  title: string;
  description: string | null;
  status: ActivityStatus;
  priority: Priority;
  starts_at: string | null;
  due_at: string | null;
  location: string | null;
  owner: string | null;
  visibility: "internal" | "shareable";
  completed_at: string | null;
  is_demo: boolean;
};

export type ProgressRow = {
  project_id: string;
  total_items: number;
  done_items: number;
  progress: number | null;
  current_stage: string | null;
  late_items: number;
  planned_finish: string | null;
};

/** Valor efetivo de um SKU: campo próprio ou herdado das informações comuns do projeto. */
export function effectiveSku<K extends keyof SkuShared>(
  sku: Partial<Record<K, unknown>>,
  shared: SkuShared,
  key: K,
): { value: unknown; inherited: boolean } {
  const own = sku[key];
  if (own !== null && own !== undefined && own !== "") return { value: own, inherited: false };
  const inherited = shared?.[key];
  return { value: inherited ?? null, inherited: inherited !== null && inherited !== undefined && inherited !== "" };
}

/** Um projeto está atrasado se tem etapas vencidas ou passou da previsão de lançamento sem concluir. */
export function isProjectLate(
  p: Pick<ProjectRow, "status" | "launch_date">,
  progress: Pick<ProgressRow, "late_items"> | undefined,
  today: string,
): boolean {
  if (p.status === "completed" || p.status === "cancelled") return false;
  if (p.launch_date && p.launch_date < today) return true;
  return (progress?.late_items ?? 0) > 0;
}
