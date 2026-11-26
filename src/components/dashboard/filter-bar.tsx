"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { cx } from "@/components/ui/primitives";

export type FilterDef = { name: string; label: string; options: { value: string; label: string }[] };

/** Filtros em uma única linha; cada mudança atualiza a URL (compartilhável e preservada ao voltar). */
export function FilterBar({ filters }: { filters: FilterDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const active = filters.filter((f) => params.get(f.name));

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
      {filters.map((f) => {
        const v = params.get(f.name) ?? "";
        return (
          <label key={f.name} className="relative">
            <span className="sr-only">{f.label}</span>
            <select
              value={v}
              onChange={(e) => set(f.name, e.target.value)}
              className={cx(
                "h-9 appearance-none rounded-full border pr-8 pl-3.5 text-[13px] transition-colors focus:outline-none focus:ring-3 focus:ring-pastel/50",
                v ? "border-deep bg-blush font-medium text-ink" : "border-blush bg-white text-ink-soft hover:border-pastel",
              )}
            >
              <option value="">{f.label}: todos</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {f.label}: {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-ink-soft">▼</span>
          </label>
        );
      })}
      {active.length > 0 && (
        <button
          onClick={() => start(() => router.replace(pathname, { scroll: false }))}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] text-deep hover:bg-blush"
        >
          <X size={14} /> Limpar filtros
        </button>
      )}
      {pending && <Loader2 size={16} className="animate-spin text-ink-soft" aria-label="Atualizando" />}
    </div>
  );
}
