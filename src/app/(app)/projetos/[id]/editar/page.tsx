import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import type { ProjectRow } from "@/lib/domain";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Editar projeto" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: project }, { data: clients }, opts] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("clients").select("id, name").is("deleted_at", null).order("name"),
    loadOptionSets(["product_categories", "product_types"]),
  ]);
  if (!project) notFound();
  const urls = await signedUrls(supabase, [project.cover_path]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Editar ${project.name}`} back={{ href: `/projetos/${id}`, label: project.name }} />
      <ProjectForm customFields={await loadCustomFields("projects")} project={project as ProjectRow} coverUrl={project.cover_path ? urls[project.cover_path] : null} clients={clients ?? []} categories={opts.product_categories} productTypes={opts.product_types} />
    </div>
  );
}
