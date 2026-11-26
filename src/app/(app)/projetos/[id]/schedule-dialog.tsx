"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { previewReschedule, saveScheduleItem, type ScheduleImpact } from "../actions";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, SubmitButton, useActionToast } from "@/components/ui/interactive";
import { PRIORITY, options, type ScheduleItemRow } from "@/lib/domain";
import { formatDate } from "@/lib/format";

export function ScheduleItemButton({
  projectId,
  item,
  siblings,
  label,
  icon,
  variant = "ghost",
  size = "sm",
}: {
  projectId: string;
  item?: ScheduleItemRow;
  siblings: { id: string; name: string }[];
  label: string;
  icon: string;
  variant?: "ghost" | "primary" | "secondary";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={() => setOpen(true)} aria-label={label} title={label} className={!label ? "!px-2" : undefined}>
        {variant === "ghost" && item ? null : label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={item ? item.name : "Nova etapa"} description={item ? "Alterar datas mostra o impacto nas etapas dependentes antes de reprogramar." : undefined} wide>
        <ScheduleForm projectId={projectId} item={item} siblings={siblings} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function ScheduleForm({ projectId, item, siblings, onDone }: { projectId: string; item?: ScheduleItemRow; siblings: { id: string; name: string }[]; onDone: () => void }) {
  const [state, action] = useActionState(saveScheduleItem, null);
  useActionToast(state);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const [start, setStart] = useState(item?.planned_start ?? "");
  const [end, setEnd] = useState(item?.planned_end ?? "");
  const [impactState, setImpactState] = useState<{ key: string; value: ScheduleImpact } | null>(null);
  const impactKey = `${start}|${end}`;
  const impact = impactState?.key === impactKey ? impactState.value : null;
  const [cascade, setCascade] = useState(false);
  const [pending, startT] = useTransition();
  const datesChanged = item && (start !== (item.planned_start ?? "") || end !== (item.planned_end ?? ""));

  useEffect(() => {
    if (!item || !datesChanged) return;
    const key = `${start}|${end}`;
    const t = setTimeout(
      () => startT(async () => setImpactState({ key, value: await previewReschedule({ projectId, itemId: item.id, start: start || null, end: end || null }) })),
      250,
    );
    return () => clearTimeout(t);
  }, [start, end, item, projectId, datesChanged]);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="project_id" value={projectId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Nome da etapa" required className="md:col-span-2" error={state?.errors?.name} htmlFor="st-name">
        <Input id="st-name" name="name" defaultValue={item?.name ?? ""} required />
      </Field>
      <Field label="Início previsto" htmlFor="st-start" hint={item?.baseline_start && item.baseline_start !== start ? `Original: ${formatDate(item.baseline_start)}` : undefined}>
        <Input id="st-start" type="date" name="planned_start" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="Término previsto" error={state?.errors?.planned_end} htmlFor="st-end" hint={item?.baseline_end && item.baseline_end !== end ? `Original: ${formatDate(item.baseline_end)}` : undefined}>
        <Input id="st-end" type="date" name="planned_end" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      {item && (
        <>
          <Field label="Início real" htmlFor="st-astart">
            <Input id="st-astart" type="date" name="actual_start" defaultValue={item.actual_start ?? ""} />
          </Field>
          <Field label="Término real" htmlFor="st-aend">
            <Input id="st-aend" type="date" name="actual_end" defaultValue={item.actual_end ?? ""} />
          </Field>
        </>
      )}
      <Field label="Peso no progresso" htmlFor="st-weight" hint="Etapas mais longas ou críticas podem pesar mais.">
        <Input id="st-weight" name="weight" inputMode="decimal" defaultValue={item?.weight ?? 1} />
      </Field>
      <Field label="Prioridade" htmlFor="st-priority">
        <Select id="st-priority" name="priority" defaultValue="" placeholder="Sem prioridade" options={options(PRIORITY)} />
      </Field>
      <Field label="Responsável" htmlFor="st-owner">
        <Input id="st-owner" name="owner" defaultValue={item?.owner ?? ""} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2.5 text-[13.5px] text-ink">
        <input type="checkbox" name="is_milestone" defaultChecked={item?.is_milestone} className="accent-[var(--brand-deep)]" /> Marco (aprovação, entrega, lançamento)
      </label>
      <Field label="Depende de" className="md:col-span-2" hint="Etapas que precisam terminar antes desta começar. Use Ctrl/Cmd para selecionar várias." htmlFor="st-deps">
        <select id="st-deps" name="depends_on" multiple defaultValue={item?.depends_on ?? []} className="min-h-[96px] w-full rounded-[var(--radius-control)] border border-pastel bg-white px-2 py-2 text-[13.5px] text-ink focus:border-deep focus:outline-none">
          {siblings.filter((s) => s.id !== item?.id).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Observações" className="md:col-span-2" htmlFor="st-notes">
        <Textarea id="st-notes" name="notes" defaultValue={item?.notes ?? ""} />
      </Field>

      {datesChanged && (
        <div className="rounded-2xl bg-warning-bg/70 p-4 md:col-span-2" role="status">
          {pending || impact === null ? (
            <p className="flex items-center gap-2 text-[13px] text-warning"><Loader2 size={14} className="animate-spin" /> Calculando impacto nas etapas dependentes…</p>
          ) : impact.length === 0 ? (
            <p className="text-[13px] text-ink">A mudança não afeta outras etapas.</p>
          ) : (
            <>
              <p className="text-[13.5px] font-medium text-ink">
                {impact.length === 1 ? "1 etapa dependente seria reprogramada:" : `${impact.length} etapas dependentes seriam reprogramadas:`}
              </p>
              <ul className="mt-2 max-h-40 overflow-y-auto text-[12.5px] text-ink-soft">
                {impact.map((c) => (
                  <li key={c.id} className="py-0.5">
                    <span className="text-ink">{c.name}</span>: {formatDate(c.from_start)}–{formatDate(c.from_end)} → {formatDate(c.to_start)}–{formatDate(c.to_end)}
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex items-center gap-2 text-[13.5px] text-ink">
                <input type="checkbox" name="cascade" checked={cascade} onChange={(e) => setCascade(e.target.checked)} className="accent-[var(--brand-deep)]" />
                Confirmo: reprogramar as etapas dependentes
              </label>
              <p className="mt-1 text-[12px] text-ink-soft">As datas originais ficam preservadas para comparação.</p>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <SubmitButton>{item ? "Salvar etapa" : "Adicionar etapa"}</SubmitButton>
      </div>
    </form>
  );
}
