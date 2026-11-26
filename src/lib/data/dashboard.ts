import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, todayISO } from "@/lib/format";
import type { ProgressRow } from "@/lib/domain";
import { computeDashboard, type DashProject } from "./dashboard-calc";

export type DashboardFilters = {
  cliente?: string;
  categoria?: string;
  prioridade?: string;
  status?: string;
  periodo?: string; // lançamento nos próximos N dias
};

export async function loadDashboard(filters: DashboardFilters, tz: string) {
  const supabase = await createClient();
  const today = todayISO(tz);

  let pq = supabase
    .from("projects")
    .select("id, name, code, client_id, category, status, priority, launch_date, start_date, is_demo, clients(name)")
    .is("deleted_at", null)
    .is("archived_at", null);
  if (filters.cliente) pq = pq.eq("client_id", filters.cliente);
  if (filters.categoria) pq = pq.eq("category", filters.categoria);
  if (filters.prioridade) pq = pq.eq("priority", filters.prioridade);
  if (filters.status) pq = pq.eq("status", filters.status);
  if (filters.periodo && /^\d+$/.test(filters.periodo)) {
    pq = pq.gte("launch_date", today).lte("launch_date", addDaysISO(today, Number(filters.periodo)));
  }

  const [projectsRes, clientsRes, allClients, categories] = await Promise.all([
    pq,
    supabase.from("clients").select("id", { count: "exact", head: true }).is("deleted_at", null).is("archived_at", null),
    supabase.from("clients").select("id, name").is("deleted_at", null).is("archived_at", null).order("name"),
    supabase.from("projects").select("category").is("deleted_at", null).not("category", "is", null),
  ]);

  const projects: DashProject[] = (projectsRes.data ?? []).map((p) => ({
    ...p,
    client_name: (p.clients as unknown as { name: string } | null)?.name ?? "",
  })) as DashProject[];
  const ids = projects.map((p) => p.id);

  const [progress, schedule, skus, activities, recent] = await Promise.all([
    ids.length ? supabase.from("project_progress").select("*").in("project_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("schedule_items").select("project_id, name, status, position, planned_end, is_milestone").in("project_id", ids).is("parent_id", null)
      : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("skus").select("project_id, status").in("project_id", ids).is("deleted_at", null) : Promise.resolve({ data: [] }),
    supabase
      .from("activities")
      .select("id, kind, title, status, priority, starts_at, due_at, project_id, client_id, location")
      .is("deleted_at", null)
      .in("status", ["pending", "in_progress"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase.from("audit_log").select("id, entity_type, entity_id, action, label, created_at, project_id, client_id").order("created_at", { ascending: false }).limit(12),
  ]);

  const filtered = Boolean(filters.cliente || filters.categoria || filters.prioridade || filters.status || filters.periodo);
  const result = computeDashboard({
    today,
    clientsCount: filters.cliente ? 1 : clientsRes.count ?? 0,
    projects,
    progress: (progress.data ?? []) as ProgressRow[],
    schedule: (schedule.data ?? []) as never,
    skus: (skus.data ?? []) as never,
    activities: (filtered ? (activities.data ?? []).filter((a) => a.project_id && ids.includes(a.project_id)) : activities.data ?? []) as never,
  });

  return {
    ...result,
    today,
    recent: recent.data ?? [],
    clients: allClients.data ?? [],
    categories: [...new Set((categories.data ?? []).map((c) => c.category as string))].sort(),
    hasAnyData: (clientsRes.count ?? 0) > 0,
    filtered,
  };
}
