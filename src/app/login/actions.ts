"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string } | null;

const schema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  fullName: z.string().trim().max(120).optional(),
});

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos." };
  redirect(safeNext(fd.get("next")));
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = schema.safeParse({
    email: fd.get("email"),
    password: fd.get("password"),
    fullName: fd.get("fullName") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName ?? "" } },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) return { error: "Este e-mail já tem cadastro. Use “Entrar”." };
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }
  if (!data.session) {
    return { info: "Conta criada. Confirme seu e-mail pelo link enviado e depois entre." };
  }
  redirect("/bem-vinda");
}
