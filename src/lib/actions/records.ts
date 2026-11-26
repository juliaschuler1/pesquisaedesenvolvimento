"use server";

/**
 * Ações genéricas de ciclo de vida (arquivar, restaurar, excluir com lixeira, restaurar da lixeira)
 * para as entidades principais. A RLS garante que só a equipe do workspace altera os registros.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/forms";
import type { ActionResult } from "@/components/ui/interactive";

const TABLES = {
  clients: { table: "clients", label: "Cliente", path: "/clientes" },
  projects: { table: "projects", label: "Projeto", path: "/projetos" },
  skus: { table: "skus", label: "SKU", path: "/projetos" },
  custom_records: { table: "custom_records", label: "Registro", path: "/" },
  suppliers: { table: "suppliers", label: "Fornecedor", path: "/fornecedores" },
  packaging_items: { table: "packaging_items", label: "Embalagem", path: "/embalagens" },
  library_items: { table: "library_items", label: "Item", path: "/" },
} as const;
type Entity = keyof typeof TABLES;

function target(fd: FormData) {
  const entity = String(fd.get("entity")) as Entity;
  const id = fd.get("id");
  if (!(entity in TABLES) || !isUuid(id)) return null;
  return { ...TABLES[entity], entity, id };
}

async function setField(fd: FormData, patch: Record<string, string | null>, done: string): Promise<ActionResult> {
  const t = target(fd);
  if (!t) return { ok: false, message: "Registro inválido." };
  const supabase = await createClient();
  const { error, count } = await supabase.from(t.table).update(patch, { count: "exact" }).eq("id", t.id);
  if (error || count === 0) return { ok: false, message: "Não foi possível concluir a ação." };
  revalidatePath("/", "layout");
  return { ok: true, message: `${t.label} ${done}.` };
}

export async function archiveRecord(fd: FormData) {
  return setField(fd, { archived_at: new Date().toISOString() }, "arquivado");
}
export async function unarchiveRecord(fd: FormData) {
  return setField(fd, { archived_at: null }, "restaurado");
}
/** Exclusão reversível: vai para a lixeira (Configurações → Lixeira). */
export async function trashRecord(fd: FormData) {
  return setField(fd, { deleted_at: new Date().toISOString() }, "movido para a lixeira");
}
export async function restoreRecord(fd: FormData) {
  return setField(fd, { deleted_at: null }, "restaurado da lixeira");
}

/** Exclusão definitiva — só a partir da lixeira. */
export async function purgeRecord(fd: FormData): Promise<ActionResult> {
  const t = target(fd);
  if (!t) return { ok: false, message: "Registro inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from(t.table).delete().eq("id", t.id).not("deleted_at", "is", null);
  if (error) {
    if (error.code === "23503") return { ok: false, message: `${t.label} possui registros vinculados. Exclua-os antes.` };
    return { ok: false, message: "Não foi possível excluir definitivamente." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: `${t.label} excluído definitivamente.` };
}
