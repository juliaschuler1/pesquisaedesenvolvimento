/** Cores personalizáveis por workspace. Somente valores hexadecimais são aceitos. */
export const THEME_KEYS = [
  { key: "bg", label: "Fundo principal", fallback: "#FFF7FA" },
  { key: "blush", label: "Rosa extremamente claro", fallback: "#FCE4EC" },
  { key: "pastel", label: "Rosa pastel", fallback: "#F4C2D7" },
  { key: "mid", label: "Rosa intermediário", fallback: "#E9A8C2" },
  { key: "accent", label: "Rosa de destaque", fallback: "#D98BAA" },
  { key: "deep", label: "Rosa queimado (botões)", fallback: "#B76E8C" },
  { key: "ink", label: "Texto principal", fallback: "#583746" },
  { key: "ink-soft", label: "Texto secundário", fallback: "#95677B" },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

export function themeToStyle(theme: Record<string, string> | null | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  for (const { key } of THEME_KEYS) {
    const v = theme?.[key];
    if (isHex(v)) style[`--brand-${key}`] = v;
  }
  return style;
}
