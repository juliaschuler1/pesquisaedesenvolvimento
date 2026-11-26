import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Novo cliente" };

export default async function NewClientPage() {
  const opts = await loadOptionSets(["client_segments", "sales_channels"]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Novo cliente" description="Cada cliente ganha uma pasta digital com projetos, contatos, atividades e documentos." back={{ href: "/clientes", label: "Clientes" }} />
      <ClientForm customFields={await loadCustomFields("clients")} segments={opts.client_segments} channels={opts.sales_channels} />
    </div>
  );
}
