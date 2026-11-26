import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/domain";
import { Icon } from "./icon";

export const cx = clsx;

/* ---------------------------------- Botões ---------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-deep text-white shadow-[0_6px_16px_-8px_rgb(183_110_140/0.9)] hover:bg-[#a35f7c] active:translate-y-px",
  secondary: "bg-white text-ink ring-1 ring-pastel hover:ring-mid hover:bg-[#fffafc]",
  soft: "bg-blush text-deep hover:bg-pastel/70",
  ghost: "text-ink-soft hover:bg-blush hover:text-ink",
  danger: "bg-danger text-white hover:bg-[#963745]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-10 px-4 text-sm gap-2 rounded-[var(--radius-control)]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background,box-shadow,color,transform] duration-150 disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; icon?: string }) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children}
    </Link>
  );
}

/* ---------------------------------- Cartões --------------------------------- */

export function Card({
  className,
  children,
  as: As = "section",
  ...rest
}: { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & Omit<
  ComponentProps<"section">,
  "className" | "children" | "ref"
>) {
  return (
    <As
      className={cx("rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-soft)] ring-1 ring-blush", className)}
      {...rest}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------------------------------- Selos ----------------------------------- */

const tones: Record<Tone, string> = {
  neutral: "bg-[#f4eef1] text-ink-soft",
  rose: "bg-blush text-deep",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function DemoBadge() {
  return (
    <Badge tone="info" className="!px-2 !text-[11px]">
      Demonstração
    </Badge>
  );
}

/** Selo para funcionalidade ainda não implementada — nunca um botão decorativo. */
export function PlannedBadge({ phase }: { phase?: number | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-mid px-2 py-0.5 text-[11px] font-medium text-ink-soft">
      {phase ? `Fase ${phase}` : "Em breve"}
    </span>
  );
}

/* ------------------------------- Progresso ---------------------------------- */

export function ProgressBar({ value, className, tone = "rose" }: { value: number | null; className?: string; tone?: "rose" | "danger" }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-blush", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-700", tone === "danger" ? "bg-danger/80" : "bg-gradient-to-r from-mid to-deep")}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/* ------------------------------- Cabeçalhos --------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-deep">
            <span aria-hidden>‹</span> {back.label}
          </Link>
        )}
        <h1 className="font-serif text-[30px] leading-[1.15] font-medium tracking-[-0.01em] text-ink md:text-[34px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[68ch] text-[14px] text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ------------------------------- Estado vazio ------------------------------- */

export function EmptyState({
  icon = "Sparkles",
  title,
  description,
  action,
  className,
}: {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="relative mb-5 grid h-16 w-16 place-items-center">
        <span className="absolute inset-0 rotate-12 rounded-[22px] bg-blush" />
        <span className="absolute inset-1.5 -rotate-6 rounded-[18px] bg-pastel/60" />
        <Icon name={icon} size={24} className="relative text-deep" />
      </div>
      <h3 className="font-serif text-xl text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-[46ch] text-[14px] text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------- Campos ------------------------------------- */

export const inputClass =
  "w-full rounded-[var(--radius-control)] border border-pastel bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-soft/60 transition-colors hover:border-mid focus:border-deep focus:outline-none focus:ring-3 focus:ring-pastel/50";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  required,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-deep">*</span>}
      </label>
      {children}
      {error ? <p className="text-[12px] text-danger">{error}</p> : hint ? <p className="text-[12px] text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(inputClass, "min-h-[88px] resize-y leading-relaxed", props.className)} />;
}

export function Select({
  options,
  placeholder,
  ...props
}: ComponentProps<"select"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={cx(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2395677b%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_0.9rem_center] bg-no-repeat pr-9", props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="font-serif text-lg text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </Card>
  );
}

/* ------------------------------- Avatar ------------------------------------- */

const AVATAR_TINTS = ["bg-blush text-deep", "bg-pastel/70 text-ink", "bg-[#f3e6f0] text-[#7d4f6a]", "bg-[#fbe9e2] text-[#9a5a4c]", "bg-[#ece8f6] text-info"];

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const tint = AVATAR_TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  const letters = name.replace(/\[.*?\]/g, "").trim().split(/\s+/).filter(Boolean);
  const text = ((letters[0]?.[0] ?? "") + (letters.length > 1 ? letters[letters.length - 1][0] : "")).toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={cx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-full font-semibold", tint, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {text || "?"}
    </span>
  );
}
