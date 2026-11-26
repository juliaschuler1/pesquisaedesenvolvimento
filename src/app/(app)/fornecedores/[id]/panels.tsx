"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { addSupplierContact, deleteSupplierContact, linkSupplierToProject, setCapability } from "../actions";
import { addOption } from "@/lib/actions/common";
import { Avatar, Badge, Card, CardHeader, EmptyState, Field, Input, Select, cx } from "@/components/ui/primitives";
import { ConfirmAction, SubmitButton, useActionToast, useToast } from "@/components/ui/interactive";
import { CAPABILITY_LABEL } from "@/lib/import/targets";

type Status = keyof typeof CAPABILITY_LABEL;
const STATUS_STYLE: Record<Status, string> = {
  apto: "bg-success-bg text-success ring-success/30",
  em_avaliacao: "bg-info-bg text-info ring-info/30",
  suspenso: "bg-warning-bg text-warning ring-warning/30",
  na: "bg-[#f4eef1] text-ink-soft ring-blush",
};

/** Matriz de aptidão: cada capacidade com status clicável. */
export function CapabilityMatrix({ supplierId, all, current }: { supplierId: string; all: string[]; current: Record<string, Status> }) {
  const [state, setState] = useState(current);
  const [list, setList] = useState(() => [...new Set([...all, ...Object.keys(current)])]);
  const [pending, start] = useTransition();
  const [busyCap, setBusyCap] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const toast = useToast();

  const set = (cap: string, status: Status | "") =>
    start(async () => {
      setBusyCap(cap);
      const fd = new FormData();
      fd.set("supplier_id", supplierId);
      fd.set("capability", cap);
      fd.set("status", status);
      const res = await setCapability(fd);
      setBusyCap(null);
      if (!res?.ok) return toast("error", res?.message ?? "Não foi possível salvar.");
      setState((s) => {
        const n = { ...s };
        if (status) n[cap] = status;
        else delete n[cap];
        return n;
      });
    });

  return (
    <Card>
      <CardHeader title="Aptidão por tipo de produto" description="Clique para alterar. Vazio = não informado." />
      <ul className="grid gap-2 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((cap) => {
          const st = state[cap];
          return (
            <li key={cap} className="flex items-center gap-2 rounded-xl bg-[#fffafc] px-3 py-2 ring-1 ring-blush">
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink" title={cap}>{cap}</span>
              {busyCap === cap && <Loader2 size={13} className="animate-spin text-ink-soft" />}
              <select
                value={st ?? ""}
                disabled={pending && busyCap === cap}
                onChange={(e) => set(cap, e.target.value as Status | "")}
                className={cx("h-8 rounded-full px-2.5 text-[12px] font-medium ring-1", st ? STATUS_STYLE[st] : "bg-white text-ink-soft ring-blush")}
                aria-label={`Status para ${cap}`}
              >
                <option value="">—</option>
                {(Object.keys(CAPABILITY_LABEL) as Status[]).map((s) => <option key={s} value={s}>{CAPABILITY_LABEL[s]}</option>)}
              </select>
            </li>
          );
        })}
      </ul>
      <form
        className="flex gap-2 border-t border-blush px-5 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          const label = draft.trim();
          if (!label) return;
          start(async () => {
            await addOption("supplier_capabilities", label);
            setList((l) => (l.includes(label) ? l : [...l, label]));
            setDraft("");
          });
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="+ Adicionar novo tipo de produto" className="h-9 flex-1 rounded-lg px-2 text-[13.5px] placeholder:text-deep/70 focus:ring-1 focus:ring-pastel focus:outline-none" aria-label="Novo tipo de produto" />
      </form>
    </Card>
  );
}

type Contact = { id: string; name: string; role: string | null; email: string | null; phone: string | null; whatsapp: string | null; is_primary: boolean };

export function SupplierContacts({ supplierId, contacts }: { supplierId: string; contacts: Contact[] }) {
  const [state, action] = useActionState(addSupplierContact, null);
  useActionToast(state);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Contatos" description="Comercial, técnico, P&D, qualidade…" />
        {contacts.length === 0 ? (
          <EmptyState icon="Users" title="Nenhum contato" className="!py-10" />
        ) : (
          <ul className="divide-y divide-blush p-2">
            {[...contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                <Avatar name={c.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[14px] text-ink">{c.name} {c.is_primary && <Badge tone="rose">Principal</Badge>}</p>
                  <p className="truncate text-[12.5px] text-ink-soft">{[c.role, c.email, c.phone, c.whatsapp && `WhatsApp ${c.whatsapp}`].filter(Boolean).join(" · ")}</p>
                </div>
                <ConfirmAction action={deleteSupplierContact} fields={{ id: c.id }} label="" icon="Trash2" title="Remover contato?" description={`${c.name} será removido.`} confirmLabel="Remover" danger className="!px-2" />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="h-fit">
        <CardHeader title="Novo contato" />
        <form ref={form} action={action} className="flex flex-col gap-3 p-5">
          <input type="hidden" name="supplier_id" value={supplierId} />
          <Field label="Nome" required htmlFor="sc-name" error={state?.errors?.name}><Input id="sc-name" name="name" required /></Field>
          <Field label="Cargo" htmlFor="sc-role"><Input id="sc-role" name="role" /></Field>
          <Field label="E-mail" htmlFor="sc-email"><Input id="sc-email" name="email" type="email" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone" htmlFor="sc-phone"><Input id="sc-phone" name="phone" /></Field>
            <Field label="WhatsApp" htmlFor="sc-wa"><Input id="sc-wa" name="whatsapp" /></Field>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" name="is_primary" className="accent-[var(--brand-deep)]" /> Contato principal</label>
          <SubmitButton icon="Plus">Adicionar contato</SubmitButton>
        </form>
      </Card>
    </div>
  );
}

export function LinkProjectForm({ supplierId, projectId, projects, suppliers }: { supplierId?: string; projectId?: string; projects?: { id: string; name: string }[]; suppliers?: { id: string; name: string }[] }) {
  const [state, action] = useActionState(linkSupplierToProject, null);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 p-5">
      {supplierId && <input type="hidden" name="supplier_id" value={supplierId} />}
      {projectId && <input type="hidden" name="project_id" value={projectId} />}
      {projects && (
        <Field label="Projeto" htmlFor="lp-project" className="min-w-[220px] flex-1">
          <Select id="lp-project" name="project_id" defaultValue="" placeholder="Selecione o projeto" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
      )}
      {suppliers && (
        <Field label="Fornecedor" htmlFor="lp-supplier" className="min-w-[220px] flex-1">
          <Select id="lp-supplier" name="supplier_id" defaultValue="" placeholder="Selecione o fornecedor" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        </Field>
      )}
      <Field label="Papel no projeto" htmlFor="lp-role" className="min-w-[180px] flex-1">
        <Input id="lp-role" name="role" placeholder="Ex.: terceirista, embalagem primária" />
      </Field>
      <SubmitButton icon="Plus">Vincular</SubmitButton>
    </form>
  );
}
