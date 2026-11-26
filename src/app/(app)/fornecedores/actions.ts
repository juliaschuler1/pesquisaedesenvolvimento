"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { isUuid, list, str } from "@/lib/forms";
import { isFile, uploadToStorage, validateFile } from "@/lib/storage";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { readCustomData } from "@/lib/custom-fields";
import type { ActionResult } from "@/components/ui/interactive";

const QUALITY = ["approved", "approved_conditional", "rejected_conditional", "rejected", "pending"];
const CAP = ["apto", "em_avaliacao", "suspenso", "na"];

function rating(fd: FormData, k: string) {
  const n = Number(fd.get(k));
  return n >= 1 && n <= 5 ? Math.round(n) : null;
}

export async function saveSupplier(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  const supabase = await createClient();
  const id = fd.get("id");
  const errors: Record<string, string> = {};
  const name = str(fd, "name", 200);
  if (!name) errors.name = "Informe o nome do fornecedor.";
  const email = str(fd, "email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "E-mail inválido.";
  const cnpj = str(fd, "cnpj", 30);
  const country = str(fd, "country", 80) ?? "Brasil";
  if (cnpj && country.toLowerCase() === "brasil" && cnpj.replace(/\D/g, "").length !== 14) errors.cnpj = "O CNPJ deve ter 14 dígitos.";
  const year = Number(fd.get("quality_evaluated_year"));
  const logo = fd.get("logo");
  if (isFile(logo)) {
    const e = validateFile(logo, "image");
    if (e) errors.logo = e;
  }
  const fields = await loadCustomFields("suppliers");
  let previous: Record<string, unknown> = {};
  if (isUuid(id)) {
    const { data: cur } = await supabase.from("suppliers").select("custom_data").eq("id", id).single();
    previous = (cur?.custom_data as Record<string, unknown>) ?? {};
  }
  const custom = readCustomData(fd, fields, previous);
  Object.assign(errors, custom.errors);
  if (Object.keys(errors).length) return { ok: false, message: "Revise os campos destacados.", errors };

  let website = str(fd, "website", 300);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  const social: Record<string, string> = {};
  for (const k of ["instagram", "linkedin"]) {
    const v = str(fd, `social_${k}`, 300);
    if (v) social[k] = v;
  }
  const quality = str(fd, "quality_status");
  const row = {
    name,
    legal_name: str(fd, "legal_name", 200),
    cnpj,
    country,
    state: str(fd, "state", 80),
    city: str(fd, "city", 120),
    address: str(fd, "address", 300),
    website,
    social,
    email,
    phone: str(fd, "phone", 40),
    whatsapp: str(fd, "whatsapp", 40),
    categories: list(fd, "categories"),
    product_categories: list(fd, "product_categories"),
    certifications: list(fd, "certifications"),
    technologies: str(fd, "technologies"),
    strengths: str(fd, "strengths"),
    differentials: str(fd, "differentials"),
    operation_model: str(fd, "operation_model", 200),
    moq: str(fd, "moq", 200),
    lead_time: str(fd, "lead_time", 200),
    price_range: str(fd, "price_range", 200),
    commercial_terms: str(fd, "commercial_terms"),
    currency: (str(fd, "currency", 3) ?? "BRL").toUpperCase(),
    quality_status: quality && QUALITY.includes(quality) ? quality : null,
    quality_evaluated_year: year >= 1990 && year <= 2100 ? year : null,
    rating_quality: rating(fd, "rating_quality"),
    rating_service: rating(fd, "rating_service"),
    rating_deadline: rating(fd, "rating_deadline"),
    notes: str(fd, "notes"),
    internal_notes: str(fd, "internal_notes"),
    custom_data: custom.data,
  };

  let supplierId: string;
  if (isUuid(id)) {
    const { error } = await supabase.from("suppliers").update(row).eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar o fornecedor." };
    supplierId = id;
  } else {
    const { data, error } = await supabase.from("suppliers").insert(row).select("id").single();
    if (error || !data) return { ok: false, message: "Não foi possível criar o fornecedor." };
    supplierId = data.id;
  }
  if (isFile(logo)) {
    try {
      const path = await uploadToStorage(supabase, s.orgId, "suppliers", supplierId, logo);
      await supabase.from("suppliers").update({ logo_path: path }).eq("id", supplierId);
    } catch {
      return { ok: false, message: "Fornecedor salvo, mas a logo não pôde ser enviada." };
    }
  }
  if (fd.get("remove_logo") === "on") await supabase.from("suppliers").update({ logo_path: null }).eq("id", supplierId);
  revalidatePath("/fornecedores");
  redirect(`/fornecedores/${supplierId}`);
}

export async function duplicateSupplier(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false, message: "Fornecedor inválido." };
  const supabase = await createClient();
  const { data: f } = await supabase.from("suppliers").select("*").eq("id", id).single();
  if (!f) return { ok: false, message: "Fornecedor não encontrado." };
  const omit = ["id", "created_at", "updated_at", "archived_at", "deleted_at", "created_by", "is_demo", "logo_path", "import_batch_id", "cnpj"];
  const copy = Object.fromEntries(Object.entries(f).filter(([k]) => !omit.includes(k)));
  const { data: n, error } = await supabase.from("suppliers").insert({ ...copy, name: `${f.name} (cópia)` }).select("id").single();
  if (error || !n) return { ok: false, message: "Não foi possível duplicar." };
  const { data: caps } = await supabase.from("supplier_capabilities").select("capability, status").eq("supplier_id", id);
  if (caps?.length) await supabase.from("supplier_capabilities").insert(caps.map((c) => ({ ...c, supplier_id: n.id })));
  redirect(`/fornecedores/${n.id}/editar`);
}

export async function addSupplierContact(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const supplierId = fd.get("supplier_id");
  const name = str(fd, "name", 200);
  if (!isUuid(supplierId)) return { ok: false, message: "Fornecedor inválido." };
  if (!name) return { ok: false, message: "Informe o nome do contato.", errors: { name: "Obrigatório" } };
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_contacts").insert({
    supplier_id: supplierId,
    name,
    role: str(fd, "role", 120),
    email: str(fd, "email", 200),
    phone: str(fd, "phone", 40),
    whatsapp: str(fd, "whatsapp", 40),
    is_primary: fd.get("is_primary") === "on",
  });
  if (error) return { ok: false, message: "Não foi possível adicionar o contato." };
  revalidatePath(`/fornecedores/${supplierId}`);
  return { ok: true, message: `Contato ${name} adicionado.` };
}

export async function deleteSupplierContact(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false };
  const supabase = await createClient();
  await supabase.from("supplier_contacts").delete().eq("id", id);
  revalidatePath("/fornecedores", "layout");
  return { ok: true, message: "Contato removido." };
}

/** Define (ou remove, com status vazio) uma capacidade produtiva. */
export async function setCapability(fd: FormData): Promise<ActionResult> {
  const supplierId = fd.get("supplier_id");
  const capability = str(fd, "capability", 120);
  const status = str(fd, "status");
  if (!isUuid(supplierId) || !capability) return { ok: false, message: "Dados inválidos." };
  const supabase = await createClient();
  if (!status) {
    await supabase.from("supplier_capabilities").delete().eq("supplier_id", supplierId).eq("capability", capability);
  } else {
    if (!CAP.includes(status)) return { ok: false, message: "Status inválido." };
    const { error } = await supabase.from("supplier_capabilities").upsert({ supplier_id: supplierId, capability, status }, { onConflict: "supplier_id,capability" });
    if (error) return { ok: false, message: "Não foi possível salvar a capacidade." };
  }
  revalidatePath(`/fornecedores/${supplierId}`);
  return { ok: true };
}

export async function linkSupplierToProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const projectId = fd.get("project_id");
  const supplierId = fd.get("supplier_id");
  if (!isUuid(projectId) || !isUuid(supplierId)) return { ok: false, message: "Escolha o projeto e o fornecedor." };
  const supabase = await createClient();
  const { error } = await supabase.from("project_suppliers").insert({ project_id: projectId, supplier_id: supplierId, role: str(fd, "role", 120), notes: str(fd, "notes") });
  if (error) return { ok: false, message: error.code === "23505" ? "Este fornecedor já está vinculado ao projeto." : "Não foi possível vincular." };
  revalidatePath(`/projetos/${projectId}`);
  revalidatePath(`/fornecedores/${supplierId}`);
  return { ok: true, message: "Fornecedor vinculado ao projeto." };
}

export async function unlinkSupplierFromProject(fd: FormData): Promise<ActionResult> {
  const id = fd.get("id");
  if (!isUuid(id)) return { ok: false };
  const supabase = await createClient();
  await supabase.from("project_suppliers").delete().eq("id", id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Vínculo removido." };
}
