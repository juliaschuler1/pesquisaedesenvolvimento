"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid, str } from "@/lib/forms";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { readCustomData } from "@/lib/custom-fields";
import type { ActionResult } from "@/components/ui/interactive";

export async function saveCustomRecord(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const moduleId = fd.get("module_id");
  const moduleKey = str(fd, "module_key", 60);
  const id = fd.get("id");
  const title = str(fd, "title", 300);
  if (!isUuid(moduleId) || !moduleKey) return { ok: false, message: "Módulo inválido." };
  if (!title) return { ok: false, message: "Informe o título.", errors: { title: "Obrigatório" } };
  const supabase = await createClient();
  const fields = await loadCustomFields(`module:${moduleKey}`);
  let previous: Record<string, unknown> = {};
  if (isUuid(id)) {
    const { data } = await supabase.from("custom_records").select("data").eq("id", id).single();
    previous = (data?.data as Record<string, unknown>) ?? {};
  }
  const { data, errors } = readCustomData(fd, fields, previous);
  if (Object.keys(errors).length) return { ok: false, message: "Revise os campos destacados.", errors };
  const clientId = str(fd, "client_id");
  const projectId = str(fd, "project_id");
  const row = {
    module_id: moduleId,
    title,
    status: str(fd, "status", 60),
    data,
    client_id: isUuid(clientId) ? clientId : null,
    project_id: isUuid(projectId) ? projectId : null,
  };
  const { error } = isUuid(id) ? await supabase.from("custom_records").update(row).eq("id", id) : await supabase.from("custom_records").insert(row);
  if (error) return { ok: false, message: "Não foi possível salvar o registro." };
  revalidatePath(`/${moduleKey}`);
  return { ok: true, message: isUuid(id) ? "Registro atualizado." : "Registro criado." };
}

export async function toggleRecordDone(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  const key = str(fd, "module_key", 60);
  if (!isUuid(id) || !key) return { ok: false };
  const supabase = await createClient();
  const { data: r } = await supabase.from("custom_records").select("status").eq("id", id).single();
  await supabase.from("custom_records").update({ status: r?.status === "done" ? null : "done" }).eq("id", id);
  revalidatePath(`/${key}`);
  return { ok: true };
}
