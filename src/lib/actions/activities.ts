"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { isUuid, oneOf, str } from "@/lib/forms";
import type { ActionResult } from "@/components/ui/interactive";

const KINDS = ["task", "meeting", "technical_visit", "follow_up", "approval", "deadline", "other"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const STATUSES = ["pending", "in_progress", "done", "cancelled"] as const;

/** Converte "YYYY-MM-DDTHH:mm" digitado no fuso do workspace para ISO com offset. */
function localToISO(v: string | null, tz: string): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h = "09", mi = "00"] = m;
  const asUTC = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  // descobre o deslocamento do fuso naquele instante
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(asUTC));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(asUTC - (shown - asUTC)).toISOString();
}

export async function saveActivity(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  const supabase = await createClient();
  const title = str(fd, "title", 300);
  if (!title) return { ok: false, message: "Informe o título da atividade.", errors: { title: "Obrigatório" } };
  const projectId = str(fd, "project_id");
  let clientId = str(fd, "client_id");
  if (projectId && !isUuid(projectId)) return { ok: false, message: "Projeto inválido." };
  if (projectId) {
    const { data: p } = await supabase.from("projects").select("client_id").eq("id", projectId).single();
    clientId = p?.client_id ?? clientId;
  }
  const kind = oneOf(fd, "kind", KINDS, "task");
  const row = {
    title,
    kind,
    description: str(fd, "description"),
    priority: oneOf(fd, "priority", PRIORITIES, "medium"),
    status: oneOf(fd, "status", STATUSES, "pending"),
    starts_at: localToISO(str(fd, "starts_at"), s.settings.timezone),
    due_at: localToISO(str(fd, "due_at"), s.settings.timezone),
    location: str(fd, "location", 300),
    owner: str(fd, "owner", 120),
    visibility: fd.get("visibility") === "shareable" ? "shareable" : "internal",
    project_id: projectId,
    client_id: clientId && isUuid(clientId) ? clientId : null,
  };
  const id = fd.get("id");
  const { error } = isUuid(id) ? await supabase.from("activities").update(row).eq("id", id) : await supabase.from("activities").insert(row);
  if (error) return { ok: false, message: "Não foi possível salvar a atividade." };
  revalidatePath("/", "layout");
  return { ok: true, message: isUuid(id) ? "Atividade atualizada." : "Atividade criada." };
}

export async function setActivityStatus(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  const status = String(fd.get("status"));
  if (!isUuid(id) || !(STATUSES as readonly string[]).includes(status)) return { ok: false, message: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, message: "Não foi possível atualizar." };
  revalidatePath("/", "layout");
  return { ok: true, message: status === "done" ? "Atividade concluída." : "Atividade reaberta." };
}

export async function deleteActivity(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Atividade inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Atividade excluída." };
}
