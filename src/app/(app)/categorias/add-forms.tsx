"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { addOption } from "@/lib/actions/common";
import { createOptionSet } from "@/lib/actions/admin";
import { Field, Input } from "@/components/ui/primitives";
import { SubmitButton, useActionToast, useToast } from "@/components/ui/interactive";

export function AddOptionInline({ setKey }: { setKey: string }) {
  const [v, setV] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <form
      className="flex items-center gap-2 border-t border-blush px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        start(async () => {
          const res = await addOption(setKey, v);
          if (res?.message) toast(res.ok ? "success" : "error", res.message);
          if (res?.ok) setV("");
        });
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="+ Adicionar nova opção" className="h-8 flex-1 rounded-lg px-2 text-[13.5px] placeholder:text-deep/70 focus:bg-white focus:ring-1 focus:ring-pastel focus:outline-none" aria-label="Nova opção" />
      {pending && <Loader2 size={14} className="animate-spin text-ink-soft" />}
    </form>
  );
}

export function NewSetForm() {
  const [state, action] = useActionState(createOptionSet, null);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-col gap-3 p-5">
      <Field label="Nome da lista" htmlFor="set-label">
        <Input id="set-label" name="label" placeholder="Ex.: Famílias olfativas" required />
      </Field>
      <Field label="Descrição" htmlFor="set-desc">
        <Input id="set-desc" name="description" />
      </Field>
      <SubmitButton icon="Plus">Criar lista</SubmitButton>
    </form>
  );
}
