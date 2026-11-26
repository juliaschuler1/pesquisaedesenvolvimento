"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";

/** Busca local da lista, sincronizada com ?q= na URL. */
export function SearchBox({ placeholder }: { placeholder: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      start(() => router.replace(`${pathname}?${next}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
  }, [q, params, pathname, router]);

  return (
    <label className="relative block w-full md:w-72">
      <span className="sr-only">{placeholder}</span>
      {pending ? (
        <Loader2 size={16} className="absolute top-1/2 left-3 -translate-y-1/2 animate-spin text-ink-soft" />
      ) : (
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-soft" />
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-full border border-blush bg-white pr-3 pl-9 text-[13.5px] text-ink placeholder:text-ink-soft/70 focus:border-mid focus:outline-none focus:ring-3 focus:ring-pastel/40"
      />
    </label>
  );
}
