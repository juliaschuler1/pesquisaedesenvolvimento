import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import type { CustomField } from "@/lib/custom-fields";
import { formatNumber } from "@/lib/format";

/** Renderiza os campos personalizados ativos (nomes cf_<key>). Pode ser usado em formulários server ou client. */
export function CustomFieldInputs({ fields, values = {}, errors = {} }: { fields: CustomField[]; values?: Record<string, unknown>; errors?: Record<string, string> }) {
  const active = fields.filter((f) => !f.archived_at).sort((a, b) => a.position - b.position);
  return (
    <>
      {active.map((f) => {
        const name = `cf_${f.key}`;
        const v = values[f.key];
        const id = `cf-${f.key}`;
        const hint = f.visibility === "internal" ? "Campo interno" : undefined;
        const common = { label: f.label, required: f.required, error: errors[name], htmlFor: id, hint };
        switch (f.field_type) {
          case "long_text":
            return (
              <Field key={f.id} {...common} className="md:col-span-2">
                <Textarea id={id} name={name} defaultValue={(v as string) ?? ""} />
              </Field>
            );
          case "number":
          case "currency":
          case "percent":
            return (
              <Field key={f.id} {...common} label={`${f.label}${f.field_type === "currency" ? " (R$)" : f.field_type === "percent" ? " (%)" : ""}`}>
                <Input id={id} name={name} inputMode="decimal" defaultValue={v === null || v === undefined ? "" : formatNumber(Number(v), f.field_type === "number" && Number(v) % 1 === 0 ? 0 : 2)} />
              </Field>
            );
          case "date":
            return (
              <Field key={f.id} {...common}>
                <Input id={id} name={name} type="date" defaultValue={(v as string) ?? ""} />
              </Field>
            );
          case "checkbox":
            return (
              <label key={f.id} className="flex items-center gap-2 self-end pb-2.5 text-[14px] text-ink">
                <input type="checkbox" name={name} defaultChecked={Boolean(v)} className="h-4 w-4 accent-[var(--brand-deep)]" /> {f.label}
              </label>
            );
          case "single_select":
            return (
              <Field key={f.id} {...common}>
                <Select id={id} name={name} defaultValue={(v as string) ?? ""} placeholder="Selecione" options={(f.settings.choices ?? []).map((c) => ({ value: c, label: c }))} />
              </Field>
            );
          case "multi_select":
            return (
              <Field key={f.id} {...common} className="md:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {(f.settings.choices ?? []).map((c) => (
                    <label key={c} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] ring-1 ring-pastel has-[:checked]:bg-deep has-[:checked]:text-white">
                      <input type="checkbox" name={name} value={c} defaultChecked={Array.isArray(v) && v.includes(c)} className="sr-only" /> {c}
                    </label>
                  ))}
                </div>
              </Field>
            );
          case "link":
            return (
              <Field key={f.id} {...common}>
                <Input id={id} name={name} type="url" defaultValue={(v as string) ?? ""} placeholder="https://" />
              </Field>
            );
          default:
            return (
              <Field key={f.id} {...common}>
                <Input id={id} name={name} defaultValue={(v as string) ?? ""} />
              </Field>
            );
        }
      })}
    </>
  );
}
