import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import { SupplierForm, type SupplierRow } from "../../supplier-form";

export const metadata: Metadata = { title: "Editar fornecedor" };

export default async function EditSupplier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: s }, options, fields] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).maybeSingle(),
    loadOptionSets(["supplier_categories", "product_categories", "certifications"]),
    loadCustomFields("suppliers"),
  ]);
  if (!s) notFound();
  const urls = await signedUrls(supabase, [s.logo_path]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Editar ${s.name}`} back={{ href: `/fornecedores/${id}`, label: s.name }} />
      <SupplierForm supplier={s as SupplierRow} logoUrl={s.logo_path ? urls[s.logo_path] : null} options={options} customFields={fields} />
    </div>
  );
}
