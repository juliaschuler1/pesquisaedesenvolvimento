"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, Loader2, Pencil, X } from "lucide-react";
import { moveOption, renameOption, toggleOptionArchived } from "@/lib/actions/admin";
import { useToast } from "@/components/ui/interactive";
import { cx } from "@/components/ui/primitives";

export function OptionRow({ id, label, archived, first, last }: { id: string; label: string; archived: boolean; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = (fn: (fd: FormData) => Promise<{ ok: boolean; message?: string } | null>, extra: Record<string, string> = {}) =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
      const res = await fn(fd);
      if (res?.message) toast(res.ok ? "success" : "error", res.message);
      if (res?.ok) setEditing(false);
    });

  return (
    <li className={cx("group flex items-center gap-1 px-3 py-1.5", archived && "opacity-50")}>
      {editing ? (
        <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); run(renameOption, { label: value }); }}>
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus className="h-8 flex-1 rounded-lg border border-pastel px-2 text-[13.5px] focus:border-deep focus:outline-none" aria-label="Novo nome" />
          <button className="rounded-lg p-1.5 text-success hover:bg-success-bg" aria-label="Salvar"><Check size={14} /></button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush" aria-label="Cancelar"><X size={14} /></button>
        </form>
      ) : (
        <span className={cx("flex-1 text-[13.5px] text-ink", archived && "line-through")}>{label}</span>
      )}
      {pending && <Loader2 size={13} className="animate-spin text-ink-soft" />}
      {!editing && (
        <span className="flex opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush" aria-label={`Renomear ${label}`}><Pencil size={14} /></button>
          <button disabled={first} onClick={() => run(moveOption, { dir: "up" })} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush disabled:opacity-30" aria-label="Mover para cima"><ArrowUp size={14} /></button>
          <button disabled={last} onClick={() => run(moveOption, { dir: "down" })} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush disabled:opacity-30" aria-label="Mover para baixo"><ArrowDown size={14} /></button>
          <button onClick={() => run(toggleOptionArchived)} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush" aria-label={archived ? `Reativar ${label}` : `Arquivar ${label}`}>
            {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
          </button>
        </span>
      )}
    </li>
  );
}
