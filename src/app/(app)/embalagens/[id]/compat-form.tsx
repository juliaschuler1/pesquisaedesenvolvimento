"use client";

import { useActionState } from "react";
import { linkCompatible } from "../actions";
import { Field, Input, Select } from "@/components/ui/primitives";
import { SubmitButton, useActionToast } from "@/components/ui/interactive";

export function CompatForm({ itemId, others }: { itemId: string; others: { id: string; label: string }[] }) {
  const [state, action] = useActionState(linkCompatible, null);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-t border-blush p-5">
      <input type="hidden" name="item_id" value={itemId} />
      <Field label="Componente compatível" htmlFor="cp-other" className="min-w-[220px] flex-1">
        <Select id="cp-other" name="other_id" defaultValue="" placeholder="Selecione" options={others.map((o) => ({ value: o.id, label: o.label }))} />
      </Field>
      <Field label="Observação" htmlFor="cp-notes" className="min-w-[180px] flex-1">
        <Input id="cp-notes" name="notes" placeholder="Ex.: testado em 03/2026" />
      </Field>
      <SubmitButton icon="Plus">Adicionar</SubmitButton>
    </form>
  );
}
