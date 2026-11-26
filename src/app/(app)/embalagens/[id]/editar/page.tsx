import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { loadOptionSets, loadPackagingTypes } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import { PackagingForm } from "../../packaging-form";

export const metadata: Metadata = { title: "Editar embalagem" };

export default async function EditPackaging({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: item }, types, options, fields, { data: suppliers }] = await Promise.all([
    supabase.from("packaging_items").select("*").eq("id", id).maybeSingle(),
    loadPackagingTypes(),
    loadOptionSets(["packaging_materials", "packaging_finishes", "closures"]),
    loadCustomFields("packaging_items"),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
  ]);
  if (!item) notFound();
  const urls = await signedUrls(supabase, [item.photo_path]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Editar ${item.name}`} back={{ href: `/embalagens/${id}`, label: item.name }} />
      <PackagingForm item={item} photoUrl={item.photo_path ? urls[item.photo_path] : null} types={types} options={options} customFields={fields} suppliers={suppliers ?? []} />
    </div>
  );
}
