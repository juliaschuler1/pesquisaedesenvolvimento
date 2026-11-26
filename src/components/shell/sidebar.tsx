"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cx } from "@/components/ui/primitives";
import type { NavGroup } from "@/lib/session";

const STORAGE_KEY = "bds.sidebar";

type Prefs = { collapsed: boolean; closedGroups: string[] };
const DEFAULT_PREFS = "{}";

/** Preferência local do menu (conveniência por navegador; nunca dado da plataforma). */
function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("bds-sidebar", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("bds-sidebar", cb);
  };
}
function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {}
  window.dispatchEvent(new Event("bds-sidebar"));
}

export function Sidebar({
  nav,
  brandName,
  tagline,
  logoUrl,
  mobileOpen,
  onCloseMobile,
}: {
  nav: NavGroup[];
  brandName: string;
  tagline: string | null;
  logoUrl: string | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, readRaw, () => DEFAULT_PREFS);
  const { collapsed, closedGroups } = useMemo<Prefs>(() => {
    try {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return { collapsed: Boolean(p.collapsed), closedGroups: Array.isArray(p.closedGroups) ? p.closedGroups : [] };
    } catch {
      return { collapsed: false, closedGroups: [] };
    }
  }, [raw]);

  useEffect(() => {
    onCloseMobile();
    // fecha o menu móvel ao navegar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleCollapsed = () => {
    writePrefs({ collapsed: !collapsed, closedGroups });
  };
  const toggleGroup = (key: string) => {
    const next = closedGroups.includes(key) ? closedGroups.filter((k) => k !== key) : [...closedGroups, key];
    writePrefs({ collapsed, closedGroups: next });
  };

  const isCollapsed = collapsed && !mobileOpen;

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px] lg:hidden" onClick={onCloseMobile} aria-hidden />}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-blush bg-white/90 backdrop-blur transition-[width,transform] duration-300 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          isCollapsed ? "w-[76px]" : "w-[272px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Menu principal"
      >
        <div className={cx("flex items-center gap-3 px-5 pt-6 pb-5", isCollapsed && "justify-center px-0")}>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3" title={brandName}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
            ) : (
              <BrandMark />
            )}
            {!isCollapsed && (
              <span className="min-w-0">
                <span className="block truncate font-serif text-[17px] leading-tight text-ink">{brandName}</span>
                {tagline && <span className="block truncate text-[11.5px] text-ink-soft">{tagline}</span>}
              </span>
            )}
          </Link>
          <button onClick={onCloseMobile} className="ml-auto rounded-full p-1 text-ink-soft hover:bg-blush lg:hidden" aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {nav
            .filter((g) => g.visible)
            .map((g) => {
              const mods = g.modules.filter((m) => m.visible && m.enabled);
              if (mods.length === 0) return null;
              const open = isCollapsed || !closedGroups.includes(g.key);
              return (
                <div key={g.id} className="mb-1.5">
                  {!isCollapsed ? (
                    <button
                      onClick={() => toggleGroup(g.key)}
                      className="flex w-full items-center justify-between rounded-lg px-3 pt-3 pb-1.5 text-[12px] font-medium text-ink-soft/90 hover:text-ink"
                      aria-expanded={open}
                    >
                      {g.label}
                      <ChevronDown size={14} className={cx("transition-transform", !open && "-rotate-90")} />
                    </button>
                  ) : (
                    <div className="mx-auto my-2 h-px w-8 bg-blush" />
                  )}
                  {open && (
                    <ul className="flex flex-col gap-0.5">
                      {mods.map((m) => {
                        const href = `/${m.key}`;
                        const active = pathname === href || pathname.startsWith(href + "/");
                        const planned = m.availability === "planned";
                        return (
                          <li key={m.id}>
                            <Link
                              href={href}
                              title={isCollapsed ? m.label : planned ? `${m.label} — previsto para a Fase ${m.phase}` : undefined}
                              className={cx(
                                "group relative flex items-center gap-3 rounded-xl py-2 text-[14px] transition-colors",
                                isCollapsed ? "justify-center px-0" : "px-3",
                                active ? "bg-blush font-medium text-ink" : "text-ink/80 hover:bg-[#fff0f5] hover:text-ink",
                                planned && !active && "text-ink-soft/75",
                              )}
                              aria-current={active ? "page" : undefined}
                            >
                              {active && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-deep" />}
                              <Icon name={m.icon} size={18} className={cx(active ? "text-deep" : "text-ink-soft group-hover:text-deep")} />
                              {!isCollapsed && <span className="flex-1 truncate">{m.label}</span>}
                              {!isCollapsed && planned && (
                                <span className="rounded-full border border-dashed border-pastel px-1.5 text-[10.5px] text-ink-soft/80">F{m.phase}</span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}

          <Link
            href="/construtor-modulos?novo=1"
            className={cx(
              "mt-3 flex items-center gap-2 rounded-xl border border-dashed border-mid py-2.5 text-[13.5px] font-medium text-deep hover:bg-blush",
              isCollapsed ? "justify-center px-0" : "px-3",
            )}
            title="Adicionar novo módulo"
          >
            <Plus size={16} />
            {!isCollapsed && "Adicionar novo módulo"}
          </Link>
        </nav>

        <div className="hidden border-t border-blush p-3 lg:block">
          <button
            onClick={toggleCollapsed}
            className={cx("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-soft hover:bg-blush hover:text-ink", isCollapsed && "justify-center px-0")}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {isCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!isCollapsed && "Recolher menu"}
          </button>
        </div>
      </aside>
    </>
  );
}

/** Monograma padrão enquanto nenhuma logo é enviada: gota estilizada em tons de rosa. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect width="40" height="40" rx="12" fill="#FCE4EC" />
      <path d="M20 8c4.6 6 8 10.3 8 14.6A8 8 0 0 1 12 22.6C12 18.3 15.4 14 20 8Z" fill="#E9A8C2" />
      <path d="M20 14.5c2.6 3.4 4.4 5.9 4.4 8.3a4.4 4.4 0 0 1-8.8 0c0-2.4 1.8-4.9 4.4-8.3Z" fill="#B76E8C" />
      <circle cx="17.6" cy="20.4" r="1.3" fill="#fff" opacity=".85" />
    </svg>
  );
}
