"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { dateStr, isUuid, list, str } from "@/lib/forms";
import { isFile, uploadToStorage, validateFile } from "@/lib/storage";
import type { ActionResult } from "@/components/ui/interactive";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { readCustomData } from "@/lib/custom-fields";

export type ClientFormState = ActionResult;

function readClient(fd: FormData) {
  const social: Record<string, string> = {};
  for (const k of ["instagram", "tiktok", "linkedin", "outra"]) {
    const v = str(fd, `social_${k}`, 300);
    if (v) social[k] = v;
  }
  return {
    name: str(fd, "name", 200),
    brand_name: str(fd, "brand_name", 200),
    cnpj: str(fd, "cnpj", 30),
    email: str(fd, "email", 200),
    phone: str(fd, "phone", 40),
    whatsapp: str(fd, "whatsapp", 40),
    website: str(fd, "website", 300),
    social,
    segment: str(fd, "segment", 120),
    positioning: str(fd, "positioning"),
    target_audience: str(fd, "target_audience"),
    sales_channels: list(fd, "sales_channels"),
    commercial_info: str(fd, "commercial_info"),
    consulting_started_on: dateStr(fd, "consulting_started_on"),
    notes: str(fd, "notes"),
    private_notes: str(fd, "private_notes"),
  };
}

function validate(c: ReturnType<typeof readClient>) {
  const errors: Record<string, string> = {};
  if (!c.name) errors.name = "Informe o nome do cliente.";
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) errors.email = "E-mail inválido.";
  if (c.cnpj && c.cnpj.replace(/\D/g, "").length !== 14) errors.cnpj = "O CNPJ deve ter 14 dígitos.";
  if (c.website && !/^https?:\/\//i.test(c.website)) c.website = `https://${c.website}`;
  return errors;
}

export async function saveClient(_: ClientFormState, fd: FormData): Promise<ClientFormState> {
  const s = await getSession();
  const supabase = await createClient();
  const id = fd.get("id");
  const data = readClient(fd);
  const errors = validate(data);
  const logo = fd.get("logo");
  if (isFile(logo)) {
    const err = validateFile(logo, "image");
    if (err) errors.logo = err;
  }
  const fields = await loadCustomFields("clients");
  let previous: Record<string, unknown> = {};
  if (isUuid(id)) {
    const { data: cur } = await supabase.from("clients").select("custom_data").eq("id", id).single();
    previous = (cur?.custom_data as Record<string, unknown>) ?? {};
  }
  const custom = readCustomData(fd, fields, previous);
  Object.assign(errors, custom.errors);
  if (Object.keys(errors).length) return { ok: false, message: "Revise os campos destacados.", errors };
  const row = { ...data, custom_data: custom.data };

  let clientId: string;
  if (isUuid(id)) {
    const { error } = await supabase.from("clients").update(row).eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar o cliente." };
    clientId = id;
  } else {
    const { data: created, error } = await supabase.from("clients").insert(row).select("id").single();
    if (error || !created) return { ok: false, message: "Não foi possível criar o cliente." };
    clientId = created.id;
  }

  if (isFile(logo)) {
    try {
      const path = await uploadToStorage(supabase, s.orgId, "clients", clientId, logo);
      await supabase.from("clients").update({ logo_path: path }).eq("id", clientId);
    } catch {
      return { ok: false, message: "Cliente salvo, mas a logo não pôde ser enviada." };
    }
  }
  if (fd.get("remove_logo") === "on") {
    await supabase.from("clients").update({ logo_path: null }).eq("id", clientId);
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${clientId}?salvo=1`);
}

export async function duplicateClient(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Registro inválido." };
  const supabase = await createClient();
  const { data: c } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!c) return { ok: false, message: "Cliente não encontrado." };
  const { id: _omit, created_at, updated_at, archived_at, deleted_at, created_by, is_demo, ...rest } = c;
  void _omit; void created_at; void updated_at; void archived_at; void deleted_at; void created_by; void is_demo;
  const { data: row, error } = await supabase.from("clients").insert({ ...rest, name: `${c.name} (cópia)` }).select("id").single();
  if (error || !row) return { ok: false, message: "Não foi possível duplicar." };
  revalidatePath("/clientes");
  redirect(`/clientes/${row.id}/editar`);
}

export async function addContact(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const clientId = fd.get("client_id");
  const name = str(fd, "name", 200);
  if (!isUuid(clientId)) return { ok: false, message: "Cliente inválido." };
  if (!name) return { ok: false, message: "Informe o nome do contato.", errors: { name: "Obrigatório" } };
  const supabase = await createClient();
  const { error } = await supabase.from("client_contacts").insert({
    client_id: clientId,
    name,
    role: str(fd, "role", 120),
    email: str(fd, "email", 200),
    phone: str(fd, "phone", 40),
    whatsapp: str(fd, "whatsapp", 40),
    is_primary: fd.get("is_primary") === "on",
  });
  if (error) return { ok: false, message: "Não foi possível adicionar o contato." };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, message: `Contato ${name} adicionado.` };
}

export async function deleteContact(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Contato inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("client_contacts").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível remover o contato." };
  revalidatePath("/clientes", "layout");
  return { ok: true, message: "Contato removido." };
}
