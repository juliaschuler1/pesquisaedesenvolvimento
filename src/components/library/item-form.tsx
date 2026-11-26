"use client";

import { useActionState, useEffect, useState } from "react";
import { saveLibraryItem } from "@/lib/actions/library";
import { addOption } from "@/lib/actions/common";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, OptionSelect, SubmitButton, useActionToast } from "@/components/ui/interactive";
import { CustomFieldInputs } from "@/components/custom-fields/inputs";
import type { CustomField } from "@/lib/custom-fields";

export type LibraryItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  tags: string[];
  supplier_id: string | null;
  source_name: string | null;
  source_url: string | null;
  reviewed_on: string | null;
  notes: string | null;
  data: Record<string, unknown>;
};

type Props = {
  library: string;
  singular: string;
  categoryLabel: string;
  categorySet: string;
  categories: string[];
  nameHint: string;
  suppliers: { id: string; name: string }[];
  fields: CustomField[];
  item?: LibraryItem;
};

export function LibraryItemButton(props: Props & { label?: string; icon?: string; variant?: "primary" | "ghost" | "secondary"; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const { label = `Nova ${props.singular}`, icon = "Plus", variant = "primary", size = "md", ...rest } = props;
  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={props.item ? props.item.name : label} wide>
        <LibraryItemForm {...rest} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function LibraryItemForm({ library, categoryLabel, categorySet, categories, nameHint, suppliers, fields, item, onDone }: Omit<Props, "singular"> & { onDone?: () => void }) {
  const [state, action] = useActionState(saveLibraryItem, null);
  useActionToast(state);
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="library" value={library} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Nome" required htmlFor="li-name" error={e.name}><Input id="li-name" name="name" defaultValue={item?.name ?? ""} placeholder={nameHint} required autoFocus /></Field>
      <Field label={categoryLabel} htmlFor="li-cat"><OptionSelect id="li-cat" name="category" setKey={categorySet} options={categories} defaultValue={item?.category} addOption={addOption} /></Field>
      <Field label="Descrição" htmlFor="li-desc" className="md:col-span-2"><Textarea id="li-desc" name="description" defaultValue={item?.description ?? ""} /></Field>
      <Field label="Fornecedor" htmlFor="li-sup"><Select id="li-sup" name="supplier_id" defaultValue={item?.supplier_id ?? ""} placeholder="Sem fornecedor" options={suppliers.map((x) => ({ value: x.id, label: x.name }))} /></Field>
      <Field label="Etiquetas" htmlFor="li-tags" hint="Separe por vírgula"><Input id="li-tags" name="tags" defaultValue={(item?.tags ?? []).join(", ")} /></Field>
      <Field label="Fonte" htmlFor="li-src" hint="Ex.: ficha técnica do fornecedor, artigo, relatório"><Input id="li-src" name="source_name" defaultValue={item?.source_name ?? ""} /></Field>
      <Field label="Link da fonte" htmlFor="li-url"><Input id="li-url" name="source_url" defaultValue={item?.source_url ?? ""} placeholder="https://" /></Field>
      <Field label="Data de atualização" htmlFor="li-rev"><Input id="li-rev" type="date" name="reviewed_on" defaultValue={item?.reviewed_on ?? ""} /></Field>
      <Field label="Imagem" htmlFor="li-img" hint="Até 4 MB" error={e.image}><Input id="li-img" name="image" type="file" accept="image/png,image/jpeg,image/webp" className="file:mr-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-1 file:text-deep" /></Field>
      <CustomFieldInputs fields={fields} values={item?.data ?? {}} errors={e} />
      <Field label="Observações" htmlFor="li-notes" className="md:col-span-2"><Textarea id="li-notes" name="notes" defaultValue={item?.notes ?? ""} /></Field>
      <div className="flex justify-end gap-2 md:col-span-2">
        {onDone && <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>}
        <SubmitButton>{item ? "Salvar" : "Adicionar"}</SubmitButton>
      </div>
    </form>
  );
}
