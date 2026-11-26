import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/primitives";
import { AuditTimeline } from "@/components/records/audit-timeline";

export const metadata: Metadata = { title: "Histórico de versões" };

export default async function HistoryPage() {
  const s = await getSession();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Histórico de versões" description="Cada criação, edição, arquivamento, exclusão e conclusão fica registrada com data, hora e campos alterados." />
      <AuditTimeline filter={{}} tz={s.settings.timezone} limit={300} />
    </div>
  );
}
