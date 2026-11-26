"use client";

import { useActionState, useEffect, useRef } from "react";
import { addContact, deleteContact } from "../actions";
import { Avatar, Badge, Card, CardHeader, EmptyState, Field, Input } from "@/components/ui/primitives";
import { ConfirmAction, SubmitButton, useActionToast } from "@/components/ui/interactive";

type Contact = { id: string; name: string; role: string | null; email: string | null; phone: string | null; whatsapp: string | null; is_primary: boolean };

export function ContactsPanel({ clientId, contacts }: { clientId: string; contacts: Contact[] }) {
  const [state, action] = useActionState(addContact, null);
  useActionToast(state);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader title="Responsáveis e contatos" description="Pessoas com quem você conversa nesta cliente." />
        {contacts.length === 0 ? (
          <EmptyState icon="Users" title="Nenhum contato" description="Adicione responsáveis de marketing, produto, compras ou diretoria." className="!py-10" />
        ) : (
          <ul className="divide-y divide-blush p-2">
            {contacts
              .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
              .map((ct) => (
                <li key={ct.id} className="flex items-center gap-3 px-3 py-3">
                  <Avatar name={ct.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[14px] text-ink">
                      {ct.name} {ct.is_primary && <Badge tone="rose">Principal</Badge>}
                    </p>
                    <p className="truncate text-[12.5px] text-ink-soft">{[ct.role, ct.email, ct.phone, ct.whatsapp && `WhatsApp ${ct.whatsapp}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <ConfirmAction action={deleteContact} fields={{ id: ct.id }} label="" icon="Trash2" title="Remover contato?" description={`${ct.name} será removido desta cliente.`} confirmLabel="Remover" danger className="!px-2" />
                </li>
              ))}
          </ul>
        )}
      </Card>
      <Card className="h-fit">
        <CardHeader title="Novo contato" />
        <form ref={form} action={action} className="flex flex-col gap-3 p-5">
          <input type="hidden" name="client_id" value={clientId} />
          <Field label="Nome" required htmlFor="ct-name" error={state?.errors?.name}>
            <Input id="ct-name" name="name" required />
          </Field>
          <Field label="Cargo" htmlFor="ct-role">
            <Input id="ct-role" name="role" placeholder="Ex.: Gerente de produto" />
          </Field>
          <Field label="E-mail" htmlFor="ct-email">
            <Input id="ct-email" name="email" type="email" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone" htmlFor="ct-phone">
              <Input id="ct-phone" name="phone" inputMode="tel" />
            </Field>
            <Field label="WhatsApp" htmlFor="ct-wa">
              <Input id="ct-wa" name="whatsapp" inputMode="tel" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" name="is_primary" className="accent-[var(--brand-deep)]" /> Contato principal
          </label>
          <SubmitButton icon="Plus">Adicionar contato</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
