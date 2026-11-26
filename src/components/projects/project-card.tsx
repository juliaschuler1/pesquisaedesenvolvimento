import Link from "next/link";
import { Badge, Card, DemoBadge, ProgressBar } from "@/components/ui/primitives";
import { PRIORITY, PROJECT_STATUS, type Priority, type ProjectStatus } from "@/lib/domain";
import { formatDate, formatPercent } from "@/lib/format";

export type ProjectCardData = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  product_type: string | null;
  status: ProjectStatus;
  priority: Priority;
  launch_date: string | null;
  is_demo: boolean;
  client_name?: string;
  cover_url?: string | null;
  progress: number | null;
  current_stage: string | null;
  late: boolean;
  sku_count: number;
};

export function ProjectCard({ p }: { p: ProjectCardData }) {
  return (
    <Link href={`/projetos/${p.id}`} className="group block h-full">
      <Card as="article" className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-[var(--shadow-lift)]">
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-blush via-[#fbeef3] to-pastel/60">
          {p.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.cover_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <CoverPattern seed={p.name} />
          )}
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Badge tone={PROJECT_STATUS[p.status].tone} className="bg-white/90 backdrop-blur">{PROJECT_STATUS[p.status].label}</Badge>
            {p.late && <Badge tone="danger" className="bg-white/90">Atrasado</Badge>}
          </div>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-[12px] text-ink-soft">
            {[p.code, p.category, p.product_type].filter(Boolean).join(" · ") || "Sem categoria"}
          </p>
          <h3 className="mt-1 font-serif text-[19px] leading-tight text-ink group-hover:text-deep">{p.name}</h3>
          {p.client_name && <p className="mt-0.5 truncate text-[13px] text-ink-soft">{p.client_name}</p>}
          <div className="mt-auto pt-5">
            <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
              <span className="truncate text-ink-soft">{p.current_stage ?? (p.progress === null ? "Sem cronograma" : "Todas as etapas concluídas")}</span>
              <span className="ml-2 font-medium text-ink tabular">{formatPercent(p.progress)}</span>
            </div>
            <ProgressBar value={p.progress} tone={p.late ? "danger" : "rose"} />
            <div className="mt-3 flex items-center justify-between text-[12px] text-ink-soft">
              <span>{p.sku_count} {p.sku_count === 1 ? "SKU" : "SKUs"}</span>
              <span className="flex items-center gap-1.5">
                {p.is_demo && <DemoBadge />}
                {(p.priority === "high" || p.priority === "critical") && <Badge tone={PRIORITY[p.priority].tone}>{PRIORITY[p.priority].label}</Badge>}
                {p.launch_date ? `Lança ${formatDate(p.launch_date)}` : "Sem data"}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/** Capa gerada quando o projeto não tem imagem: gotas em tons de rosa, determinísticas pelo nome. */
function CoverPattern({ seed }: { seed: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = (n: number) => ((h >>> (n * 3)) % 100) / 100;
  const tones = ["#F4C2D7", "#E9A8C2", "#D98BAA", "#FCE4EC", "#B76E8C"];
  return (
    <svg viewBox="0 0 320 128" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={40 + r(i) * 260} cy={20 + r(i + 4) * 100} r={26 + r(i + 2) * 40} fill={tones[(h + i) % tones.length]} opacity={0.55 - i * 0.08} />
      ))}
    </svg>
  );
}
