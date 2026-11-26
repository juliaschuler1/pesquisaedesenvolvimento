"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/session";
import { isUuid, str } from "@/lib/forms";
import { isFile, uploadToStorage, validateFile } from "@/lib/storage";
import { THEME_KEYS, isHex } from "@/lib/theme";
import { ICONS } from "@/components/ui/icon";
import type { ActionResult } from "@/components/ui/interactive";

async function requireAdmin() {
  const s = await getSession();
  if (!isAdmin(s)) throw new Error("Apenas administradores podem alterar esta configuração.");
  return s;
}

/* ------------------------------ Identidade visual ------------------------------ */

export async function saveBranding(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await requireAdmin();
  const supabase = await createClient();
  const theme: Record<string, string> = {};
  for (const { key } of THEME_KEYS) {
    const v = str(fd, `color_${key}`, 7);
    if (v && isHex(v)) theme[key] = v.toUpperCase();
  }
  const tz = str(fd, "timezone", 60) ?? "America/Sao_Paulo";
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
  } catch {
    return { ok: false, message: "Fuso horário inválido.", errors: { timezone: "Use um nome IANA, ex.: America/Sao_Paulo" } };
  }
  const patch: Record<string, unknown> = {
    brand_name: str(fd, "brand_name", 80) ?? "Beauty Development Studio",
    tagline: str(fd, "tagline", 120),
    theme: fd.get("reset_colors") === "on" ? {} : theme,
    timezone: tz,
    updated_at: new Date().toISOString(),
  };
  const logo = fd.get("logo");
  if (isFile(logo)) {
    const err = validateFile(logo, "image");
    if (err) return { ok: false, message: err, errors: { logo: err } };
    patch.logo_path = await uploadToStorage(supabase, s.orgId, "branding", s.orgId, logo);
  }
  if (fd.get("remove_logo") === "on") patch.logo_path = null;
  const { error } = await supabase.from("org_settings").update(patch).eq("org_id", s.orgId);
  if (error) return { ok: false, message: "Não foi possível salvar a identidade visual." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Identidade visual atualizada." };
}

/* ------------------------------ Dados demonstrativos ------------------------------ */

export async function loadDemo(): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("load_demo_data");
  if (error) return { ok: false, message: "Não foi possível carregar os dados demonstrativos." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Dados demonstrativos carregados (marcados com [DEMO])." };
}

export async function removeDemo(): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_demo_data");
  if (error) return { ok: false, message: "Não foi possível remover os dados demonstrativos." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Dados demonstrativos removidos. Seus registros reais foram mantidos." };
}

/* ----------------------------------- Opções ----------------------------------- */

export async function renameOption(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  const label = str(fd, "label", 120);
  if (!isUuid(id) || !label) return { ok: false, message: "Informe o novo nome." };
  const supabase = await createClient();
  const { error } = await supabase.from("options").update({ label }).eq("id", id);
  if (error) return { ok: false, message: error.code === "23505" ? "Já existe uma opção com esse nome." : "Não foi possível renomear." };
  revalidatePath("/categorias");
  return { ok: true, message: "Opção renomeada. Registros existentes mantêm o texto anterior." };
}

export async function toggleOptionArchived(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Opção inválida." };
  const supabase = await createClient();
  const { data: o } = await supabase.from("options").select("archived_at").eq("id", id).single();
  const { error } = await supabase.from("options").update({ archived_at: o?.archived_at ? null : new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: "Não foi possível atualizar." };
  revalidatePath("/categorias");
  return { ok: true, message: o?.archived_at ? "Opção reativada." : "Opção arquivada (não aparece mais nas seleções)." };
}

export async function moveOption(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  const dir = fd.get("dir") === "up" ? "up" : "down";
  if (!isUuid(id)) return { ok: false };
  const supabase = await createClient();
  const { data: o } = await supabase.from("options").select("id, set_id, position").eq("id", id).single();
  if (!o) return { ok: false };
  const { data: other } = await supabase
    .from("options")
    .select("id, position")
    .eq("set_id", o.set_id)
    .filter("position", dir === "up" ? "lt" : "gt", o.position)
    .order("position", { ascending: dir === "down" })
    .limit(1)
    .maybeSingle();
  if (other) {
    await supabase.from("options").update({ position: other.position }).eq("id", o.id);
    await supabase.from("options").update({ position: o.position }).eq("id", other.id);
  }
  revalidatePath("/categorias");
  return { ok: true };
}

export async function createOptionSet(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const label = str(fd, "label", 80);
  if (!label) return { ok: false, message: "Informe o nome da lista." };
  const key = "custom_" + label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const supabase = await createClient();
  const { error } = await supabase.from("option_sets").insert({ key, label, description: str(fd, "description", 300) });
  if (error) return { ok: false, message: error.code === "23505" ? "Já existe uma lista com esse nome." : "Não foi possível criar a lista." };
  revalidatePath("/categorias");
  return { ok: true, message: `Lista “${label}” criada.` };
}

/* ------------------------------ Menu e módulos ------------------------------ */

export async function updateModule(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  const op = String(fd.get("op"));
  if (!isUuid(id)) return { ok: false, message: "Módulo inválido." };
  const supabase = await createClient();
  const { data: m } = await supabase.from("modules").select("id, key, group_id, position, visible, kind").eq("id", id).single();
  if (!m) return { ok: false, message: "Módulo não encontrado." };
  if (op === "toggle") {
    if (["dashboard", "configuracoes", "construtor-modulos"].includes(m.key) && m.visible) return { ok: false, message: "Este módulo é essencial e não pode ser ocultado." };
    await supabase.from("modules").update({ visible: !m.visible }).eq("id", id);
  } else if (op === "up" || op === "down") {
    const { data: other } = await supabase
      .from("modules")
      .select("id, position")
      .eq("group_id", m.group_id)
      .filter("position", op === "up" ? "lt" : "gt", m.position)
      .order("position", { ascending: op === "down" })
      .limit(1)
      .maybeSingle();
    if (other) {
      await supabase.from("modules").update({ position: other.position }).eq("id", m.id);
      await supabase.from("modules").update({ position: m.position }).eq("id", other.id);
    }
  } else if (op === "rename") {
    const label = str(fd, "label", 60);
    if (!label) return { ok: false, message: "Informe o nome." };
    await supabase.from("modules").update({ label }).eq("id", id);
  } else if (op === "group") {
    const groupId = fd.get("group_id");
    if (!isUuid(groupId)) return { ok: false, message: "Grupo inválido." };
    const { data: last } = await supabase.from("modules").select("position").eq("group_id", groupId).order("position", { ascending: false }).limit(1).maybeSingle();
    await supabase.from("modules").update({ group_id: groupId, position: (last?.position ?? 0) + 1 }).eq("id", id);
  } else if (op === "delete") {
    if (m.kind !== "custom") return { ok: false, message: "Módulos do sistema podem ser ocultados, não excluídos." };
    const { count } = await supabase.from("custom_records").select("id", { count: "exact", head: true }).eq("module_id", id).is("deleted_at", null);
    if ((count ?? 0) > 0) return { ok: false, message: `O módulo tem ${count} registro(s). Exclua-os antes ou apenas oculte o módulo.` };
    await supabase.from("modules").delete().eq("id", id);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: op === "toggle" ? (m.visible ? "Módulo ocultado do menu." : "Módulo exibido no menu.") : op === "delete" ? "Módulo excluído." : undefined };
}

export async function createModule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const label = str(fd, "label", 60);
  const groupId = fd.get("group_id");
  const icon = str(fd, "icon", 40) ?? "Sparkles";
  const view = str(fd, "default_view", 20) ?? "table";
  const scope = str(fd, "scope", 20) ?? "global";
  if (!label) return { ok: false, message: "Informe o nome do módulo.", errors: { label: "Obrigatório" } };
  if (!isUuid(groupId)) return { ok: false, message: "Escolha o grupo do menu.", errors: { group_id: "Obrigatório" } };
  if (!(icon in ICONS)) return { ok: false, message: "Ícone inválido." };
  if (!["table", "cards", "checklist", "kanban", "gallery", "calendar"].includes(view)) return { ok: false, message: "Visualização inválida." };
  if (!["global", "client", "project"].includes(scope)) return { ok: false, message: "Escopo inválido." };
  const key = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  if (!key) return { ok: false, message: "Use letras ou números no nome." };
  const supabase = await createClient();
  const { data: last } = await supabase.from("modules").select("position").eq("group_id", groupId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("modules").insert({
    key,
    label,
    icon,
    group_id: groupId,
    kind: "custom",
    availability: "available",
    default_view: view,
    scope,
    description: str(fd, "description", 300),
    position: (last?.position ?? 0) + 1,
  });
  if (error) return { ok: false, message: error.code === "23505" ? "Já existe um módulo com esse nome." : "Não foi possível criar o módulo." };
  revalidatePath("/", "layout");
  redirect(`/${key}?configurar=1`);
}

/* ------------------------------ Campos personalizados ------------------------------ */

const FIELD_TYPES = ["short_text", "long_text", "number", "currency", "percent", "date", "single_select", "multi_select", "checkbox", "link"] as const;

export async function saveCustomField(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const entity = str(fd, "entity", 80);
  const label = str(fd, "label", 80);
  const type = str(fd, "field_type", 30);
  if (!entity || !/^(clients|projects|skus|module:[a-z0-9-]+)$/.test(entity)) return { ok: false, message: "Entidade inválida." };
  if (!label) return { ok: false, message: "Informe o nome do campo.", errors: { label: "Obrigatório" } };
  if (!type || !(FIELD_TYPES as readonly string[]).includes(type)) return { ok: false, message: "Tipo de campo inválido." };
  const choices = (str(fd, "choices", 3000) ?? "").split(/\n|;/).map((x) => x.trim()).filter(Boolean);
  if ((type === "single_select" || type === "multi_select") && choices.length === 0) return { ok: false, message: "Informe as opções (uma por linha).", errors: { choices: "Obrigatório" } };
  const key = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50) || "campo";
  const supabase = await createClient();
  const { data: last } = await supabase.from("custom_fields").select("position").eq("entity", entity).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("custom_fields").insert({
    entity,
    key,
    label,
    field_type: type,
    required: fd.get("required") === "on",
    section: str(fd, "section", 80),
    visibility: fd.get("visibility") === "shareable" ? "shareable" : "internal",
    settings: choices.length ? { choices } : {},
    position: (last?.position ?? 0) + 1,
  });
  if (error) return { ok: false, message: error.code === "23505" ? "Já existe um campo com esse nome." : "Não foi possível criar o campo." };
  revalidatePath("/", "layout");
  return { ok: true, message: `Campo “${label}” criado.` };
}

export async function archiveCustomField(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Campo inválido." };
  const supabase = await createClient();
  const { data: f } = await supabase.from("custom_fields").select("archived_at").eq("id", id).single();
  const { error } = await supabase.from("custom_fields").update({ archived_at: f?.archived_at ? null : new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: "Não foi possível atualizar o campo." };
  revalidatePath("/", "layout");
  return { ok: true, message: f?.archived_at ? "Campo reativado." : "Campo arquivado. Os valores já preenchidos foram preservados." };
}
