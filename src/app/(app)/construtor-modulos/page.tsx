import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { Badge, Card, CardHeader, PageHeader, cx } from "@/components/ui/primitives";
import { QuickAction } from "@/components/ui/interactive";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { FIELD_TYPE_LABEL, FIELD_TYPES_PLANNED } from "@/lib/custom-fields";
import { archiveCustomField } from "@/lib/actions/admin";
import { ModuleRow, NewFieldForm, NewModuleForm } from "./builder-forms";

export const metadata: Metadata = { title: "Construtor de módulos" };

export default async function BuilderPage({ searchParams }: { searchParams: Promise<{ novo?: string; entidade?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const groups = s.nav.map((g) => ({ id: g.id, label: g.label }));
  const customModules = s.nav.flatMap((g) => g.modules).filter((m) => m.kind === "custom");
  const entities = [
    { value: "clients", label: "Clientes" },
    { value: "projects", label: "Projetos" },
    ...customModules.map((m) => ({ value: `module:${m.key}`, label: m.label })),
  ];
  const entity = entities.some((e) => e.value === sp.entidade) ? sp.entidade! : "clients";
  const fields = await loadCustomFields(entity, true);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Construtor de módulos" description="Crie módulos e campos próprios, e organize o menu como preferir. Nada aqui exige programação." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card id="novo-modulo" className={cx(sp.novo && "ring-2 ring-mid")}>
          <CardHeader title="Novo módulo" description="Ganha uma página no menu, com registros, busca, arquivamento e campos personalizados." />
          <div className="p-5">
            <NewModuleForm groups={groups} autoFocus={Boolean(sp.novo)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Campos personalizados" description="Adicione campos às fichas sem alterar o código. Versões anteriores ficam preservadas." />
          <nav className="flex flex-wrap gap-1 px-5 pt-4" aria-label="Entidade">
            {entities.map((e) => (
              <Link key={e.value} href={`/construtor-modulos?entidade=${encodeURIComponent(e.value)}`} scroll={false} className={cx("rounded-full px-3 py-1.5 text-[13px]", entity === e.value ? "bg-ink text-white" : "text-ink-soft hover:bg-blush")}>
                {e.label}
              </Link>
            ))}
          </nav>
          <ul className="mx-5 mt-4 divide-y divide-blush rounded-2xl ring-1 ring-blush">
            {fields.length === 0 && <li className="px-4 py-3 text-[13px] text-ink-soft">Nenhum campo personalizado para esta entidade.</li>}
            {fields.map((f) => (
              <li key={f.id} className={cx("flex items-center gap-3 px-4 py-2.5", f.archived_at && "opacity-55")}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-ink">{f.label} {f.required && <span className="text-deep">*</span>}</span>
                  <span className="block text-[12px] text-ink-soft">
                    {FIELD_TYPE_LABEL[f.field_type] ?? f.field_type}
                    {f.settings.choices?.length ? ` · ${f.settings.choices.join(", ")}` : ""}
                    {f.section ? ` · seção ${f.section}` : ""} · v{f.version}
                  </span>
                </span>
                <Badge tone={f.visibility === "shareable" ? "success" : "neutral"}>{f.visibility === "shareable" ? "Compartilhável" : "Interno"}</Badge>
                <QuickAction action={archiveCustomField} fields={{ id: f.id }} label={f.archived_at ? "Reativar" : "Arquivar"} icon={f.archived_at ? "ArchiveRestore" : "Archive"} />
              </li>
            ))}
          </ul>
          <div className="p-5">
            <NewFieldForm entity={entity} />
            <p className="mt-4 text-[12.5px] text-ink-soft">Próximos tipos no construtor visual (Fase 6): {FIELD_TYPES_PLANNED.join(", ")}.</p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Menu lateral" description="Renomeie, reordene, mude de grupo ou oculte módulos. Módulos marcados com fase estão previstos no plano." />
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {s.nav.map((g) => (
            <section key={g.id}>
              <h3 className="mb-2 text-[13px] font-medium text-ink-soft">{g.label}</h3>
              <ul className="divide-y divide-blush rounded-2xl ring-1 ring-blush">
                {g.modules.length === 0 && <li className="px-4 py-3 text-[13px] text-ink-soft">Grupo vazio.</li>}
                {g.modules.map((m, i) => (
                  <ModuleRow key={m.id} m={m} groups={groups} first={i === 0} last={i === g.modules.length - 1} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
