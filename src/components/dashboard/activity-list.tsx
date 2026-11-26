import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Badge, cx } from "@/components/ui/primitives";
import { ACTIVITY_KIND, type ActivityKind, type Priority } from "@/lib/domain";
import { formatDate, formatTime, relativeDays } from "@/lib/format";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  priority: Priority;
  starts_at: string | null;
  due_at: string | null;
  location: string | null;
  project_id: string | null;
};

export function ActivityList({ items, today, tz, empty }: { items: ActivityItem[]; today: string; tz: string; empty: string }) {
  if (items.length === 0) return <p className="px-5 pt-1 pb-5 text-[13px] text-ink-soft">{empty}</p>;
  return (
    <ul className="flex flex-col px-2 pb-3">
      {items.map((a) => {
        const when = a.starts_at ?? a.due_at;
        const day = when ? when.slice(0, 10) : null;
        const overdue = day ? day < today : false;
        return (
          <li key={a.id}>
            <Link
              href={a.project_id ? `/projetos/${a.project_id}?aba=atividades` : `/atividades`}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-[#fff6f9]"
            >
              <span className={cx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", overdue ? "bg-danger-bg text-danger" : "bg-blush text-deep")}>
                <Icon name={ACTIVITY_KIND[a.kind].icon} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">{a.title}</span>
                <span className="block text-[12px] text-ink-soft">
                  {ACTIVITY_KIND[a.kind].label}
                  {when && (
                    <>
                      {" · "}
                      {formatDate(when, tz)}
                      {a.starts_at && ` às ${formatTime(a.starts_at, tz)}`}
                    </>
                  )}
                  {a.location && ` · ${a.location}`}
                </span>
              </span>
              {day && (
                <Badge tone={overdue ? "danger" : a.priority === "critical" ? "warning" : "neutral"} className="mt-0.5 shrink-0">
                  {overdue ? `atrasada ${relativeDays(day, today).replace("há ", "")}` : relativeDays(day, today)}
                </Badge>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
