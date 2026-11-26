import type { Metadata } from "next";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = { title: "Novo projeto" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const [{ data: clients }, opts] = await Promise.all([
    supabase.from("clients").select("id, name").is("deleted_at", null).is("archived_at", null).order("name"),
    loadOptionSets(["product_categories", "product_types"]),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Novo projeto" description="Cada projeto é um ambiente próprio, com SKUs, cronograma, atividades e documentos." back={{ href: "/projetos", label: "Projetos" }} />
      {(clients ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="Users" title="Cadastre um cliente primeiro" description="Todo projeto pertence a um cliente." action={<ButtonLink href="/clientes/novo">Novo cliente</ButtonLink>} />
        </Card>
      ) : (
        <ProjectForm customFields={await loadCustomFields("projects")} clients={clients ?? []} defaultClientId={cliente} categories={opts.product_categories} productTypes={opts.product_types} />
      )}
    </div>
  );
}
