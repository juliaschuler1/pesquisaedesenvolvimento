"use client";

import { useActionState, useEffect, useState } from "react";
import { saveActivity } from "@/lib/actions/activities";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, SubmitButton, useActionToast } from "@/components/ui/interactive";
import { ACTIVITY_KIND, ACTIVITY_STATUS, PRIORITY, options, type ActivityKind } from "@/lib/domain";

export type ActivityDraft = {
  id?: string;
  title?: string;
  kind?: ActivityKind;
  description?: string | null;
  priority?: string;
  status?: string;
  starts_at?: string | null; // "YYYY-MM-DDTHH:mm" local
  due_at?: string | null;
  location?: string | null;
  owner?: string | null;
  visibility?: string;
  project_id?: string | null;
  client_id?: string | null;
};

export function ActivityDialogButton({
  label = "Nova atividade",
  icon = "Plus",
  variant = "primary",
  size = "md",
  draft,
  projects,
  autoOpen,
}: {
  label?: string;
  icon?: string;
  variant?: "primary" | "secondary" | "soft" | "ghost";
  size?: "sm" | "md";
  draft?: ActivityDraft;
  projects?: { id: string; name: string; client_name: string }[];
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={draft?.id ? "Editar atividade" : label} wide>
        <ActivityForm draft={draft} projects={projects} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function ActivityForm({ draft, projects, onDone }: { draft?: ActivityDraft; projects?: { id: string; name: string; client_name: string }[]; onDone: () => void }) {
  const [state, action] = useActionState(saveActivity, null);
  useActionToast(state);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const [kind, setKind] = useState<ActivityKind>(draft?.kind ?? "task");
  const scheduled = kind === "meeting" || kind === "technical_visit";

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {draft?.id && <input type="hidden" name="id" value={draft.id} />}
      {draft?.client_id && <input type="hidden" name="client_id" value={draft.client_id} />}
      <Field label="Título" required className="md:col-span-2" error={state?.errors?.title} htmlFor="act-title">
        <Input id="act-title" name="title" defaultValue={draft?.title ?? ""} required autoFocus />
      </Field>
      <Field label="Tipo" htmlFor="act-kind">
        <Select id="act-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)} options={options(ACTIVITY_KIND)} />
      </Field>
      {projects ? (
        <Field label="Projeto" htmlFor="act-project">
          <Select
            id="act-project"
            name="project_id"
            defaultValue={draft?.project_id ?? ""}
            placeholder="Sem projeto"
            options={projects.map((p) => ({ value: p.id, label: `${p.name} — ${p.client_name}` }))}
          />
        </Field>
      ) : (
        draft?.project_id && <input type="hidden" name="project_id" value={draft.project_id} />
      )}
      {scheduled && (
        <Field label="Início" htmlFor="act-start" hint="Data e hora no fuso do workspace">
          <Input id="act-start" type="datetime-local" name="starts_at" defaultValue={draft?.starts_at ?? ""} />
        </Field>
      )}
      <Field label={scheduled ? "Término" : "Prazo"} htmlFor="act-due">
        <Input id="act-due" type="datetime-local" name="due_at" defaultValue={draft?.due_at ?? ""} />
      </Field>
      <Field label="Prioridade" htmlFor="act-priority">
        <Select id="act-priority" name="priority" defaultValue={draft?.priority ?? "medium"} options={options(PRIORITY)} />
      </Field>
      <Field label="Status" htmlFor="act-status">
        <Select id="act-status" name="status" defaultValue={draft?.status ?? "pending"} options={options(ACTIVITY_STATUS)} />
      </Field>
      {scheduled && (
        <Field label="Local" htmlFor="act-location">
          <Input id="act-location" name="location" defaultValue={draft?.location ?? ""} placeholder="Online, fábrica, escritório…" />
        </Field>
      )}
      <Field label="Responsável" htmlFor="act-owner">
        <Input id="act-owner" name="owner" defaultValue={draft?.owner ?? ""} />
      </Field>
      <Field label="Descrição" className="md:col-span-2" htmlFor="act-desc">
        <Textarea id="act-desc" name="description" defaultValue={draft?.description ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-ink md:col-span-2">
        <input type="checkbox" name="visibility" value="shareable" defaultChecked={draft?.visibility === "shareable"} className="accent-[var(--brand-deep)]" />
        Compartilhável com a cliente (pode aparecer em relatórios)
      </label>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <SubmitButton>{draft?.id ? "Salvar atividade" : "Criar atividade"}</SubmitButton>
      </div>
    </form>
  );
}
