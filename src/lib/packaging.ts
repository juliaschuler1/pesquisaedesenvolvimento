/** Componentes de embalagem e agrupamento por biblioteca. */
export const COMPONENTS: Record<string, string> = {
  frasco: "Frasco",
  pote: "Pote",
  bisnaga: "Bisnaga",
  tampa: "Tampa",
  valvula: "Válvula",
  pump: "Pump",
  spray: "Spray",
  aplicador: "Aplicador",
  retentor: "Retentor",
  compacto: "Compacto",
  batom: "Mecanismo de batom",
  lapiseira: "Lapiseira",
  sache: "Sachê",
  refil: "Refil",
  cartucho: "Cartucho",
  rotulo: "Rótulo",
  sleeve: "Sleeve",
  outro: "Outro",
};

/** Cada página de biblioteca mostra um conjunto de componentes. */
export const LIBRARIES = {
  embalagens: { title: "Biblioteca de embalagens", description: "Frascos, potes, bisnagas, compactos e demais embalagens — com fotos, ficha técnica e fornecedor.", components: null as string[] | null },
  aplicadores: { title: "Biblioteca de aplicadores", description: "Aplicadores e retentores, com componentes compatíveis.", components: ["aplicador", "retentor"] },
  componentes: { title: "Válvulas e componentes", description: "Válvulas, pumps, sprays e tampas.", components: ["valvula", "pump", "spray", "tampa"] },
} as const;
