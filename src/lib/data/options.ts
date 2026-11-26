import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Carrega listas de opções editáveis por chave: { textures: [...], claims: [...] } */
export async function loadOptionSets(keys: string[]): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("option_sets")
    .select("key, options(label, position, archived_at)")
    .in("key", keys);
  const out: Record<string, string[]> = Object.fromEntries(keys.map((k) => [k, []]));
  for (const s of data ?? []) {
    out[s.key] = ((s.options ?? []) as { label: string; position: number; archived_at: string | null }[])
      .filter((o) => !o.archived_at)
      .sort((a, b) => a.position - b.position)
      .map((o) => o.label);
  }
  return out;
}

/** Tipos de embalagem com imagem ilustrativa. */
export async function loadPackagingTypes(): Promise<{ label: string; image: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("option_sets").select("options(label, image_path, position, archived_at)").eq("key", "packaging_types").maybeSingle();
  return ((data?.options ?? []) as { label: string; image_path: string | null; position: number; archived_at: string | null }[])
    .filter((o) => !o.archived_at)
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ label: o.label, image: o.image_path }));
}
