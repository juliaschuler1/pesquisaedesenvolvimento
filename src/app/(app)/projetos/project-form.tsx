"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveProject } from "./actions";
import { addOption } from "@/lib/actions/common";
import { Field, FormSection, Input, Select, Textarea, buttonClass } from "@/components/ui/primitives";
import { OptionSelect, SubmitButton, useActionToast } from "@/components/ui/interactive";
import { PRIORITY, PROJECT_STATUS, VOLUME_UNITS, options, type ProjectRow } from "@/lib/domain";
import { formatNumber } from "@/lib/format";
import type { CustomField } from "@/lib/custom-fields";
import { CustomFieldInputs } from "@/components/custom-fields/inputs";

export function ProjectForm({
  project,
  coverUrl,
  clients,
  defaultClientId,
  categories,
  productTypes,
  customFields = [],
}: {
  project?: ProjectRow | null;
  coverUrl?: string | null;
  clients: { id: string; name: string }[];
  defaultClientId?: string;
  categories: string[];
  productTypes: string[];
  customFields?: CustomField[];
}) {
  const [state, action] = useActionState(saveProject, null);
  useActionToast(state);
  const e = state?.errors ?? {};
  const p = project;
  const sh = p?.sku_shared ?? {};
  const money = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "" : formatNumber(v, d));

  return (
    <form action={action} className="flex flex-col gap-6">
      {p && <input type="hidden" name="id" value={p.id} />}

      <FormSection title="Projeto" description="Identificação e enquadramento do produto.">
        <Field label="Cliente" required error={e.client_id} htmlFor="client_id">
          <Select id="client_id" name="client_id" defaultValue={p?.client_id ?? defaultClientId ?? ""} placeholder="Selecione o cliente" options={clients.map((c) => ({ value: c.id, label: c.name }))} required />
        </Field>
        <Field label="Nome do projeto" required error={e.name} htmlFor="name">
          <Input id="name" name="name" defaultValue={p?.name ?? ""} required placeholder="Ex.: Gloss Labial Glow" />
        </Field>
        <Field label="Código interno" htmlFor="code" hint="Único no workspace">
          <Input id="code" name="code" defaultValue={p?.code ?? ""} placeholder="Ex.: AUR-2027-01" />
        </Field>
        <Field label="Categoria" htmlFor="category">
          <OptionSelect id="category" name="category" setKey="product_categories" options={categories} defaultValue={p?.category} addOption={addOption} />
        </Field>
        <Field label="Tipo de produto" htmlFor="product_type">
          <OptionSelect id="product_type" name="product_type" setKey="product_types" options={productTypes} defaultValue={p?.product_type} addOption={addOption} />
        </Field>
        <Field label="Imagem de capa" error={e.cover} htmlFor="cover" hint="PNG, JPG ou WEBP até 4 MB">
          <div className="flex items-center gap-3">
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="h-12 w-16 rounded-lg object-cover ring-1 ring-blush" />
            )}
            <Input id="cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp" className="file:mr-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-1 file:text-deep" />
            {coverUrl && (
              <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-soft">
                <input type="checkbox" name="remove_cover" className="accent-[var(--brand-deep)]" /> Remover
              </label>
            )}
          </div>
        </Field>
      </FormSection>

      <FormSection title="Conceito e estratégia">
        <Field label="Conceito" htmlFor="concept" className="md:col-span-2">
          <Textarea id="concept" name="concept" defaultValue={p?.concept ?? ""} placeholder="A ideia do produto em poucas linhas." />
        </Field>
        <Field label="Objetivo" htmlFor="objective">
          <Textarea id="objective" name="objective" defaultValue={p?.objective ?? ""} />
        </Field>
        <Field label="Justificativa" htmlFor="rationale">
          <Textarea id="rationale" name="rationale" defaultValue={p?.rationale ?? ""} />
        </Field>
      </FormSection>

      <FormSection title="Planejamento">
        <Field label="Data de início" htmlFor="start_date">
          <Input id="start_date" type="date" name="start_date" defaultValue={p?.start_date ?? ""} />
        </Field>
        <Field label="Previsão de lançamento" error={e.launch_date} htmlFor="launch_date">
          <Input id="launch_date" type="date" name="launch_date" defaultValue={p?.launch_date ?? ""} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={p?.status ?? "planning"} options={options(PROJECT_STATUS)} />
        </Field>
        <Field label="Prioridade" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue={p?.priority ?? "medium"} options={options(PRIORITY)} />
        </Field>
        <Field label="Responsáveis" htmlFor="owners_text" hint="Separe por vírgula">
          <Input id="owners_text" name="owners_text" defaultValue={(p?.owners ?? []).join(", ")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Custo-alvo unitário (R$)" error={e.target_cost} htmlFor="target_cost">
            <Input id="target_cost" name="target_cost" inputMode="decimal" defaultValue={money(p?.target_cost)} placeholder="0,00" />
          </Field>
          <Field label="Orçamento (R$)" error={e.budget} htmlFor="budget">
            <Input id="budget" name="budget" inputMode="decimal" defaultValue={money(p?.budget)} placeholder="0,00" />
          </Field>
        </div>
        {!p && (
          <label className="flex items-start gap-3 rounded-2xl bg-blush/60 p-4 md:col-span-2">
            <input type="checkbox" name="apply_template" defaultChecked className="mt-1 accent-[var(--brand-deep)]" />
            <span>
              <span className="block text-[14px] font-medium text-ink">Criar cronograma a partir do modelo inicial</span>
              <span className="block text-[13px] text-ink-soft">27 etapas, da pesquisa de mercado ao lançamento, com dependências e pesos. Tudo editável depois.</span>
            </span>
          </label>
        )}
      </FormSection>

      <FormSection title="Informações comuns aos SKUs" description="Preencha uma vez: cada SKU herda estes valores, a menos que defina um próprio.">
        <Field label="Fragrância" htmlFor="shared_fragrance">
          <Input id="shared_fragrance" name="shared_fragrance" defaultValue={sh.fragrance ?? ""} />
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Volumetria" htmlFor="shared_volume">
            <Input id="shared_volume" name="shared_volume" inputMode="decimal" defaultValue={sh.volume ?? ""} />
          </Field>
          <Field label="Unidade" htmlFor="shared_volume_unit">
            <Select id="shared_volume_unit" name="shared_volume_unit" defaultValue={sh.volume_unit ?? "ml"} options={VOLUME_UNITS.map((u) => ({ value: u, label: u }))} />
          </Field>
        </div>
        <Field label="Embalagem" htmlFor="shared_packaging" className="md:col-span-2">
          <Input id="shared_packaging" name="shared_packaging" defaultValue={sh.packaging ?? ""} placeholder="Ex.: frasco de gloss PETG 6 ml com aplicador doe-foot" />
        </Field>
        <Field label="Especificações técnicas" htmlFor="shared_specs" className="md:col-span-2">
          <Textarea id="shared_specs" name="shared_specs" defaultValue={sh.specs ?? ""} />
        </Field>
      </FormSection>

      <FormSection title="Campos personalizados" description="Campos criados por você no Construtor de módulos.">
        {customFields.length ? (
          <CustomFieldInputs fields={customFields} values={p?.custom_data ?? {}} errors={e} />
        ) : (
          <p className="text-[13px] text-ink-soft md:col-span-2">
            Nenhum campo extra ainda. <Link href="/construtor-modulos?entidade=projects" className="text-deep hover:underline">Criar campo personalizado</Link>
          </p>
        )}
      </FormSection>

      <FormSection title="Observações">
        <Field label="Observações" htmlFor="notes" hint="Podem aparecer em documentos compartilhados.">
          <Textarea id="notes" name="notes" defaultValue={p?.notes ?? ""} />
        </Field>
        <Field label="Observações internas" htmlFor="private_notes" hint="Nunca aparecem para clientes ou fornecedores.">
          <Textarea id="private_notes" name="private_notes" defaultValue={p?.private_notes ?? ""} className="bg-[#fffafc]" />
        </Field>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-blush bg-bg/90 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        <Link href={p ? `/projetos/${p.id}` : "/projetos"} className={buttonClass("secondary")}>Cancelar</Link>
        <SubmitButton>{p ? "Salvar alterações" : "Criar projeto"}</SubmitButton>
      </div>
    </form>
  );
}
