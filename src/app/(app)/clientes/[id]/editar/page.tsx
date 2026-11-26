import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import type { ClientRow } from "@/lib/domain";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: client }, opts] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    loadOptionSets(["client_segments", "sales_channels"]),
  ]);
  if (!client) notFound();
  const urls = await signedUrls(supabase, [client.logo_path]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Editar ${client.name}`} back={{ href: `/clientes/${id}`, label: client.name }} />
      <ClientForm customFields={await loadCustomFields("clients")} client={client as ClientRow} logoUrl={client.logo_path ? urls[client.logo_path] : null} segments={opts.client_segments} channels={opts.sales_channels} />
    </div>
  );
}
