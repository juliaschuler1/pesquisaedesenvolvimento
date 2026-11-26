import { describe, expect, it } from "vitest";
import { computeDashboard, countBy, type DashInput, type DashProject } from "@/lib/data/dashboard-calc";
import { effectiveSku, isProjectLate } from "@/lib/domain";

const today = "2026-05-10";

function project(over: Partial<DashProject>): DashProject {
  return {
    id: over.id ?? "p",
    name: "Projeto",
    code: null,
    client_id: "c1",
    client_name: "Cliente",
    category: "Maquiagem",
    status: "active",
    priority: "medium",
    launch_date: null,
    start_date: null,
    is_demo: false,
    ...over,
  };
}

function input(over: Partial<DashInput>): DashInput {
  return { today, clientsCount: 2, projects: [], progress: [], schedule: [], skus: [], activities: [], ...over };
}

describe("indicadores do dashboard", () => {
  it("conta projetos por status e identifica atrasos reais", () => {
    const d = computeDashboard(
      input({
        projects: [
          project({ id: "a", status: "active", launch_date: "2026-04-01" }), // lançamento vencido → atrasado
          project({ id: "b", status: "active", launch_date: "2026-07-01" }),
          project({ id: "c", status: "paused" }),
          project({ id: "d", status: "completed", launch_date: "2026-01-01" }), // concluído nunca é atrasado
        ],
        progress: [{ project_id: "b", total_items: 3, done_items: 1, progress: 30, current_stage: "Benchmark", late_items: 2, planned_finish: null }],
      }),
    );
    expect(d.kpis.active).toBe(2);
    expect(d.kpis.paused).toBe(1);
    expect(d.kpis.completed).toBe(1);
    expect(d.kpis.late).toBe(2); // a (data) + b (etapas vencidas)
    expect(d.kpis.upcomingLaunches).toBe(1);
  });

  it("conta SKUs em desenvolvimento apenas dos projetos filtrados", () => {
    const d = computeDashboard(
      input({
        projects: [project({ id: "a" })],
        skus: [
          { project_id: "a", status: "sampling" },
          { project_id: "a", status: "launched" },
          { project_id: "outro", status: "in_development" },
        ],
      }),
    );
    expect(d.kpis.skusInDev).toBe(1);
  });

  it("classifica atividades da semana, aprovações, follow-ups e prazos críticos", () => {
    const d = computeDashboard(
      input({
        projects: [project({ id: "a" })],
        activities: [
          { id: "1", kind: "meeting", title: "Reunião", status: "pending", priority: "medium", starts_at: "2026-05-11T14:00:00Z", due_at: null, project_id: "a", client_id: null, location: null },
          { id: "2", kind: "approval", title: "Aprovar cor", status: "pending", priority: "high", starts_at: null, due_at: "2026-05-12T12:00:00Z", project_id: "a", client_id: null, location: null },
          { id: "3", kind: "follow_up", title: "Cobrar", status: "pending", priority: "low", starts_at: null, due_at: "2026-05-01T12:00:00Z", project_id: null, client_id: null, location: null },
          { id: "4", kind: "task", title: "Distante", status: "pending", priority: "critical", starts_at: null, due_at: "2026-06-30T12:00:00Z", project_id: "a", client_id: null, location: null },
        ],
      }),
    );
    expect(d.kpis.meetingsThisWeek).toBe(1);
    expect(d.kpis.approvalsPending).toBe(1);
    expect(d.kpis.followUpsPending).toBe(1);
    expect(d.critical.map((a) => a.id)).toEqual(["3", "2"]); // vencido + alta prioridade em 7 dias
  });

  it("monta a esteira com estados das etapas", () => {
    const d = computeDashboard(
      input({
        projects: [project({ id: "a" })],
        schedule: [
          { project_id: "a", name: "Pesquisa", status: "done", position: 1, planned_end: "2026-04-01", is_milestone: false },
          { project_id: "a", name: "Briefing", status: "in_progress", position: 2, planned_end: "2026-05-01", is_milestone: false },
          { project_id: "a", name: "Amostras", status: "not_started", position: 3, planned_end: "2026-06-01", is_milestone: true },
        ],
      }),
    );
    expect(d.pipeline[0].segments.map((s) => s.state)).toEqual(["done", "late", "todo"]);
  });

  it("agrupa e ordena contagens", () => {
    expect(countBy(["b", "a", "b"], (x) => x)).toEqual([
      { label: "b", value: 2 },
      { label: "a", value: 1 },
    ]);
  });
});

describe("SKUs herdam informações comuns", () => {
  it("usa o valor próprio ou herda do projeto", () => {
    const shared = { fragrance: "Baunilha", volume: 6 };
    expect(effectiveSku({ fragrance: null }, shared, "fragrance")).toEqual({ value: "Baunilha", inherited: true });
    expect(effectiveSku({ fragrance: "Rosa" }, shared, "fragrance")).toEqual({ value: "Rosa", inherited: false });
    expect(effectiveSku({ volume: null }, {}, "volume")).toEqual({ value: null, inherited: false });
  });

  it("projeto cancelado não é atrasado", () => {
    expect(isProjectLate({ status: "cancelled", launch_date: "2020-01-01" }, undefined, today)).toBe(false);
  });
});
