"use client";

import { useActionState, useEffect, useState } from "react";
import { saveCustomRecord } from "@/lib/actions/custom-records";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { Dialog, SubmitButton, useActionToast } from "@/components/ui/interactive";
import { CustomFieldInputs } from "@/components/custom-fields/inputs";
import type { CustomField } from "@/lib/custom-fields";

type Rec = { id: string; title: string; data: Record<string, unknown>; client_id: string | null; project_id: string | null };

export function RecordDialogButton({
  moduleId,
  moduleKey,
  scope,
  fields,
  record,
  clients,
  projects,
  label = "Novo registro",
  icon = "Plus",
  variant = "primary",
  size = "md",
}: {
  moduleId: string;
  moduleKey: string;
  scope: string;
  fields: CustomField[];
  record?: Rec;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  label?: string;
  icon?: string;
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={record ? record.title : label} wide>
        <RecordForm {...{ moduleId, moduleKey, scope, fields, record, clients, projects }} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function RecordForm({ moduleId, moduleKey, scope, fields, record, clients, projects, onDone }: { moduleId: string; moduleKey: string; scope: string; fields: CustomField[]; record?: Rec; clients: { id: string; name: string }[]; projects: { id: string; name: string }[]; onDone: () => void }) {
  const [state, action] = useActionState(saveCustomRecord, null);
  useActionToast(state);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="module_id" value={moduleId} />
      <input type="hidden" name="module_key" value={moduleKey} />
      {record && <input type="hidden" name="id" value={record.id} />}
      <Field label="Título" required className="md:col-span-2" htmlFor="rec-title" error={state?.errors?.title}>
        <Input id="rec-title" name="title" defaultValue={record?.title ?? ""} required autoFocus />
      </Field>
      {scope === "client" && (
        <Field label="Cliente" htmlFor="rec-client">
          <Select id="rec-client" name="client_id" defaultValue={record?.client_id ?? ""} placeholder="Sem cliente" options={clients.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
      )}
      {scope === "project" && (
        <Field label="Projeto" htmlFor="rec-project">
          <Select id="rec-project" name="project_id" defaultValue={record?.project_id ?? ""} placeholder="Sem projeto" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
      )}
      <CustomFieldInputs fields={fields} values={record?.data ?? {}} errors={state?.errors ?? {}} />
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <SubmitButton>{record ? "Salvar" : "Criar registro"}</SubmitButton>
      </div>
    </form>
  );
}
