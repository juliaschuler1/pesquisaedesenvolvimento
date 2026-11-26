"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { Field, Input, cx } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction] = useActionState<AuthState, FormData>(signIn, null);
  const [upState, upAction] = useActionState<AuthState, FormData>(signUp, null);
  const state = mode === "in" ? inState : upState;

  return (
    <div>
      <h1 className="font-serif text-[30px] text-ink">{mode === "in" ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-1 text-[14px] text-ink-soft">
        {mode === "in" ? "Acesse o estúdio com seu e-mail e senha." : "O primeiro acesso cria o workspace da sua consultoria."}
      </p>

      <form action={mode === "in" ? inAction : upAction} className="mt-8 flex flex-col gap-4" key={mode}>
        <input type="hidden" name="next" value={next} />
        {mode === "up" && (
          <Field label="Seu nome" htmlFor="fullName">
            <Input id="fullName" name="fullName" autoComplete="name" />
          </Field>
        )}
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Senha" htmlFor="password" hint={mode === "up" ? "Mínimo de 8 caracteres." : undefined}>
          <Input id="password" name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={8} />
        </Field>

        {state?.error && <p className="rounded-xl bg-danger-bg px-3.5 py-2.5 text-[13px] text-danger" role="alert">{state.error}</p>}
        {state?.info && <p className="rounded-xl bg-success-bg px-3.5 py-2.5 text-[13px] text-success" role="status">{state.info}</p>}

        <SubmitButton className="mt-2 w-full" pendingLabel={mode === "in" ? "Entrando…" : "Criando conta…"}>
          {mode === "in" ? "Entrar" : "Criar conta"}
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-soft">
        {mode === "in" ? "Ainda não tem acesso?" : "Já tem uma conta?"}{" "}
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className={cx("font-medium text-deep underline-offset-4 hover:underline")}>
          {mode === "in" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </div>
  );
}
