/** Texto legível para entradas do histórico de alterações. */

const ENTITY: Record<string, { label: string; href?: (id: string, row: AuditRow) => string | null }> = {
  clients: { label: "Cliente", href: (id) => `/clientes/${id}` },
  projects: { label: "Projeto", href: (id) => `/projetos/${id}` },
  skus: { label: "SKU", href: (_id, r) => (r.project_id ? `/projetos/${r.project_id}?aba=skus` : null) },
  schedule_items: { label: "Etapa do cronograma", href: (_id, r) => (r.project_id ? `/projetos/${r.project_id}?aba=cronograma` : null) },
  activities: { label: "Atividade", href: (_id, r) => (r.project_id ? `/projetos/${r.project_id}?aba=atividades` : "/atividades") },
  custom_records: { label: "Registro" },
};

const ACTION: Record<string, string> = {
  insert: "criado",
  update: "atualizado",
  delete: "excluído",
  archive: "arquivado",
  restore: "restaurado",
  complete: "concluído",
};

export type AuditRow = {
  id: number;
  entity_type: string;
  entity_id: string | null;
  action: string;
  label: string | null;
  created_at: string;
  project_id: string | null;
  client_id: string | null;
  changes?: Record<string, { de: unknown; para: unknown }> | null;
};

export function describeAudit(r: AuditRow) {
  const e = ENTITY[r.entity_type] ?? { label: r.entity_type };
  const verb = ACTION[r.action] ?? r.action;
  const href = r.entity_id && e.href && r.action !== "delete" ? e.href(r.entity_id, r) : null;
  return { entity: e.label, verb, href, title: r.label ?? "(sem nome)" };
}

/** Nomes amigáveis dos campos alterados. */
export const FIELD_LABEL: Record<string, string> = {
  name: "nome", title: "título", status: "status", priority: "prioridade", launch_date: "previsão de lançamento",
  start_date: "data de início", planned_start: "início previsto", planned_end: "término previsto", actual_start: "início real",
  actual_end: "término real", category: "categoria", target_cost: "custo-alvo", budget: "orçamento", completed_at: "conclusão",
  due_at: "prazo", notes: "observações", private_notes: "observações internas", code: "código", archived_at: "arquivamento",
  deleted_at: "exclusão", weight: "peso", brand_name: "marca", segment: "segmento", concept: "conceito", objective: "objetivo",
  sku_shared: "informações comuns dos SKUs", volume: "volumetria", pantone: "Pantone", color: "cor", gtin: "GTIN/EAN",
};
