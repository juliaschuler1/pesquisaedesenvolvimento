import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui/primitives";
import { QueryTabs } from "@/components/records/view-tabs";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { ActivityTable, type ActivityWithRefs } from "@/components/activities/activity-table";
import { ActivityDialogButton } from "@/components/activities/activity-form";
import { projectChoices } from "@/lib/data/projects";
import { ACTIVITY_KIND, PRIORITY, options, type ActivityKind } from "@/lib/domain";
import { addDaysISO, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Minhas atividades" };

type SP = Promise<{ ver?: string; tipo?: string; prioridade?: string; projeto?: string; periodo?: string; nova?: string }>;

export default async function ActivitiesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const s = await getSession();
  const tz = s.settings.timezone;
  const today = todayISO(tz);
  const supabase = await createClient();
  const ver = sp.ver ?? "";

  let q = supabase
    .from("activities")
    .select("*, projects(id, name), clients(id, name)")
    .is("deleted_at", null)
    .limit(300);
  q = ver === "concluidas" ? q.in("status", ["done", "cancelled"]).order("completed_at", { ascending: false }) : q.in("status", ["pending", "in_progress"]).order("due_at", { ascending: true, nullsFirst: false });
  if (sp.tipo && sp.tipo in ACTIVITY_KIND) q = q.eq("kind", sp.tipo);
  if (sp.prioridade && sp.prioridade in PRIORITY) q = q.eq("priority", sp.prioridade);
  if (sp.projeto) q = q.eq("project_id", sp.projeto);

  const [{ data }, projects] = await Promise.all([q, projectChoices()]);
  let rows = (data ?? []) as ActivityWithRefs[];
  if (sp.periodo === "semana") {
    const end = addDaysISO(today, 7);
    rows = rows.filter((a) => {
      const d = (a.starts_at ?? a.due_at ?? "").slice(0, 10);
      return d && d >= today && d <= end;
    });
  }
  // sem data por último, atrasadas primeiro
  const overdue = rows.filter((a) => (a.starts_at ?? a.due_at ?? "9999").slice(0, 10) < today && ver !== "concluidas");
  const rest = rows.filter((a) => !overdue.includes(a));

  const presetKind = sp.tipo && sp.tipo in ACTIVITY_KIND ? (sp.tipo as ActivityKind) : "task";

  return (
    <div>
      <PageHeader
        title="Minhas atividades"
        description="Tarefas, reuniões, visitas técnicas, aprovações, prazos e follow-ups de todos os projetos."
        actions={<ActivityDialogButton projects={projects} draft={{ kind: presetKind }} autoOpen={sp.nova === "1"} label={presetKind === "follow_up" ? "Novo follow-up" : "Nova atividade"} />}
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <QueryTabs
          base="/atividades"
          param="ver"
          current={ver}
          keep={{ tipo: sp.tipo, prioridade: sp.prioridade, projeto: sp.projeto }}
          tabs={[
            { value: "", label: "Em aberto" },
            { value: "concluidas", label: "Concluídas" },
          ]}
        />
        <FilterBar
          filters={[
            { name: "tipo", label: "Tipo", options: options(ACTIVITY_KIND) },
            { name: "prioridade", label: "Prioridade", options: options(PRIORITY) },
            { name: "projeto", label: "Projeto", options: projects.map((p) => ({ value: p.id, label: p.name })) },
            { name: "periodo", label: "Período", options: [{ value: "semana", label: "próximos 7 dias" }] },
          ]}
        />
      </div>

      {overdue.length > 0 && (
        <Card className="mb-5 ring-danger/20">
          <h2 className="px-5 pt-4 text-[13.5px] font-medium text-danger">Atrasadas · {overdue.length}</h2>
          <ActivityTable rows={overdue} today={today} tz={tz} />
        </Card>
      )}
      <Card>
        <ActivityTable
          rows={rest}
          today={today}
          tz={tz}
          emptyTitle={ver === "concluidas" ? "Nada concluído ainda" : overdue.length ? "Sem outras atividades em aberto" : "Nenhuma atividade em aberto"}
          emptyDescription={ver === "concluidas" ? "Atividades concluídas aparecem aqui." : "Crie tarefas, agende reuniões e registre follow-ups."}
        />
      </Card>
    </div>
  );
}
