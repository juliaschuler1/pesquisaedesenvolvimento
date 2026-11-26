import Link from "next/link";

/**
 * Barras horizontais de série única (magnitude): uma cor, valor escrito ao lado,
 * cada barra é um link para os registros correspondentes.
 */
export function HBars({
  data,
  hrefFor,
  emptyText,
}: {
  data: { label: string; value: number }[];
  hrefFor?: (label: string) => string | null;
  emptyText: string;
}) {
  if (data.length === 0) return <p className="px-5 pb-6 text-[13px] text-ink-soft">{emptyText}</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="flex flex-col gap-2.5 px-5 pb-5">
      {data.map((d) => {
        const href = hrefFor?.(d.label);
        const body = (
          <>
            <span className="w-[42%] shrink-0 truncate text-[13px] text-ink" title={d.label}>
              {d.label}
            </span>
            <span className="relative h-5 flex-1">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] rounded-l-[2px] bg-mid transition-colors group-hover:bg-deep"
                style={{ width: `${Math.max((d.value / max) * 100, 3)}%` }}
              />
            </span>
            <span className="w-7 text-right text-[13px] font-medium text-ink tabular">{d.value}</span>
          </>
        );
        return (
          <li key={d.label}>
            {href ? (
              <Link href={href} className="group flex items-center gap-3 rounded-lg" title={`${d.label}: ${d.value}`}>
                {body}
              </Link>
            ) : (
              <div className="group flex items-center gap-3" title={`${d.label}: ${d.value}`}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
