"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { customizeProjectTabs } from "../actions";
import { Button, Input, PlannedBadge, cx } from "@/components/ui/primitives";
import { Dialog, useToast } from "@/components/ui/interactive";
import { Icon } from "@/components/ui/icon";

type Tab = { key: string; label: string; icon: string; kind: string; availability: string; phase: number | null; visible: boolean };

export function TabsCustomizer({ projectId, tabs }: { projectId: string; tabs: Tab[] }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  const run = (fields: Record<string, string>) =>
    start(async () => {
      const fd = new FormData();
      fd.set("project_id", projectId);
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
      const res = await customizeProjectTabs(fd);
      if (res?.message && (!res.ok || fields.op === "add")) toast(res.ok ? "success" : "error", res.message);
      if (res?.ok && fields.op === "add") setLabel("");
    });

  return (
    <>
      <Button variant="ghost" size="sm" icon="Settings" onClick={() => setOpen(true)}>Personalizar abas</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Abas deste projeto" description="Reorganize, oculte ou crie abas próprias. As alterações valem só para este projeto." wide>
        <ul className="divide-y divide-blush rounded-2xl ring-1 ring-blush">
          {tabs.map((t, i) => (
            <li key={t.key} className={cx("flex items-center gap-3 px-4 py-2.5", !t.visible && "opacity-55")}>
              <Icon name={t.icon} size={16} className="text-deep" />
              <span className="flex-1 text-[14px] text-ink">{t.label}</span>
              {t.availability === "planned" && <PlannedBadge phase={t.phase} />}
              {t.kind === "custom" && <span className="text-[11.5px] text-ink-soft">personalizada</span>}
              <button disabled={pending || i === 0} onClick={() => run({ op: "up", key: t.key })} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush disabled:opacity-30" aria-label={`Mover ${t.label} para cima`}><ArrowUp size={15} /></button>
              <button disabled={pending || i === tabs.length - 1} onClick={() => run({ op: "down", key: t.key })} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush disabled:opacity-30" aria-label={`Mover ${t.label} para baixo`}><ArrowDown size={15} /></button>
              <button disabled={pending || t.key === "visao-geral"} onClick={() => run({ op: "toggle", key: t.key })} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush disabled:opacity-30" aria-label={t.visible ? `Ocultar ${t.label}` : `Mostrar ${t.label}`}>
                {t.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              {t.kind === "custom" && (
                <button disabled={pending} onClick={() => run({ op: "remove", key: t.key })} className="rounded-lg p-1.5 text-danger hover:bg-danger-bg" aria-label={`Excluir aba ${t.label}`}><Trash2 size={15} /></button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (label.trim()) run({ op: "add", label: label.trim() });
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome da nova aba (ex.: Regulatório)" aria-label="Nome da nova aba" />
          <Button type="submit" variant="soft" disabled={pending || !label.trim()}>
            {pending ? <Loader2 size={15} className="animate-spin" /> : null}+ Nova aba
          </Button>
        </form>
      </Dialog>
    </>
  );
}
