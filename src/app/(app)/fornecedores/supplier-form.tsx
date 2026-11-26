"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveSupplier } from "./actions";
import { addOption } from "@/lib/actions/common";
import { Field, FormSection, Input, Select, Textarea, buttonClass } from "@/components/ui/primitives";
import { ChipMultiSelect, SubmitButton, useActionToast } from "@/components/ui/interactive";
import { CustomFieldInputs } from "@/components/custom-fields/inputs";
import type { CustomField } from "@/lib/custom-fields";
import { QUALITY_LABEL } from "@/lib/import/targets";

export type SupplierRow = Record<string, unknown> & {
  id: string;
  name: string;
  categories: string[];
  product_categories: string[];
  certifications: string[];
  social: Record<string, string>;
  custom_data: Record<string, unknown>;
};

function v(s: SupplierRow | null | undefined, k: string) {
  const x = s?.[k];
  return x === null || x === undefined ? "" : String(x);
}

function Rating({ name, label, value }: { name: string; label: string; value: unknown }) {
  return (
    <Field label={label} htmlFor={name}>
      <Select id={name} name={name} defaultValue={value ? String(value) : ""} placeholder="Sem avaliação" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: "★".repeat(n) + "☆".repeat(5 - n) }))} />
    </Field>
  );
}

export function SupplierForm({
  supplier,
  logoUrl,
  options,
  customFields,
  defaultCategory,
}: {
  supplier?: SupplierRow | null;
  logoUrl?: string | null;
  options: Record<string, string[]>;
  customFields: CustomField[];
  defaultCategory?: string;
}) {
  const [state, action] = useActionState(saveSupplier, null);
  useActionToast(state);
  const e = state?.errors ?? {};
  const s = supplier;

  return (
    <form action={action} className="flex flex-col gap-6">
      {s && <input type="hidden" name="id" value={s.id} />}
      <FormSection title="Identificação">
        <Field label="Nome" required error={e.name} htmlFor="name">
          <Input id="name" name="name" defaultValue={v(s, "name")} required />
        </Field>
        <Field label="Razão social" htmlFor="legal_name">
          <Input id="legal_name" name="legal_name" defaultValue={v(s, "legal_name")} />
        </Field>
        <Field label="CNPJ" error={e.cnpj} htmlFor="cnpj" hint="Para fornecedores internacionais, use o registro local ou deixe em branco.">
          <Input id="cnpj" name="cnpj" defaultValue={v(s, "cnpj")} />
        </Field>
        <Field label="Logo" error={e.logo} htmlFor="logo" hint="Até 4 MB">
          <div className="flex items-center gap-3">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-contain ring-1 ring-blush" />
            )}
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="file:mr-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-1 file:text-deep" />
            {logoUrl && <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-soft"><input type="checkbox" name="remove_logo" className="accent-[var(--brand-deep)]" /> Remover</label>}
          </div>
        </Field>
        <Field label="Categorias" className="md:col-span-2">
          <ChipMultiSelect name="categories" setKey="supplier_categories" options={options.supplier_categories} defaultValue={s?.categories ?? (defaultCategory ? [defaultCategory] : [])} addOption={addOption} />
        </Field>
      </FormSection>

      <FormSection title="Localização e contato" description="Contatos individuais (com cargo) são cadastrados na ficha do fornecedor.">
        <Field label="País" htmlFor="country"><Input id="country" name="country" defaultValue={v(s, "country") || "Brasil"} /></Field>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Field label="Cidade" htmlFor="city"><Input id="city" name="city" defaultValue={v(s, "city")} /></Field>
          <Field label="UF" htmlFor="state"><Input id="state" name="state" defaultValue={v(s, "state")} /></Field>
        </div>
        <Field label="Endereço" htmlFor="address" className="md:col-span-2"><Input id="address" name="address" defaultValue={v(s, "address")} /></Field>
        <Field label="E-mail geral" error={e.email} htmlFor="email"><Input id="email" name="email" type="email" defaultValue={v(s, "email")} /></Field>
        <Field label="Site" htmlFor="website"><Input id="website" name="website" defaultValue={v(s, "website")} /></Field>
        <Field label="Telefone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={v(s, "phone")} /></Field>
        <Field label="WhatsApp" htmlFor="whatsapp"><Input id="whatsapp" name="whatsapp" defaultValue={v(s, "whatsapp")} /></Field>
        <Field label="Instagram" htmlFor="social_instagram"><Input id="social_instagram" name="social_instagram" defaultValue={s?.social?.instagram ?? ""} /></Field>
        <Field label="LinkedIn" htmlFor="social_linkedin"><Input id="social_linkedin" name="social_linkedin" defaultValue={s?.social?.linkedin ?? ""} /></Field>
      </FormSection>

      <FormSection title="Especialidades e operação">
        <Field label="Categorias de produto atendidas" className="md:col-span-2">
          <ChipMultiSelect name="product_categories" setKey="product_categories" options={options.product_categories} defaultValue={s?.product_categories ?? []} addOption={addOption} />
        </Field>
        <Field label="Tecnologias e especialidades" htmlFor="technologies" className="md:col-span-2"><Textarea id="technologies" name="technologies" defaultValue={v(s, "technologies")} /></Field>
        <Field label="Pontos fortes" htmlFor="strengths"><Textarea id="strengths" name="strengths" defaultValue={v(s, "strengths")} /></Field>
        <Field label="Diferenciais" htmlFor="differentials"><Textarea id="differentials" name="differentials" defaultValue={v(s, "differentials")} /></Field>
        <Field label="Modelo de operação" htmlFor="operation_model" hint="Ex.: full service, só fabricação, só envase"><Input id="operation_model" name="operation_model" defaultValue={v(s, "operation_model")} /></Field>
        <Field label="Certificações" className="md:col-span-2">
          <ChipMultiSelect name="certifications" setKey="certifications" options={options.certifications} defaultValue={s?.certifications ?? []} addOption={addOption} />
        </Field>
      </FormSection>

      <FormSection title="Condições comerciais" description="Dados internos: não aparecem em documentos para clientes.">
        <Field label="MOQ" htmlFor="moq" hint="Ex.: 3.000 un. por SKU"><Input id="moq" name="moq" defaultValue={v(s, "moq")} /></Field>
        <Field label="Lead time" htmlFor="lead_time" hint="Ex.: 90 dias após aprovação"><Input id="lead_time" name="lead_time" defaultValue={v(s, "lead_time")} /></Field>
        <Field label="Faixa de preço" htmlFor="price_range"><Input id="price_range" name="price_range" defaultValue={v(s, "price_range")} /></Field>
        <Field label="Moeda" htmlFor="currency" hint="BRL, USD, EUR…"><Input id="currency" name="currency" defaultValue={v(s, "currency") || "BRL"} maxLength={3} /></Field>
        <Field label="Condições comerciais" htmlFor="commercial_terms" className="md:col-span-2"><Textarea id="commercial_terms" name="commercial_terms" defaultValue={v(s, "commercial_terms")} /></Field>
      </FormSection>

      <FormSection title="Avaliação" description="Uso interno — nunca exibida a clientes ou a outros fornecedores.">
        <Field label="Avaliação de qualidade" htmlFor="quality_status">
          <Select id="quality_status" name="quality_status" defaultValue={v(s, "quality_status")} placeholder="Não avaliado" options={Object.entries(QUALITY_LABEL).map(([value, q]) => ({ value, label: q.label }))} />
        </Field>
        <Field label="Ano da avaliação" htmlFor="quality_evaluated_year"><Input id="quality_evaluated_year" name="quality_evaluated_year" inputMode="numeric" defaultValue={v(s, "quality_evaluated_year")} /></Field>
        <Rating name="rating_quality" label="Qualidade" value={s?.rating_quality} />
        <Rating name="rating_service" label="Atendimento" value={s?.rating_service} />
        <Rating name="rating_deadline" label="Prazo" value={s?.rating_deadline} />
        <Field label="Observações internas" htmlFor="internal_notes" className="md:col-span-2"><Textarea id="internal_notes" name="internal_notes" defaultValue={v(s, "internal_notes")} className="bg-[#fffafc]" /></Field>
        <Field label="Observações gerais" htmlFor="notes" className="md:col-span-2"><Textarea id="notes" name="notes" defaultValue={v(s, "notes")} /></Field>
      </FormSection>

      <FormSection title="Campos personalizados">
        {customFields.length ? (
          <CustomFieldInputs fields={customFields} values={s?.custom_data ?? {}} errors={e} />
        ) : (
          <p className="text-[13px] text-ink-soft md:col-span-2">Nenhum campo extra. <Link href="/construtor-modulos?entidade=suppliers" className="text-deep hover:underline">Criar campo personalizado</Link></p>
        )}
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-blush bg-bg/90 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        <Link href={s ? `/fornecedores/${s.id}` : "/fornecedores"} className={buttonClass("secondary")}>Cancelar</Link>
        <SubmitButton>{s ? "Salvar alterações" : "Criar fornecedor"}</SubmitButton>
      </div>
    </form>
  );
}
