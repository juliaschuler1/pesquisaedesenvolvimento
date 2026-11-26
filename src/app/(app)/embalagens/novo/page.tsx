import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { loadOptionSets, loadPackagingTypes } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { PackagingForm } from "../packaging-form";

export const metadata: Metadata = { title: "Nova embalagem" };

export default async function NewPackaging({ searchParams }: { searchParams: Promise<{ componente?: string; fornecedor?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [types, options, fields, { data: suppliers }] = await Promise.all([
    loadPackagingTypes(),
    loadOptionSets(["packaging_materials", "packaging_finishes", "closures"]),
    loadCustomFields("packaging_items"),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
  ]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Nova embalagem" back={{ href: "/embalagens", label: "Biblioteca de embalagens" }} />
      <PackagingForm types={types} options={options} customFields={fields} suppliers={suppliers ?? []} defaults={{ component: sp.componente, supplier_id: sp.fornecedor }} />
    </div>
  );
}
