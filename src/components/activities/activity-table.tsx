import Link from "next/link";
import { Badge, EmptyState, cx } from "@/components/ui/primitives";
import { ConfirmAction, QuickAction } from "@/components/ui/interactive";
import { Icon } from "@/components/ui/icon";
import { deleteActivity, setActivityStatus } from "@/lib/actions/activities";
import { ACTIVITY_KIND, ACTIVITY_STATUS, PRIORITY, type ActivityRow } from "@/lib/domain";
import { formatDate, formatTime, relativeDays, toLocalInput } from "@/lib/format";
import { ActivityDialogButton } from "./activity-form";

export type ActivityWithRefs = ActivityRow & {
  projects?: { id: string; name: string } | null;
  clients?: { id: string; name: string } | null;
};

export function ActivityTable({
  rows,
  today,
  tz,
  showProject = true,
  emptyTitle = "Nenhuma atividade",
  emptyDescription,
}: {
  rows: ActivityWithRefs[];
  today: string;
  tz: string;
  showProject?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) return <EmptyState icon="ListChecks" title={emptyTitle} description={emptyDescription} className="!py-10" />;
  return (
    <ul className="divide-y divide-blush">
      {rows.map((a) => {
        const when = a.starts_at ?? a.due_at;
        const day = when?.slice(0, 10) ?? null;
        const done = a.status === "done" || a.status === "cancelled";
        const overdue = !done && day !== null && day < today;
        return (
          <li key={a.id} className="group flex items-start gap-3 px-4 py-3.5 md:px-5">
            <QuickAction
              action={setActivityStatus}
              fields={{ id: a.id, status: done ? "pending" : "done" }}
              label={done ? "Reabrir" : "Concluir"}
              icon={done ? "CheckCircle2" : "Circle"}
              iconOnly
              className={cx("mt-0.5 !h-7 !w-7 !rounded-full", done ? "!text-success" : "!text-ink-soft hover:!text-deep")}
            />
            <div className="min-w-0 flex-1">
              <p className={cx("text-[14px]", done ? "text-ink-soft line-through decoration-pastel" : "text-ink")}>{a.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <Icon name={ACTIVITY_KIND[a.kind].icon} size={13} /> {ACTIVITY_KIND[a.kind].label}
                </span>
                {when && (
                  <span className={cx(overdue && "font-medium text-danger")}>
                    · {formatDate(when, tz)}
                    {a.starts_at && ` às ${formatTime(a.starts_at, tz)}`}
                    {!done && day && ` (${relativeDays(day, today)})`}
                  </span>
                )}
                {a.location && <span>· {a.location}</span>}
                {showProject && a.projects && (
                  <Link href={`/projetos/${a.projects.id}`} className="hover:text-deep">
                    · {a.projects.name}
                  </Link>
                )}
                {showProject && !a.projects && a.clients && (
                  <Link href={`/clientes/${a.clients.id}`} className="hover:text-deep">
                    · {a.clients.name}
                  </Link>
                )}
                {a.owner && <span>· {a.owner}</span>}
                {a.visibility === "shareable" && <Badge tone="success" className="!text-[11px]">Compartilhável</Badge>}
              </p>
              {a.description && <p className="mt-1 line-clamp-2 text-[13px] text-ink/80">{a.description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!done && (a.priority === "high" || a.priority === "critical") && <Badge tone={PRIORITY[a.priority].tone}>{PRIORITY[a.priority].label}</Badge>}
              {a.status === "in_progress" && <Badge tone={ACTIVITY_STATUS.in_progress.tone}>Em andamento</Badge>}
              <span className="flex opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <ActivityDialogButton
                  label="Editar"
                  icon="Pencil"
                  variant="ghost"
                  size="sm"
                  draft={{
                    id: a.id,
                    title: a.title,
                    kind: a.kind,
                    description: a.description,
                    priority: a.priority,
                    status: a.status,
                    starts_at: toLocalInput(a.starts_at, tz),
                    due_at: toLocalInput(a.due_at, tz),
                    location: a.location,
                    owner: a.owner,
                    visibility: a.visibility,
                    project_id: a.project_id,
                    client_id: a.client_id,
                  }}
                />
                <ConfirmAction action={deleteActivity} fields={{ id: a.id }} label="" icon="Trash2" title="Excluir atividade?" description={`“${a.title}” será removida das listas.`} confirmLabel="Excluir" danger className="!px-2" />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
