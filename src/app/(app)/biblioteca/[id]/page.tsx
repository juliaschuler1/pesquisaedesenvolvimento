import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { signedUrls } from "@/lib/storage";
import { isUuid } from "@/lib/forms";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { Card, CardHeader, DemoBadge, Badge } from "@/components/ui/primitives";
import { LifecycleActions } from "@/components/records/lifecycle";
import { AttachmentsPanel } from "@/components/attachments/panel";
import { AuditTimeline } from "@/components/records/audit-timeline";
import { LibraryItemForm, type LibraryItem } from "@/components/library/item-form";
import { KNOWLEDGE_LIBRARIES, isLibraryKey } from "@/lib/libraries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Biblioteca" };
  const supabase = await createClient();
  const { data } = await supabase.from("library_items").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Biblioteca" };
}

export default async function LibraryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const s = await getSession();
  const supabase = await createClient();
  const { data: item } = await supabase.from("library_items").select("*").eq("id", id).maybeSingle();
  const libKey = String(item?.library ?? "");
  if (!item || !isLibraryKey(libKey)) notFound();
  const cfg = KNOWLEDGE_LIBRARIES[libKey];
  const [opts, fields, { data: suppliers }, urls] = await Promise.all([
    loadOptionSets([cfg.categorySet]),
    loadCustomFields(`library:${libKey}`),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    signedUrls(supabase, [item.image_path]),
  ]);

  return (
    <div>
      <Link href={`/${libKey}`} className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-soft hover:text-deep">‹ {cfg.title}</Link>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-5">
          {item.image_path && urls[item.image_path] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[item.image_path]} alt="" className="h-20 w-20 rounded-3xl object-cover ring-1 ring-blush" />
          )}
          <div>
            <h1 className="font-serif text-[30px] leading-tight text-ink">{item.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.category && <Badge tone="rose">{item.category}</Badge>}
              {(item.tags as string[]).map((t) => <Badge key={t}>{t}</Badge>)}
              {item.is_demo && <DemoBadge />}
              {item.archived_at && <Badge tone="warning">Arquivado</Badge>}
            </div>
            {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13px] text-deep hover:underline">{item.source_name || "Abrir fonte"} ↗</a>}
          </div>
        </div>
        <div className="flex gap-1"><LifecycleActions entity="library_items" id={id} name={item.name} archivedAt={item.archived_at} deletedAt={item.deleted_at} noun={`esta ${cfg.singular}`} /></div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader title="Ficha" description="Edite e salve. Toda alteração fica no histórico." />
          <div className="p-5">
            <LibraryItemForm
              library={libKey}
              categoryLabel={cfg.categoryLabel}
              categorySet={cfg.categorySet}
              categories={opts[cfg.categorySet]}
              nameHint={cfg.nameHint}
              suppliers={suppliers ?? []}
              fields={fields}
              item={item as LibraryItem}
            />
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <AttachmentsPanel orgId={s.orgId} entityType="library_items" entityId={id} back={`/biblioteca/${id}`} tz={s.settings.timezone} title="Fichas técnicas e documentos" />
          <AuditTimeline filter={{ entity: { type: "library_items", id } }} tz={s.settings.timezone} limit={30} />
        </div>
      </div>
    </div>
  );
}
