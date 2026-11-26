"use client";

import { useActionState } from "react";
import { createWorkspace } from "./actions";
import { Field, Input } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";

export function OnboardingForm() {
  const [state, action] = useActionState(createWorkspace, null);
  return (
    <form action={action} className="mt-7 flex flex-col gap-5">
      <Field label="Nome da consultoria" htmlFor="name">
        <Input id="name" name="name" placeholder="Ex.: Studio de Desenvolvimento Cosmético" required autoFocus />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-blush/60 p-4">
        <input type="checkbox" name="demo" className="mt-1 h-4 w-4 accent-[var(--brand-deep)]" />
        <span>
          <span className="block text-[14px] font-medium text-ink">Carregar dados demonstrativos</span>
          <span className="block text-[13px] text-ink-soft">
            Três clientes e quatro projetos fictícios, marcados com “[DEMO]”, para explorar a interface. Você os remove
            com um clique em Configurações.
          </span>
        </span>
      </label>
      {state?.error && <p className="text-[13px] text-danger" role="alert">{state.error}</p>}
      <SubmitButton pendingLabel="Preparando o estúdio…">Criar meu estúdio</SubmitButton>
    </form>
  );
}
