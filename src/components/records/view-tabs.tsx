import Link from "next/link";
import { cx } from "@/components/ui/primitives";

/** Abas de navegação via querystring (ex.: Ativos · Arquivados). */
export function QueryTabs({
  base,
  param,
  current,
  tabs,
  keep = {},
}: {
  base: string;
  param: string;
  current: string;
  tabs: { value: string; label: string; count?: number; muted?: boolean }[];
  keep?: Record<string, string | undefined>;
}) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Seções">
      {tabs.map((t) => {
        const qs = new URLSearchParams();
        Object.entries(keep).forEach(([k, v]) => v && qs.set(k, v));
        if (t.value) qs.set(param, t.value);
        const href = `${base}${qs.toString() ? `?${qs}` : ""}`;
        const active = current === t.value;
        return (
          <Link
            key={t.value || "_"}
            href={href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors",
              active ? "bg-ink text-white" : "text-ink-soft hover:bg-blush hover:text-ink",
              t.muted && !active && "opacity-70",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={cx("text-[12px] tabular", active ? "text-white/70" : "text-ink-soft/70")}>{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
