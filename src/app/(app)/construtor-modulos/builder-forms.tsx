"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, Pencil, Trash2, X } from "lucide-react";
import { createModule, saveCustomField, updateModule } from "@/lib/actions/admin";
import { Field, Input, PlannedBadge, Select, Textarea, cx } from "@/components/ui/primitives";
import { SubmitButton, useActionToast, useToast } from "@/components/ui/interactive";
import { ICON_CHOICES, Icon } from "@/components/ui/icon";
import { FIELD_TYPE_LABEL } from "@/lib/custom-fields";

export function NewModuleForm({ groups, autoFocus }: { groups: { id: string; label: string }[]; autoFocus?: boolean }) {
  const [state, action] = useActionState(createModule, null);
  useActionToast(state);
  const [icon, setIcon] = useState("Sparkles");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Field label="Nome do módulo" required htmlFor="mod-label" error={state?.errors?.label}>
        <Input ref={ref} id="mod-label" name="label" placeholder="Ex.: Gestão de fragrâncias" required />
      </Field>
      <Field label="Grupo do menu" htmlFor="mod-group" error={state?.errors?.group_id}>
        <Select id="mod-group" name="group_id" defaultValue={groups.find((g) => g.label.includes("conhecimento"))?.id ?? groups[0]?.id} options={groups.map((g) => ({ value: g.id, label: g.label }))} />
      </Field>
      <Field label="Visualização padrão" htmlFor="mod-view">
        <Select
          id="mod-view"
          name="default_view"
          defaultValue="table"
          options={[
            { value: "table", label: "Tabela" },
            { value: "cards", label: "Cards" },
            { value: "checklist", label: "Checklist" },
          ]}
        />
      </Field>
      <Field label="Escopo" htmlFor="mod-scope" hint="Registros podem ser vinculados a clientes ou projetos.">
        <Select
          id="mod-scope"
          name="scope"
          defaultValue="global"
          options={[
            { value: "global", label: "Global (todo o workspace)" },
            { value: "client", label: "Por cliente" },
            { value: "project", label: "Por projeto" },
          ]}
        />
      </Field>
      <Field label="Descrição" htmlFor="mod-desc" className="md:col-span-2">
        <Textarea id="mod-desc" name="description" rows={2} placeholder="Para que serve este módulo." />
      </Field>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-[13px] font-medium text-ink">Ícone</legend>
        <input type="hidden" name="icon" value={icon} />
        <div className="flex flex-wrap gap-1.5">
          {ICON_CHOICES.map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setIcon(n)}
              aria-pressed={icon === n}
              aria-label={n}
              className={cx("grid h-10 w-10 place-items-center rounded-xl transition-colors", icon === n ? "bg-deep text-white" : "bg-white text-ink-soft ring-1 ring-blush hover:text-deep")}
            >
              <Icon name={n} size={18} />
            </button>
          ))}
        </div>
      </fieldset>
      <p className="text-[12.5px] text-ink-soft md:col-span-2">
        Kanban, calendário, galeria, permissões por módulo e relacionamentos avançados entram no construtor completo (Fase 6). Os módulos criados agora já usam o banco permanente e recebem campos personalizados.
      </p>
      <div className="flex justify-end md:col-span-2">
        <SubmitButton icon="Plus">Criar módulo</SubmitButton>
      </div>
    </form>
  );
}

type Mod = { id: string; key: string; label: string; icon: string; kind: string; availability: string; phase: number | null; visible: boolean; group_id: string | null };

export function ModuleRow({ m, groups, first, last }: { m: Mod; groups: { id: string; label: string }[]; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(m.label);
  const toast = useToast();
  const run = (fields: Record<string, string>) =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", m.id);
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
      const res = await updateModule(fd);
      if (res?.message) toast(res.ok ? "success" : "error", res.message);
      if (res?.ok) setEditing(false);
    });

  return (
    <li className={cx("flex flex-wrap items-center gap-2 px-4 py-2.5", !m.visible && "opacity-55")}>
      <Icon name={m.icon} size={17} className="text-deep" />
      {editing ? (
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            run({ op: "rename", label });
          }}
        >
          <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus className="h-8 flex-1 rounded-lg border border-pastel px-2 text-[14px] focus:border-deep focus:outline-none" aria-label="Novo nome" />
          <button type="submit" className="rounded-lg p-1.5 text-success hover:bg-success-bg" aria-label="Salvar nome"><Check size={15} /></button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush" aria-label="Cancelar"><X size={15} /></button>
        </form>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[14px] text-ink">
          <span className="truncate">{m.label}</span>
          {m.kind === "custom" && <span className="rounded-full bg-blush px-2 py-0.5 text-[11px] text-deep">personalizado</span>}
          {m.availability === "planned" && <PlannedBadge phase={m.phase} />}
        </span>
      )}
      {pending && <Loader2 size={14} className="animate-spin text-ink-soft" />}
      <select
        value={m.group_id ?? ""}
        onChange={(e) => run({ op: "group", group_id: e.target.value })}
        className="h-8 rounded-lg border border-blush bg-white px-2 text-[12.5px] text-ink-soft"
        aria-label={`Grupo de ${m.label}`}
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.label}</option>
        ))}
      </select>
      <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush" aria-label={`Renomear ${m.label}`}><Pencil size={15} /></button>
      <button disabled={first || pending} onClick={() => run({ op: "up" })} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush disabled:opacity-30" aria-label={`Mover ${m.label} para cima`}><ArrowUp size={15} /></button>
      <button disabled={last || pending} onClick={() => run({ op: "down" })} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush disabled:opacity-30" aria-label={`Mover ${m.label} para baixo`}><ArrowDown size={15} /></button>
      <button disabled={pending} onClick={() => run({ op: "toggle" })} className="rounded-lg p-1.5 text-ink-soft hover:bg-blush" aria-label={m.visible ? `Ocultar ${m.label}` : `Mostrar ${m.label}`}>
        {m.visible ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
      {m.kind === "custom" && (
        <button
          disabled={pending}
          onClick={() => {
            if (confirm(`Excluir o módulo “${m.label}”? Só é possível se não houver registros.`)) run({ op: "delete" });
          }}
          className="rounded-lg p-1.5 text-danger hover:bg-danger-bg"
          aria-label={`Excluir ${m.label}`}
        >
          <Trash2 size={15} />
        </button>
      )}
    </li>
  );
}

export function NewFieldForm({ entity }: { entity: string }) {
  // conta envios bem-sucedidos para recriar (limpar) o formulário sem efeitos
  const [state, action] = useActionState(async (prev: (Awaited<ReturnType<typeof saveCustomField>> & { n?: number }) | null, fd: FormData) => {
    const r = await saveCustomField(prev, fd);
    return { ...(r ?? { ok: false }), n: (prev?.n ?? 0) + (r?.ok ? 1 : 0) };
  }, null);
  useActionToast(state);
  return <FieldFormBody key={state?.n ?? 0} entity={entity} action={action} errors={state?.errors ?? {}} />;
}

function FieldFormBody({ entity, action, errors }: { entity: string; action: (fd: FormData) => void; errors: Record<string, string> }) {
  const [type, setType] = useState("short_text");
  const needsChoices = type === "single_select" || type === "multi_select";
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="entity" value={entity} />
      <Field label="Nome do campo" required htmlFor="cf-label" error={errors.label}>
        <Input id="cf-label" name="label" required placeholder="Ex.: Família olfativa" />
      </Field>
      <Field label="Tipo" htmlFor="cf-type">
        <Select id="cf-type" name="field_type" value={type} onChange={(e) => setType(e.target.value)} options={Object.entries(FIELD_TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
      </Field>
      {needsChoices && (
        <Field label="Opções" htmlFor="cf-choices" hint="Uma por linha" className="md:col-span-2" error={errors.choices}>
          <Textarea id="cf-choices" name="choices" rows={4} placeholder={"Floral\nAmadeirada\nCítrica"} />
        </Field>
      )}
      <Field label="Seção" htmlFor="cf-section" hint="Opcional, para agrupar campos">
        <Input id="cf-section" name="section" />
      </Field>
      <div className="flex flex-col justify-end gap-2 pb-1">
        <label className="flex items-center gap-2 text-[13.5px] text-ink">
          <input type="checkbox" name="required" className="accent-[var(--brand-deep)]" /> Obrigatório
        </label>
        <label className="flex items-center gap-2 text-[13.5px] text-ink">
          <input type="checkbox" name="visibility" value="shareable" className="accent-[var(--brand-deep)]" /> Compartilhável com clientes
        </label>
      </div>
      <div className="flex justify-end md:col-span-2">
        <SubmitButton icon="Plus">Adicionar campo</SubmitButton>
      </div>
    </form>
  );
}
