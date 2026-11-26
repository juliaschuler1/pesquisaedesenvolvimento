"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/components/ui/interactive";

/** "+ Adicionar nova opção": inclui um item numa lista editável (texturas, claims, categorias…). */
export async function addOption(setKey: string, label: string): Promise<ActionResult> {
  const clean = label.trim();
  if (!clean) return { ok: false, message: "Digite o nome da opção." };
  if (clean.length > 120) return { ok: false, message: "Use até 120 caracteres." };
  const supabase = await createClient();
  const { data: set } = await supabase.from("option_sets").select("id").eq("key", setKey).maybeSingle();
  if (!set) return { ok: false, message: "Lista de opções não encontrada." };
  const { data: last } = await supabase
    .from("options")
    .select("position")
    .eq("set_id", set.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("options").insert({ set_id: set.id, label: clean, position: (last?.position ?? 0) + 1 });
  if (error) {
    if (error.code === "23505") return { ok: true, message: `“${clean}” já existe na lista.` };
    return { ok: false, message: "Não foi possível adicionar a opção." };
  }
  revalidatePath("/categorias");
  return { ok: true, message: `“${clean}” adicionada à lista.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type SearchHit = { entity_type: string; id: string; title: string; subtitle: string | null; href: string };

export async function searchEverything(q: string): Promise<SearchHit[]> {
  if (!q || q.trim().length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("global_search", { q: q.slice(0, 80), max_results: 12 });
  return (data ?? []) as SearchHit[];
}
