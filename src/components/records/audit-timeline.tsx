import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { describeAudit, FIELD_LABEL, type AuditRow } from "@/lib/audit";
import { formatDate, formatDateTime } from "@/lib/format";

const HIDDEN = new Set(["updated_at", "custom_data", "social", "position", "depends_on", "org_id"]);

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.length === 10 ? formatDate(v) : formatDateTime(v);
  if (typeof v === "object") return Array.isArray(v) ? (v as unknown[]).join(", ") || "vazio" : "dados atualizados";
  const s = String(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

/** Linha do tempo do histórico de alterações (somente leitura; gravada por trigger no banco). */
export async function AuditTimeline({ filter, tz, limit = 100 }: { filter: { client_id?: string; project_id?: string }; tz: string; limit?: number }) {
  const supabase = await createClient();
  let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (filter.client_id) q = q.eq("client_id", filter.client_id);
  if (filter.project_id) q = q.eq("project_id", filter.project_id);
  const { data } = await q;
  const rows = (data ?? []) as AuditRow[];

  return (
    <Card>
      <CardHeader title="Histórico de alterações" description="Registrado automaticamente a cada criação, edição, arquivamento ou exclusão." />
      {rows.length === 0 ? (
        <EmptyState icon="History" title="Nenhuma alteração registrada" className="!py-10" />
      ) : (
        <ol className="relative mx-5 my-5 border-l border-pastel">
          {rows.map((r) => {
            const t = describeAudit(r);
            const changes = Object.entries(r.changes ?? {}).filter(([k]) => !HIDDEN.has(k));
            return (
              <li key={r.id} className="relative pb-5 pl-6 last:pb-0">
                <span className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-white" aria-hidden />
                <p className="text-[13.5px] text-ink">
                  {t.entity} {t.href ? <Link href={t.href} className="font-medium hover:text-deep">{t.title}</Link> : <span className="font-medium">{t.title}</span>} {t.verb}
                </p>
                <p className="text-[12px] text-ink-soft">{formatDateTime(r.created_at, tz)}</p>
                {r.action === "update" && changes.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5 text-[12.5px] text-ink-soft">
                    {changes.slice(0, 6).map(([k, v]) => (
                      <li key={k}>
                        <span className="text-ink">{FIELD_LABEL[k] ?? k.replace(/_/g, " ")}</span>: {show(v.de)} → {show(v.para)}
                      </li>
                    ))}
                    {changes.length > 6 && <li>+{changes.length - 6} campos</li>}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
