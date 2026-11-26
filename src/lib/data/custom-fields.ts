import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CustomField } from "@/lib/custom-fields";

export async function loadCustomFields(entity: string, includeArchived = false): Promise<CustomField[]> {
  const supabase = await createClient();
  let q = supabase.from("custom_fields").select("*").eq("entity", entity).order("position");
  if (!includeArchived) q = q.is("archived_at", null);
  const { data } = await q;
  return (data ?? []) as CustomField[];
}
