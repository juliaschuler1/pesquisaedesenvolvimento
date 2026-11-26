"use client";

import { useActionState, useEffect, useState } from "react";
import { saveSku } from "../actions";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Dialog, SubmitButton, useActionToast } from "@/components/ui/interactive";
import { SKU_STATUS, VOLUME_UNITS, options, type SkuRow, type SkuShared } from "@/lib/domain";

export function SkuDialogButton({
  projectId,
  sku,
  shared,
  label = "Novo SKU",
  icon = "Plus",
  variant = "primary",
  size = "md",
  iconOnly,
}: {
  iconOnly?: boolean;
  projectId: string;
  sku?: SkuRow;
  shared: SkuShared;
  label?: string;
  icon?: string;
  variant?: "primary" | "ghost" | "secondary";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} icon={icon} onClick={() => setOpen(true)} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined} className={iconOnly ? "!px-2" : undefined}>
        {!iconOnly && label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={sku ? `Editar ${sku.name}` : "Novo SKU"} description="Campos em branco herdam as informações comuns do projeto." wide>
        <SkuForm projectId={projectId} sku={sku} shared={shared} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function SkuForm({ projectId, sku, shared, onDone }: { projectId: string; sku?: SkuRow; shared: SkuShared; onDone: () => void }) {
  const [state, action] = useActionState(saveSku, null);
  useActionToast(state);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const inherit = (v: unknown, suffix = "") => (v !== null && v !== undefined && v !== "" ? `Herdado: ${v}${suffix}` : undefined);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="project_id" value={projectId} />
      {sku && <input type="hidden" name="id" value={sku.id} />}
      <Field label="Nome" required error={state?.errors?.name} htmlFor="sku-name">
        <Input id="sku-name" name="name" defaultValue={sku?.name ?? ""} required autoFocus placeholder="Ex.: Glow Rosé" />
      </Field>
      <Field label="Código" htmlFor="sku-code">
        <Input id="sku-code" name="code" defaultValue={sku?.code ?? ""} />
      </Field>
      <Field label="GTIN/EAN" error={state?.errors?.gtin} htmlFor="sku-gtin">
        <Input id="sku-gtin" name="gtin" inputMode="numeric" defaultValue={sku?.gtin ?? ""} />
      </Field>
      <Field label="Status" htmlFor="sku-status">
        <Select id="sku-status" name="status" defaultValue={sku?.status ?? "in_development"} options={options(SKU_STATUS)} />
      </Field>
      <Field label="Cor" htmlFor="sku-color">
        <Input id="sku-color" name="color" defaultValue={sku?.color ?? ""} />
      </Field>
      <Field label="Pantone" htmlFor="sku-pantone">
        <Input id="sku-pantone" name="pantone" defaultValue={sku?.pantone ?? ""} placeholder="Ex.: 698 C" />
      </Field>
      <Field label="Fragrância" htmlFor="sku-fragrance" hint={inherit(shared.fragrance)}>
        <Input id="sku-fragrance" name="fragrance" defaultValue={sku?.fragrance ?? ""} />
      </Field>
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Field label="Volumetria" htmlFor="sku-volume" hint={inherit(shared.volume, shared.volume_unit ? ` ${shared.volume_unit}` : "")}>
          <Input id="sku-volume" name="volume" inputMode="decimal" defaultValue={sku?.volume ?? ""} />
        </Field>
        <Field label="Unidade" htmlFor="sku-unit">
          <Select id="sku-unit" name="volume_unit" defaultValue={sku?.volume_unit ?? shared.volume_unit ?? "ml"} options={VOLUME_UNITS.map((u) => ({ value: u, label: u }))} />
        </Field>
      </div>
      <Field label="Quantidade prevista (un.)" htmlFor="sku-qty">
        <Input id="sku-qty" name="planned_quantity" inputMode="numeric" defaultValue={sku?.planned_quantity ?? ""} />
      </Field>
      <Field label="Versão da amostra" htmlFor="sku-sample">
        <Input id="sku-sample" name="sample_version" defaultValue={sku?.sample_version ?? ""} placeholder="Ex.: V2" />
      </Field>
      <Field label="Embalagem" htmlFor="sku-pack" hint={inherit(shared.packaging)} className="md:col-span-2">
        <Input id="sku-pack" name="packaging" defaultValue={sku?.packaging ?? ""} />
      </Field>
      <Field label="Especificações técnicas" htmlFor="sku-specs" hint={shared.specs ? "Em branco: herda as especificações comuns" : undefined} className="md:col-span-2">
        <Textarea id="sku-specs" name="specs" defaultValue={sku?.specs ?? ""} />
      </Field>
      <Field label="Aprovações" htmlFor="sku-approvals" className="md:col-span-2">
        <Textarea id="sku-approvals" name="approvals" defaultValue={sku?.approvals ?? ""} placeholder="Ex.: cor aprovada pela cliente em 12/03" />
      </Field>
      <Field label="Imagem" htmlFor="sku-image" hint="PNG, JPG ou WEBP até 4 MB" className="md:col-span-2">
        <Input id="sku-image" name="image" type="file" accept="image/png,image/jpeg,image/webp" className="file:mr-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-1 file:text-deep" />
      </Field>
      <div className="flex justify-end gap-2 md:col-span-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <SubmitButton>{sku ? "Salvar SKU" : "Criar SKU"}</SubmitButton>
      </div>
    </form>
  );
}
