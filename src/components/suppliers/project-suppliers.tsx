import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { unlinkSupplierFromProject } from "@/app/(app)/fornecedores/actions";
import { LinkProjectForm } from "@/app/(app)/fornecedores/[id]/panels";

export async function ProjectSuppliersCard({ projectId }: { projectId: string }) {
  const supabase = await createClient();
  const [{ data: links }, { data: suppliers }] = await Promise.all([
    supabase.from("project_suppliers").select("id, role, suppliers(id, name)").eq("project_id", projectId),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).is("archived_at", null).order("name"),
  ]);
  return (
    <Card>
      <CardHeader title="Fornecedores do projeto" description="Cotações e propostas detalhadas chegam na Fase 5." />
      <ul className="flex flex-col gap-1 px-3 pt-3">
        {(links ?? []).length === 0 && <li className="px-2 py-1 text-[13px] text-ink-soft">Nenhum fornecedor vinculado.</li>}
        {(links ?? []).map((l) => {
          const f = l.suppliers as unknown as { id: string; name: string };
          return (
            <li key={l.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
              <Link href={`/fornecedores/${f.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink hover:text-deep">{f.name}</span>
                {l.role && <span className="block text-[12px] text-ink-soft">{l.role}</span>}
              </Link>
              <ConfirmAction action={unlinkSupplierFromProject} fields={{ id: l.id }} label="" icon="Trash2" title="Remover vínculo?" description={`${f.name} deixa de aparecer neste projeto.`} confirmLabel="Remover" danger className="!px-2" />
            </li>
          );
        })}
      </ul>
      <LinkProjectForm projectId={projectId} suppliers={suppliers ?? []} />
    </Card>
  );
}
