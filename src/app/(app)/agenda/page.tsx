import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { Card, PageHeader, cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { ActivityDialogButton } from "@/components/activities/activity-form";
import { projectChoices } from "@/lib/data/projects";
import { ACTIVITY_KIND, type ActivityKind } from "@/lib/domain";
import { formatTime, todayISO, toLocalInput } from "@/lib/format";

export const metadata: Metadata = { title: "Agenda" };

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

type Ev = { id: string; day: string; title: string; kind: ActivityKind | "launch" | "milestone"; time?: string; href: string; done?: boolean };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const s = await getSession();
  const tz = s.settings.timezone;
  const today = todayISO(tz);
  const [y, m] = (mes && /^\d{4}-\d{2}$/.test(mes) ? mes : today.slice(0, 7)).split("-").map(Number);

  const first = new Date(Date.UTC(y, m - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7; // semana começa na segunda
  const gridStart = new Date(Date.UTC(y, m - 1, 1 - startOffset));
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  const from = days[0];
  const to = days[41];

  const supabase = await createClient();
  const [acts, launches, milestones, projects] = await Promise.all([
    supabase
      .from("activities")
      .select("id, title, kind, status, starts_at, due_at, project_id")
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .or(`and(starts_at.gte.${from},starts_at.lte.${to}T23:59:59),and(starts_at.is.null,due_at.gte.${from},due_at.lte.${to}T23:59:59)`),
    supabase.from("projects").select("id, name, launch_date").is("deleted_at", null).gte("launch_date", from).lte("launch_date", to),
    supabase
      .from("schedule_items")
      .select("id, name, planned_end, status, project_id, projects!inner(name, deleted_at)")
      .eq("is_milestone", true)
      .gte("planned_end", from)
      .lte("planned_end", to)
      .is("projects.deleted_at", null),
    projectChoices(),
  ]);

  const events: Ev[] = [];
  for (const a of acts.data ?? []) {
    const when = a.starts_at ?? a.due_at!;
    const local = toLocalInput(when, tz);
    events.push({ id: a.id, day: local.slice(0, 10), title: a.title, kind: a.kind as ActivityKind, time: a.starts_at ? formatTime(a.starts_at, tz) : undefined, href: a.project_id ? `/projetos/${a.project_id}?aba=atividades` : "/atividades", done: a.status === "done" });
  }
  for (const p of launches.data ?? []) events.push({ id: "l" + p.id, day: p.launch_date!, title: `Lançamento: ${p.name}`, kind: "launch", href: `/projetos/${p.id}` });
  for (const ms of milestones.data ?? []) {
    const pn = (ms.projects as unknown as { name: string }).name;
    events.push({ id: "m" + ms.id, day: ms.planned_end!, title: `${ms.name} · ${pn}`, kind: "milestone", href: `/projetos/${ms.project_id}?aba=cronograma`, done: ms.status === "done" });
  }
  const byDay = new Map<string, Ev[]>();
  for (const e of events) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Reuniões, visitas técnicas, prazos, marcos do cronograma e lançamentos."
        actions={<ActivityDialogButton projects={projects} draft={{ kind: "meeting" }} label="Agendar" icon="CalendarClock" />}
      />
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-serif text-[22px] text-ink first-letter:uppercase">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Link href={`/agenda?mes=${prev}`} className="rounded-full px-3 py-1.5 text-[13px] text-ink-soft hover:bg-blush" aria-label="Mês anterior">‹ Anterior</Link>
            <Link href="/agenda" className="rounded-full px-3 py-1.5 text-[13px] text-deep hover:bg-blush">Hoje</Link>
            <Link href={`/agenda?mes=${next}`} className="rounded-full px-3 py-1.5 text-[13px] text-ink-soft hover:bg-blush" aria-label="Próximo mês">Próximo ›</Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7 border-t border-blush">
            {WEEKDAYS.map((w) => (
              <div key={w} className="border-b border-blush bg-[#fffafc] px-3 py-2 text-[12px] text-ink-soft">{w}</div>
            ))}
            {days.map((d, i) => {
              const inMonth = Number(d.slice(5, 7)) === m;
              const evs = (byDay.get(d) ?? []).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
              return (
                <div key={d} className={cx("min-h-[112px] border-b border-blush p-2", i % 7 !== 0 && "border-l", !inMonth && "bg-[#fffbfd]")}>
                  <span className={cx("inline-grid h-7 w-7 place-items-center rounded-full text-[12.5px] tabular", d === today ? "bg-deep font-semibold text-white" : inMonth ? "text-ink" : "text-ink-soft/50")}>
                    {Number(d.slice(8, 10))}
                  </span>
                  <ul className="mt-1 flex flex-col gap-1">
                    {evs.slice(0, 4).map((e) => (
                      <li key={e.id}>
                        <Link
                          href={e.href}
                          title={e.title}
                          className={cx(
                            "flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11.5px]",
                            e.kind === "launch" ? "bg-ink text-white" : e.kind === "milestone" ? "bg-pastel/60 text-ink" : "bg-blush text-ink",
                            e.done && "line-through opacity-60",
                          )}
                        >
                          <Icon name={e.kind === "launch" ? "Sparkles" : e.kind === "milestone" ? "Flag" : ACTIVITY_KIND[e.kind].icon} size={11} />
                          {e.time && <span className="tabular text-ink-soft">{e.time}</span>}
                          <span className="truncate">{e.title}</span>
                        </Link>
                      </li>
                    ))}
                    {evs.length > 4 && <li className="px-1.5 text-[11px] text-ink-soft">+{evs.length - 4} itens</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
