import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Projetos em aberto para seletores (atividades, etc.). */
export async function projectChoices() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, clients(name)")
    .is("deleted_at", null)
    .is("archived_at", null)
    .not("status", "in", "(completed,cancelled)")
    .order("name");
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, client_name: (p.clients as unknown as { name: string } | null)?.name ?? "" }));
}
