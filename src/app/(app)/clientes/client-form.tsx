"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveClient } from "./actions";
import { addOption } from "@/lib/actions/common";
import { Field, FormSection, Input, Textarea, buttonClass } from "@/components/ui/primitives";
import { ChipMultiSelect, OptionSelect, SubmitButton, useActionToast } from "@/components/ui/interactive";
import type { ClientRow } from "@/lib/domain";
import type { CustomField } from "@/lib/custom-fields";
import { CustomFieldInputs } from "@/components/custom-fields/inputs";

export function ClientForm({
  client,
  logoUrl,
  segments,
  channels,
  customFields = [],
}: {
  client?: ClientRow | null;
  logoUrl?: string | null;
  segments: string[];
  channels: string[];
  customFields?: CustomField[];
}) {
  const [state, action] = useActionState(saveClient, null);
  useActionToast(state);
  const e = state?.errors ?? {};
  const c = client;

  return (
    <form action={action} className="flex flex-col gap-6" encType="multipart/form-data">
      {c && <input type="hidden" name="id" value={c.id} />}

      <FormSection title="Identificação" description="Como a cliente e a marca aparecem na plataforma e nos documentos.">
        <Field label="Nome do cliente" required error={e.name} htmlFor="name">
          <Input id="name" name="name" defaultValue={c?.name ?? ""} required placeholder="Razão social ou nome da cliente" />
        </Field>
        <Field label="Nome da marca" htmlFor="brand_name">
          <Input id="brand_name" name="brand_name" defaultValue={c?.brand_name ?? ""} />
        </Field>
        <Field label="CNPJ" error={e.cnpj} htmlFor="cnpj">
          <Input id="cnpj" name="cnpj" defaultValue={c?.cnpj ?? ""} inputMode="numeric" placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="Início da consultoria" htmlFor="consulting_started_on" hint="DD/MM/AAAA">
          <Input id="consulting_started_on" type="date" name="consulting_started_on" defaultValue={c?.consulting_started_on ?? ""} />
        </Field>
        <Field label="Logo" error={e.logo} htmlFor="logo" hint="PNG, JPG, WEBP ou SVG até 4 MB" className="md:col-span-2">
          <div className="flex items-center gap-4">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo atual" className="h-14 w-14 rounded-xl bg-white object-contain ring-1 ring-blush" />
            )}
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="file:mr-3 file:rounded-lg file:border-0 file:bg-blush file:px-3 file:py-1 file:text-deep" />
            {logoUrl && (
              <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-soft">
                <input type="checkbox" name="remove_logo" className="accent-[var(--brand-deep)]" /> Remover
              </label>
            )}
          </div>
        </Field>
      </FormSection>

      <FormSection title="Contato" description="Contatos adicionais (responsáveis) são cadastrados na pasta do cliente.">
        <Field label="E-mail" error={e.email} htmlFor="email">
          <Input id="email" type="email" name="email" defaultValue={c?.email ?? ""} />
        </Field>
        <Field label="Telefone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={c?.phone ?? ""} inputMode="tel" />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp">
          <Input id="whatsapp" name="whatsapp" defaultValue={c?.whatsapp ?? ""} inputMode="tel" />
        </Field>
        <Field label="Site" htmlFor="website">
          <Input id="website" name="website" defaultValue={c?.website ?? ""} placeholder="www.marca.com.br" />
        </Field>
        <Field label="Instagram" htmlFor="social_instagram">
          <Input id="social_instagram" name="social_instagram" defaultValue={c?.social?.instagram ?? ""} placeholder="@marca" />
        </Field>
        <Field label="TikTok" htmlFor="social_tiktok">
          <Input id="social_tiktok" name="social_tiktok" defaultValue={c?.social?.tiktok ?? ""} />
        </Field>
        <Field label="LinkedIn" htmlFor="social_linkedin">
          <Input id="social_linkedin" name="social_linkedin" defaultValue={c?.social?.linkedin ?? ""} />
        </Field>
        <Field label="Outra rede" htmlFor="social_outra">
          <Input id="social_outra" name="social_outra" defaultValue={c?.social?.outra ?? ""} />
        </Field>
      </FormSection>

      <FormSection title="Estratégia e mercado">
        <Field label="Segmento" htmlFor="segment">
          <OptionSelect id="segment" name="segment" setKey="client_segments" options={segments} defaultValue={c?.segment} addOption={addOption} />
        </Field>
        <Field label="Posicionamento" htmlFor="positioning">
          <Input id="positioning" name="positioning" defaultValue={c?.positioning ?? ""} placeholder="Ex.: maquiagem clean premium" />
        </Field>
        <Field label="Público-alvo" htmlFor="target_audience" className="md:col-span-2">
          <Textarea id="target_audience" name="target_audience" defaultValue={c?.target_audience ?? ""} />
        </Field>
        <Field label="Canais de venda" className="md:col-span-2">
          <ChipMultiSelect name="sales_channels" setKey="sales_channels" options={channels} defaultValue={c?.sales_channels ?? []} addOption={addOption} />
        </Field>
        <Field label="Informações comerciais" htmlFor="commercial_info" className="md:col-span-2">
          <Textarea id="commercial_info" name="commercial_info" defaultValue={c?.commercial_info ?? ""} placeholder="Condições do contrato, escopo, formato de cobrança…" />
        </Field>
      </FormSection>

      <FormSection title="Campos personalizados" description="Campos criados por você no Construtor de módulos.">
        {customFields.length ? (
          <CustomFieldInputs fields={customFields} values={c?.custom_data ?? {}} errors={e} />
        ) : (
          <p className="text-[13px] text-ink-soft md:col-span-2">
            Nenhum campo extra ainda. <Link href="/construtor-modulos?entidade=clients" className="text-deep hover:underline">Criar campo personalizado</Link>
          </p>
        )}
      </FormSection>

      <FormSection title="Observações">
        <Field label="Observações" htmlFor="notes" hint="Podem aparecer em documentos compartilhados com a cliente.">
          <Textarea id="notes" name="notes" defaultValue={c?.notes ?? ""} />
        </Field>
        <Field label="Observações internas" htmlFor="private_notes" hint="Nunca aparecem em documentos, no modo reunião ou para a cliente.">
          <Textarea id="private_notes" name="private_notes" defaultValue={c?.private_notes ?? ""} className="bg-[#fffafc]" />
        </Field>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-blush bg-bg/90 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        <Link href={c ? `/clientes/${c.id}` : "/clientes"} className={buttonClass("secondary")}>
          Cancelar
        </Link>
        <SubmitButton>{c ? "Salvar alterações" : "Criar cliente"}</SubmitButton>
      </div>
    </form>
  );
}
