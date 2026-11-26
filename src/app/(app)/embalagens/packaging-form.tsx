"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { savePackaging } from "./actions";
import { addOption } from "@/lib/actions/common";
import { Field, FormSection, Input, Select, Textarea, buttonClass, cx } from "@/components/ui/primitives";
import { OptionSelect, SubmitButton, useActionToast } from "@/components/ui/interactive";
import { CustomFieldInputs } from "@/components/custom-fields/inputs";
import type { CustomField } from "@/lib/custom-fields";
import { COMPONENTS } from "@/lib/packaging";
import { formatNumber } from "@/lib/format";
import { Package } from "lucide-react";

type Item = Record<string, unknown> & { id: string; custom_data: Record<string, unknown> };

function v(s: Item | null | undefined, k: string) {
  const x = s?.[k];
  return x === null || x === undefined ? "" : String(x);
}

/** Seleção visual do tipo de embalagem (imagens ilustrativas). */
export function TypePicker({ types, value, onChange }: { types: { label: string; image: string | null }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <input type="hidden" name="packaging_type" value={value} />
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7" role="radiogroup" aria-label="Tipo de embalagem">
        {types.map((t) => {
          const on = value === t.label;
          return (
            <li key={t.label}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(on ? "" : t.label)}
                className={cx("flex w-full flex-col items-center gap-1 rounded-2xl p-2 text-center ring-1 transition-[box-shadow,background]", on ? "bg-blush ring-2 ring-deep" : "bg-white ring-blush hover:ring-mid")}
              >
                {t.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt="" className="aspect-square w-full rounded-xl object-contain" />
                ) : (
                  <span className="grid aspect-square w-full place-items-center rounded-xl bg-[#fffafc] text-pastel"><Package size={28} strokeWidth={1.3} /></span>
                )}
                <span className="line-clamp-2 text-[11.5px] leading-tight text-ink">{t.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-ink-soft">Imagens ilustrativas do tipo, não de um modelo real. Para incluir um tipo novo, use Categorias e listas → Tipos de embalagem.</p>
    </div>
  );
}

export function PackagingForm({
  item,
  photoUrl,
  types,
  suppliers,
  options,
  customFields,
  defaults,
}: {
  item?: Item | null;
  photoUrl?: string | null;
  types: { label: string; image: string | null }[];
  suppliers: { id: string; name: string }[];
  options: Record<string, string[]>;
  customFields: CustomField[];
  defaults?: { component?: string; supplier_id?: string };
}) {
  const [state, action] = useActionState(savePackaging, null);
  useActionToast(state);
  const [type, setType] = useState(v(item, "packaging_type"));
  const e = state?.errors ?? {};
  const s = item;
  const num = (k: string) => (s?.[k] === null || s?.[k] === undefined ? "" : formatNumber(Number(s[k]), Number(s[k]) % 1 ? 2 : 0));

  return (
    <form action={action} className="flex flex-col gap-6">
      {s && <input type="hidden" name="id" value={s.id} />}
      <FormSection title="Tipo de embalagem" description="Escolha visualmente o tipo mais próximo.">
        <div className="md:col-span-2"><TypePicker types={types} value={type} onChange={setType} /></div>
      </FormSection>

      <FormSection title="Identificação">
        <Field label="Nome" required error={e.name} htmlFor="name"><Input id="name" name="name" defaultValue={v(s, "name")} required placeholder="Ex.: Frasco gloss 6 ml cilíndrico" /></Field>
        <Field label="Código" htmlFor="code"><Input id="code" name="code" defaultValue={v(s, "code")} /></Field>
        <Field label="Componente" htmlFor="component" error={e.component}>
          <Select id="component" name="component" defaultValue={v(s, "component") || defaults?.component || "frasco"} options={Object.entries(COMPONENTS).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Fornecedor" htmlFor="supplier_id" hint={suppliers.length ? undefined : "Cadastre fornecedores para vinculá-los."}>
          <Select id="supplier_id" name="supplier_id" defaultValue={v(s, "supplier_id") || defaults?.supplier_id || ""} placeholder="Sem fornecedor" options={suppliers.map((x) => ({ value: x.id, label: x.name }))} />
        </Field>
        <Field label="Foto do modelo real" error={e.photo} htmlFor="photo" hint="Foto do fornecedor ou da amostra. Até 4 MB." className="md:col-span-2">
          <div className="flex items-center gap-3">
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-14 w-14 rounded-xl bg-white object-contain ring-1 ring-blush" />
            )}
            <Input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="file:mr-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-1 file:text-deep" />
            {photoUrl && <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-soft"><input type="checkbox" name="remove_photo" className="accent-[var(--brand-deep)]" /> Remover</label>}
          </div>
        </Field>
      </FormSection>

      <FormSection title="Especificações técnicas">
        <Field label="Material" htmlFor="material"><OptionSelect id="material" name="material" setKey="packaging_materials" options={options.packaging_materials} defaultValue={v(s, "material")} addOption={addOption} /></Field>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Field label="Capacidade nominal" htmlFor="capacity" error={e.capacity}><Input id="capacity" name="capacity" inputMode="decimal" defaultValue={num("capacity")} /></Field>
          <Field label="Unidade" htmlFor="capacity_unit"><Select id="capacity_unit" name="capacity_unit" defaultValue={v(s, "capacity_unit") || "ml"} options={["ml", "g", "kg", "L", "un"].map((u) => ({ value: u, label: u }))} /></Field>
        </div>
        <Field label="Volume de envase" htmlFor="fill_volume"><Input id="fill_volume" name="fill_volume" inputMode="decimal" defaultValue={num("fill_volume")} /></Field>
        <Field label="Dimensões" htmlFor="dimensions" hint="Ex.: Ø 18 × 92 mm"><Input id="dimensions" name="dimensions" defaultValue={v(s, "dimensions")} /></Field>
        <Field label="Peso" htmlFor="weight"><Input id="weight" name="weight" defaultValue={v(s, "weight")} /></Field>
        <Field label="Acabamento" htmlFor="finish"><OptionSelect id="finish" name="finish" setKey="packaging_finishes" options={options.packaging_finishes} defaultValue={v(s, "finish")} addOption={addOption} /></Field>
        <Field label="Cor" htmlFor="color"><Input id="color" name="color" defaultValue={v(s, "color")} /></Field>
        <Field label="Pantone" htmlFor="pantone"><Input id="pantone" name="pantone" defaultValue={v(s, "pantone")} /></Field>
        <Field label="Fechamento" htmlFor="closure"><OptionSelect id="closure" name="closure" setKey="closures" options={options.closures} defaultValue={v(s, "closure")} addOption={addOption} /></Field>
        <Field label="Rosca" htmlFor="thread" hint="Ex.: 24/410"><Input id="thread" name="thread" defaultValue={v(s, "thread")} /></Field>
        <Field label="Válvula / pump" htmlFor="valve"><Input id="valve" name="valve" defaultValue={v(s, "valve")} /></Field>
        <Field label="Aplicador" htmlFor="applicator"><Input id="applicator" name="applicator" defaultValue={v(s, "applicator")} /></Field>
        <Field label="Retentor" htmlFor="retainer"><Input id="retainer" name="retainer" defaultValue={v(s, "retainer")} /></Field>
        <Field label="Decoração" htmlFor="decoration" hint="Ex.: serigrafia 1 cor + hot stamping"><Input id="decoration" name="decoration" defaultValue={v(s, "decoration")} /></Field>
        <Field label="Personalização possível" htmlFor="customization" className="md:col-span-2"><Textarea id="customization" name="customization" defaultValue={v(s, "customization")} /></Field>
      </FormSection>

      <FormSection title="Comercial" description="Uso interno.">
        <Field label="MOQ" htmlFor="moq"><Input id="moq" name="moq" defaultValue={v(s, "moq")} /></Field>
        <Field label="Lead time" htmlFor="lead_time"><Input id="lead_time" name="lead_time" defaultValue={v(s, "lead_time")} /></Field>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Field label="Custo unitário" htmlFor="unit_cost" error={e.unit_cost}><Input id="unit_cost" name="unit_cost" inputMode="decimal" defaultValue={s?.unit_cost === null || s?.unit_cost === undefined ? "" : formatNumber(Number(s.unit_cost), 2)} placeholder="0,00" /></Field>
          <Field label="Moeda" htmlFor="currency"><Input id="currency" name="currency" defaultValue={v(s, "currency") || "BRL"} maxLength={3} /></Field>
        </div>
        <Field label="Observações" htmlFor="notes" className="md:col-span-2"><Textarea id="notes" name="notes" defaultValue={v(s, "notes")} /></Field>
        <Field label="Observações internas" htmlFor="internal_notes" className="md:col-span-2"><Textarea id="internal_notes" name="internal_notes" defaultValue={v(s, "internal_notes")} className="bg-[#fffafc]" /></Field>
      </FormSection>

      <FormSection title="Campos personalizados">
        {customFields.length ? <CustomFieldInputs fields={customFields} values={s?.custom_data ?? {}} errors={e} /> : <p className="text-[13px] text-ink-soft md:col-span-2">Nenhum campo extra. <Link href="/construtor-modulos?entidade=packaging_items" className="text-deep hover:underline">Criar campo personalizado</Link></p>}
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-blush bg-bg/90 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        <Link href={s ? `/embalagens/${s.id}` : "/embalagens"} className={buttonClass("secondary")}>Cancelar</Link>
        <SubmitButton>{s ? "Salvar alterações" : "Criar embalagem"}</SubmitButton>
      </div>
    </form>
  );
}
