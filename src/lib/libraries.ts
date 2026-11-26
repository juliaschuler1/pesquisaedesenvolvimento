/** Bibliotecas técnicas (banco de conhecimento). Campos específicos = campos personalizados `library:<chave>`. */
export const KNOWLEDGE_LIBRARIES = {
  "materias-primas": { title: "Matérias-primas", singular: "matéria-prima", icon: "Atom", categorySet: "raw_material_categories", categoryLabel: "Categoria", nameHint: "Nome comercial ou INCI", description: "Matérias-primas com fornecedores, funções, fichas técnicas e fontes." },
  ativos: { title: "Ativos", singular: "ativo", icon: "Sparkles", categorySet: "active_functions", categoryLabel: "Função principal", nameHint: "Ex.: Niacinamida", description: "Ativos cosméticos, funções, concentrações de uso de referência e evidências." },
  fragrancias: { title: "Fragrâncias", singular: "fragrância", icon: "Flower2", categorySet: "olfactive_families", categoryLabel: "Família olfativa", nameHint: "Ex.: Baunilha suave", description: "Fragrâncias por família olfativa, casa de fragrância e aplicação." },
  claims: { title: "Claims e tecnologias", singular: "claim ou tecnologia", icon: "BadgeCheck", categorySet: "claims", categoryLabel: "Claim relacionado", nameHint: "Ex.: Longa duração 24 h", description: "Claims, tecnologias e as evidências necessárias para comprová-los." },
  referencias: { title: "Referências e tendências", singular: "referência", icon: "TrendingUp", categorySet: "reference_types", categoryLabel: "Tipo", nameHint: "Ex.: Tendência glass skin 2027", description: "Tendências, lançamentos, relatórios e artigos com fonte e data." },
} as const;

export type LibraryKey = keyof typeof KNOWLEDGE_LIBRARIES;

export function isLibraryKey(k: string): k is LibraryKey {
  return k in KNOWLEDGE_LIBRARIES;
}
