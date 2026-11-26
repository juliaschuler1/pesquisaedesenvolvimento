import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { OptionRow } from "./option-row";
import { AddOptionInline, NewSetForm } from "./add-forms";

export const metadata: Metadata = { title: "Categorias e listas" };

export default async function OptionSetsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("option_sets").select("id, key, label, description, options(id, label, position, archived_at)").order("label");
  const sets = (data ?? []).map((s) => ({
    ...s,
    options: ((s.options ?? []) as { id: string; label: string; position: number; archived_at: string | null }[]).sort((a, b) => a.position - b.position),
  }));
  return (
    <div>
      <PageHeader
        title="Categorias e listas"
        description="Todas as opções de seleção da plataforma. O que você adicionar aqui, ou pelo “+ Adicionar nova opção” dentro dos formulários, fica disponível em todo o workspace."
      />
      <div className="columns-1 gap-5 md:columns-2 2xl:columns-3 [&>*]:mb-5 [&>*]:break-inside-avoid">
        {sets.map((s) => (
          <Card key={s.id}>
            <CardHeader title={s.label} description={s.description ?? `${s.options.filter((o) => !o.archived_at).length} opções ativas`} />
            <ul className="mt-3 pb-1">
              {s.options.map((o, i) => (
                <OptionRow key={o.id} id={o.id} label={o.label} archived={Boolean(o.archived_at)} first={i === 0} last={i === s.options.length - 1} />
              ))}
            </ul>
            <AddOptionInline setKey={s.key} />
          </Card>
        ))}
        <Card className="border-2 border-dashed border-pastel !ring-0 !shadow-none">
          <CardHeader title="Nova lista" description="Crie listas próprias para usar em campos personalizados." />
          <NewSetForm />
        </Card>
      </div>
    </div>
  );
}
