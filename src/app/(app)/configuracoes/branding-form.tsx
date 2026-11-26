"use client";

import { useActionState, useState } from "react";
import { saveBranding } from "@/lib/actions/admin";
import { Field, Input } from "@/components/ui/primitives";
import { SubmitButton, useActionToast } from "@/components/ui/interactive";
import { THEME_KEYS } from "@/lib/theme";

export function BrandingForm({ brandName, tagline, theme, timezone, logoUrl, disabled }: { brandName: string; tagline: string | null; theme: Record<string, string>; timezone: string; logoUrl: string | null; disabled: boolean }) {
  const [state, action] = useActionState(saveBranding, null);
  useActionToast(state);
  const [colors, setColors] = useState<Record<string, string>>(() => Object.fromEntries(THEME_KEYS.map((k) => [k.key, theme[k.key] ?? k.fallback])));

  return (
    <form action={action} className="grid gap-5 p-5 md:grid-cols-2">
      <fieldset disabled={disabled} className="contents">
        <Field label="Nome da plataforma" htmlFor="brand_name">
          <Input id="brand_name" name="brand_name" defaultValue={brandName} />
        </Field>
        <Field label="Assinatura" htmlFor="tagline">
          <Input id="tagline" name="tagline" defaultValue={tagline ?? ""} />
        </Field>
        <Field label="Logo" htmlFor="logo" hint="PNG, JPG, WEBP ou SVG até 4 MB. Aparece no menu e, futuramente, nos PDFs." error={state?.errors?.logo}>
          <div className="flex items-center gap-3">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo atual" className="h-12 w-12 rounded-xl bg-white object-contain ring-1 ring-blush" />
            )}
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="file:mr-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-1 file:text-deep" />
            {logoUrl && <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-soft"><input type="checkbox" name="remove_logo" className="accent-[var(--brand-deep)]" /> Remover</label>}
          </div>
        </Field>
        <Field label="Fuso horário" htmlFor="timezone" hint="Padrão: America/Sao_Paulo" error={state?.errors?.timezone}>
          <Input id="timezone" name="timezone" defaultValue={timezone} />
        </Field>

        <fieldset className="md:col-span-2">
          <legend className="mb-3 text-[13px] font-medium text-ink">Paleta de cores</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THEME_KEYS.map((k) => (
              <label key={k.key} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-blush">
                <input
                  type="color"
                  name={`color_${k.key}`}
                  value={colors[k.key]}
                  onChange={(e) => setColors((c) => ({ ...c, [k.key]: e.target.value }))}
                  className="h-10 w-10 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                  aria-label={k.label}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] text-ink">{k.label}</span>
                  <span className="block text-[11.5px] text-ink-soft uppercase tabular">{colors[k.key]}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-blush" style={{ background: colors.bg }} aria-label="Prévia">
            <div className="flex items-center gap-4 p-4">
              <span className="h-10 w-10 rounded-xl" style={{ background: colors.blush }} />
              <span className="flex-1">
                <span className="block font-serif text-[18px]" style={{ color: colors.ink }}>Prévia da identidade</span>
                <span className="block text-[12.5px]" style={{ color: colors["ink-soft"] }}>Texto secundário e rótulos</span>
              </span>
              <span className="rounded-xl px-4 py-2 text-[13px] text-white" style={{ background: colors.deep }}>Botão</span>
            </div>
            <div className="flex h-2">
              {["pastel", "mid", "accent", "deep"].map((k) => <span key={k} className="flex-1" style={{ background: colors[k] }} />)}
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-soft">
            <input type="checkbox" name="reset_colors" className="accent-[var(--brand-deep)]" /> Restaurar a paleta original
          </label>
        </fieldset>
        <div className="flex justify-end md:col-span-2">
          <SubmitButton>Salvar identidade</SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
