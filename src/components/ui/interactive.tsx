"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X, Check, AlertTriangle, Plus } from "lucide-react";
import { Button, cx, inputClass } from "./primitives";
import { Icon } from "./icon";

/* --------------------------------- Toasts ---------------------------------- */

type Toast = { id: number; kind: "success" | "error"; message: string };
const ToastCtx = createContext<(kind: Toast["kind"], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-[14px] shadow-[var(--shadow-lift)] ring-1",
              t.kind === "success" ? "ring-pastel" : "ring-danger/30",
            )}
            style={{ animation: "toast-in .25s ease-out both" }}
            role={t.kind === "error" ? "alert" : "status"}
          >
            <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", t.kind === "success" ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>
              {t.kind === "success" ? <Check size={13} /> : <AlertTriangle size={12} />}
            </span>
            <p className="flex-1 text-ink">{t.message}</p>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-ink-soft hover:text-ink" aria-label="Fechar aviso">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ------------------------------ Resultado de ações -------------------------- */

export type ActionResult = { ok: boolean; message?: string; errors?: Record<string, string> } | null;

/** Mostra o toast correspondente ao resultado de uma Server Action. */
export function useActionToast(state: ActionResult) {
  const toast = useToast();
  const last = useRef<ActionResult>(null);
  useEffect(() => {
    if (state && state !== last.current && state.message) {
      toast(state.ok ? "success" : "error", state.message);
    }
    last.current = state;
  }, [state, toast]);
}

/* ------------------------------ Botão de envio ------------------------------ */

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  icon,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "soft" | "danger";
  icon?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className} aria-busy={pending}>
      {pending ? <Loader2 size={16} className="animate-spin" /> : icon ? <Icon name={icon} size={17} /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}

/* --------------------------------- Diálogo --------------------------------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        "m-auto w-[calc(100vw-2rem)] rounded-[24px] bg-white p-0 text-ink shadow-[var(--shadow-lift)] backdrop:bg-[#583746]/25 backdrop:backdrop-blur-[2px]",
        wide ? "max-w-2xl" : "max-w-md",
      )}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-ink">{title}</h2>
              {description && <p className="mt-1 text-[13px] text-ink-soft">{description}</p>}
            </div>
            <button onClick={onClose} className="rounded-full p-1 text-ink-soft hover:bg-blush hover:text-ink" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* ------------------------ Ação com confirmação ------------------------------ */

/**
 * Botão que pede confirmação antes de executar uma Server Action.
 * `action` recebe os campos ocultos via FormData.
 */
export function ConfirmAction({
  action,
  fields,
  label,
  icon,
  title,
  description,
  confirmLabel,
  danger,
  variant = "ghost",
  size = "sm",
  className,
}: {
  action: (fd: FormData) => Promise<ActionResult | void>;
  fields: Record<string, string>;
  label: string;
  icon?: string;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  variant?: "ghost" | "secondary" | "soft" | "danger";
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        icon={icon}
        onClick={() => setOpen(true)}
        className={className}
        aria-label={label ? undefined : title.replace(/\?$/, "")}
        title={label ? undefined : title.replace(/\?$/, "")}
      >
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Voltar
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const fd = new FormData();
                Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
                const res = await action(fd);
                if (res && res.message) toast(res.ok ? "success" : "error", res.message);
                setOpen(false);
              })
            }
          >
            {pending && <Loader2 size={16} className="animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/** Ação imediata (sem confirmação), com toast de retorno. */
export function QuickAction({
  action,
  fields,
  label,
  icon,
  variant = "ghost",
  size = "sm",
  className,
  iconOnly,
}: {
  action: (fd: FormData) => Promise<ActionResult | void>;
  fields: Record<string, string>;
  label: string;
  icon?: string;
  variant?: "ghost" | "secondary" | "soft" | "primary";
  size?: "sm" | "md";
  className?: string;
  iconOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cx(iconOnly && "!px-2", className)}
      onClick={() =>
        start(async () => {
          const fd = new FormData();
          Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
          const res = await action(fd);
          if (res && res.message) toast(res.ok ? "success" : "error", res.message);
        })
      }
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : icon ? <Icon name={icon} size={15} /> : null}
      {!iconOnly && label}
    </Button>
  );
}

/* --------------------- Seleção com "+ Adicionar nova opção" ------------------ */

export function OptionSelect({
  name,
  setKey,
  options,
  defaultValue,
  placeholder = "Selecione",
  addOption,
  id,
}: {
  name: string;
  setKey: string;
  options: string[];
  defaultValue?: string | null;
  placeholder?: string;
  addOption: (setKey: string, label: string) => Promise<ActionResult>;
  id?: string;
}) {
  const [list, setList] = useState(options);
  const [value, setValue] = useState(defaultValue ?? "");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const autoId = useId();

  // valor existente fora da lista (ex.: opção arquivada) continua visível
  const all = value && !list.includes(value) ? [value, ...list] : list;

  function save() {
    const label = draft.trim();
    if (!label) return;
    start(async () => {
      const res = await addOption(setKey, label);
      if (res?.ok) {
        setList((l) => (l.includes(label) ? l : [...l, label]));
        setValue(label);
        setDraft("");
        setAdding(false);
      }
      if (res?.message) toast(res.ok ? "success" : "error", res.message);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        id={id ?? autoId}
        name={name}
        value={value}
        onChange={(e) => {
          if (e.target.value === "__add__") {
            setAdding(true);
            return;
          }
          setValue(e.target.value);
        }}
        className={cx(inputClass, "appearance-none")}
      >
        <option value="">{placeholder}</option>
        {all.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__add__">+ Adicionar nova opção</option>
      </select>
      {adding && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nome da nova opção"
            className={inputClass}
            aria-label="Nome da nova opção"
          />
          <Button type="button" size="md" variant="soft" onClick={save} disabled={pending || !draft.trim()}>
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Adicionar
          </Button>
          <Button type="button" size="md" variant="ghost" onClick={() => setAdding(false)}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

/** Múltipla escolha em chips, com "+ Adicionar nova opção". */
export function ChipMultiSelect({
  name,
  setKey,
  options,
  defaultValue = [],
  addOption,
}: {
  name: string;
  setKey: string;
  options: string[];
  defaultValue?: string[];
  addOption: (setKey: string, label: string) => Promise<ActionResult>;
}) {
  const [list, setList] = useState(() => Array.from(new Set([...options, ...defaultValue])));
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const toggle = (o: string) => setSelected((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));

  return (
    <div className="flex flex-wrap gap-2">
      {selected.map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}
      {list.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => toggle(o)}
            aria-pressed={on}
            className={cx(
              "rounded-full px-3 py-1.5 text-[13px] transition-colors",
              on ? "bg-deep text-white" : "bg-white text-ink ring-1 ring-pastel hover:ring-mid",
            )}
          >
            {o}
          </button>
        );
      })}
      {adding ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const label = draft.trim();
                if (!label) return;
                start(async () => {
                  const res = await addOption(setKey, label);
                  if (res?.ok) {
                    setList((l) => (l.includes(label) ? l : [...l, label]));
                    setSelected((s) => [...s, label]);
                    setDraft("");
                    setAdding(false);
                  }
                  if (res?.message) toast(res.ok ? "success" : "error", res.message);
                });
              }
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="Nova opção e Enter"
            className="h-8 w-44 rounded-full border border-pastel px-3 text-[13px] focus:border-deep focus:outline-none"
            aria-label="Nova opção"
          />
          {pending && <Loader2 size={14} className="animate-spin text-ink-soft" />}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full border border-dashed border-mid px-3 py-1.5 text-[13px] text-deep hover:bg-blush"
        >
          + Adicionar nova opção
        </button>
      )}
    </div>
  );
}
