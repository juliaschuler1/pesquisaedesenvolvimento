import Link from "next/link";
import type { PipelineRow, Segment } from "@/lib/data/dashboard-calc";
import { Badge, cx, DemoBadge } from "@/components/ui/primitives";
import { formatDate, formatPercent } from "@/lib/format";
import { PRIORITY, PROJECT_STATUS } from "@/lib/domain";

const SEG: Record<Segment["state"], { cls: string; label: string }> = {
  done: { cls: "bg-deep", label: "Concluída" },
  active: { cls: "stripe-progress", label: "Em andamento" },
  late: { cls: "bg-[#C2410C] shadow-[inset_0_-3px_0_#7c2808]", label: "Atrasada" },
  todo: { cls: "bg-blush", label: "Não iniciada" },
  skipped: { cls: "bg-[#efe6ea]", label: "Não se aplica" },
};

export function PipelineLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-soft" aria-label="Legenda das etapas">
      {(["done", "active", "late", "todo"] as const).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={cx("h-2.5 w-4 rounded-[3px]", SEG[k].cls)} aria-hidden />
          {SEG[k].label}
        </li>
      ))}
    </ul>
  );
}

/** Esteira de desenvolvimento: cada projeto é uma cartela de etapas do cronograma real. */
export function Pipeline({ rows }: { rows: PipelineRow[] }) {
  return (
    <ul className="divide-y divide-blush">
      {rows.map((p) => (
        <li key={p.id}>
          <Link href={`/projetos/${p.id}`} className="group grid gap-3 px-5 py-4 transition-colors hover:bg-[#fff8fb] md:grid-cols-[minmax(0,250px)_minmax(0,1fr)_88px] md:items-center md:gap-6">
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-medium text-ink group-hover:text-deep" title={p.name}>{p.name}</p>
              <p className="truncate text-[12.5px] text-ink-soft" title={p.client_name}>{p.client_name}</p>
              <p className="mt-1 flex items-center gap-2 text-[12px] text-ink-soft">
                {p.launch_date ? <>Lançamento {formatDate(p.launch_date)}</> : "Sem data de lançamento"}
                {p.is_demo && <DemoBadge />}
              </p>
            </div>

            <div className="min-w-0">
              {p.segments.length > 0 ? (
                <div className="flex h-3.5 gap-[2px]" role="img" aria-label={`${p.segments.filter((s) => s.state === "done").length} de ${p.segments.length} etapas concluídas`}>
                  {p.segments.map((s, i) => (
                    <span
                      key={i}
                      title={`${s.name} — ${SEG[s.state].label}`}
                      className={cx(
                        "min-w-[3px] flex-1 first:rounded-l-[4px] last:rounded-r-[4px]",
                        SEG[s.state].cls,
                        s.milestone && "relative after:absolute after:-top-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-ink/50",
                      )}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-soft">Sem cronograma — aplique o modelo na aba Cronograma.</p>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-soft">
                {p.currentStage && (
                  <span>
                    Etapa atual: <span className="text-ink">{p.currentStage}</span>
                  </span>
                )}
                {p.lateItems > 0 && <Badge tone="danger">{p.lateItems === 1 ? "1 etapa atrasada" : `${p.lateItems} etapas atrasadas`}</Badge>}
                {p.status !== "active" && <Badge tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Badge>}
                {(p.priority === "critical" || p.priority === "high") && <Badge tone={PRIORITY[p.priority].tone}>Prioridade {PRIORITY[p.priority].label.toLowerCase()}</Badge>}
              </p>
            </div>

            <div className="flex items-baseline gap-1 md:flex-col md:items-end md:gap-0">
              <span className="font-serif text-[26px] leading-none text-ink tabular">{p.progress === null ? "—" : formatPercent(p.progress)}</span>
              <span className="text-[11.5px] text-ink-soft">concluído</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
