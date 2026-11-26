"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Loader2, LogOut, Menu, Plus, Search, Settings } from "lucide-react";
import { Avatar, cx } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";
import { searchEverything, signOut, type SearchHit } from "@/lib/actions/common";

const QUICK_ADD = [
  { href: "/clientes/novo", label: "Novo cliente", icon: "Users" },
  { href: "/projetos/novo", label: "Novo projeto", icon: "FolderKanban" },
  { href: "/atividades?nova=1", label: "Nova atividade", icon: "ListChecks" },
  { href: "/atividades?nova=1&tipo=follow_up", label: "Novo follow-up", icon: "MessagesSquare" },
  { href: "/briefings", label: "Novo briefing", icon: "ClipboardList", phase: 4 },
  { href: "/fornecedores", label: "Novo fornecedor", icon: "Contact", phase: 2 },
];

const TYPE_LABEL: Record<string, string> = { cliente: "Cliente", projeto: "Projeto", sku: "SKU", registro: "Registro" };

export function Topbar({ fullName, email, onOpenMenu }: { fullName: string; email: string; onOpenMenu: () => void }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-blush/70 bg-bg/85 px-4 py-3 backdrop-blur md:px-8">
      <button onClick={onOpenMenu} className="rounded-xl p-2 text-ink-soft hover:bg-blush lg:hidden" aria-label="Abrir menu">
        <Menu size={20} />
      </button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-2">
        <QuickAdd />
        <UserMenu fullName={fullName} email={email} />
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setHits(await searchEverything(q))), 220);
    return () => clearTimeout(t);
  }, [q]);
  const shown = q.trim().length >= 2 ? hits : [];

  const go = (h: SearchHit) => {
    setOpen(false);
    setQ("");
    router.push(h.href);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-soft" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, shown.length - 1));
          if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          if (e.key === "Enter" && shown[active]) go(shown[active]);
          if (e.key === "Escape") inputRef.current?.blur();
        }}
        placeholder="Buscar clientes, projetos, SKUs…"
        className="h-10 w-full rounded-full border border-blush bg-white pr-14 pl-10 text-[14px] text-ink placeholder:text-ink-soft/70 focus:border-mid focus:outline-none focus:ring-3 focus:ring-pastel/40"
        aria-label="Pesquisa global"
        role="combobox"
        aria-expanded={open && q.length >= 2}
        aria-controls="global-search-results"
      />
      <span className="pointer-events-none absolute top-1/2 right-3.5 hidden -translate-y-1/2 rounded-md bg-blush px-1.5 text-[11px] text-ink-soft md:block">
        {pending ? <Loader2 size={12} className="my-0.5 animate-spin" /> : "Ctrl K"}
      </span>
      {open && q.trim().length >= 2 && (
        <div id="global-search-results" role="listbox" className="absolute top-12 right-0 left-0 z-50 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-lift)] ring-1 ring-blush">
          {shown.length === 0 && !pending && <p className="px-4 py-4 text-[13px] text-ink-soft">Nada encontrado para “{q}”.</p>}
          {shown.map((h, i) => (
            <button
              key={h.entity_type + h.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(h);
              }}
              className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left", i === active ? "bg-blush" : "hover:bg-[#fff3f7]")}
            >
              <span className="w-16 shrink-0 text-[11.5px] text-ink-soft">{TYPE_LABEL[h.entity_type] ?? h.entity_type}</span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-ink">{h.title}</span>
                {h.subtitle && <span className="block truncate text-[12px] text-ink-soft">{h.subtitle}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onOut]);
  return ref;
}

function QuickAdd() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-deep px-4 text-[14px] font-medium text-white shadow-[0_6px_16px_-8px_rgb(183_110_140/0.9)] hover:bg-[#a35f7c]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Plus size={17} />
        <span className="hidden sm:inline">Criar</span>
      </button>
      {open && (
        <div role="menu" className="absolute top-12 right-0 z-50 w-60 rounded-2xl bg-white p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-blush">
          {QUICK_ADD.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-ink hover:bg-blush"
            >
              <Icon name={a.icon} size={17} className="text-deep" />
              <span className="flex-1">{a.label}</span>
              {a.phase && <span className="rounded-full border border-dashed border-pastel px-1.5 text-[10.5px] text-ink-soft">F{a.phase}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({ fullName, email }: { fullName: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-blush" aria-expanded={open} aria-haspopup="menu">
        <Avatar name={fullName || email} size={34} />
        <span className="hidden text-left md:block">
          <span className="block max-w-[160px] truncate text-[13.5px] font-medium text-ink">{fullName}</span>
          <span className="block max-w-[160px] truncate text-[11.5px] text-ink-soft">{email}</span>
        </span>
        <ChevronDown size={15} className="text-ink-soft" />
      </button>
      {open && (
        <div role="menu" className="absolute top-12 right-0 z-50 w-56 rounded-2xl bg-white p-1.5 shadow-[var(--shadow-lift)] ring-1 ring-blush">
          <Link href="/configuracoes" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-ink hover:bg-blush">
            <Settings size={16} className="text-deep" /> Configurações
          </Link>
          <form action={signOut}>
            <button role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[14px] text-ink hover:bg-blush">
              <LogOut size={16} className="text-deep" /> Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
