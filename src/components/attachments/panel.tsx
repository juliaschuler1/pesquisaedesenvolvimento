import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { ConfirmAction, QuickAction } from "@/components/ui/interactive";
import { Icon } from "@/components/ui/icon";
import { deleteAttachment, toggleAttachmentVisibility } from "@/lib/actions/attachments";
import { formatDateTime } from "@/lib/format";
import { Uploader } from "./uploader";

function size(b: number | null) {
  if (!b) return "";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export async function AttachmentsPanel({
  orgId,
  entityType,
  entityId,
  back,
  tz,
  title = "Documentos e imagens",
}: {
  orgId: string;
  entityType: string;
  entityId: string;
  back: string;
  tz: string;
  title?: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("id, storage_path, file_name, mime_type, size_bytes, kind, visibility, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  const files = data ?? [];
  const urls = await signedUrls(supabase, files.map((f) => f.storage_path));
  const images = files.filter((f) => f.kind === "image");
  const docs = files.filter((f) => f.kind !== "image");

  return (
    <Card>
      <CardHeader title={title} description="Arquivos privados do workspace. Marque como compartilhável o que pode ir para documentos do cliente." />
      <div className="p-5">
        <Uploader orgId={orgId} entityType={entityType} entityId={entityId} back={back} />

        {files.length === 0 ? (
          <EmptyState icon="Paperclip" title="Nenhum arquivo ainda" description="Contratos, laudos, fotos de amostras, catálogos e referências ficam guardados aqui." className="!py-8" />
        ) : (
          <>
            {images.length > 0 && (
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((f) => (
                  <li key={f.id} className="group overflow-hidden rounded-2xl bg-blush/50 ring-1 ring-blush">
                    <a href={urls[f.storage_path]} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urls[f.storage_path]} alt={f.file_name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    </a>
                    <div className="flex items-center gap-1 px-2.5 py-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink" title={f.file_name}>{f.file_name}</span>
                      <VisibilityToggle id={f.id} visibility={f.visibility} />
                      <ConfirmAction action={deleteAttachment} fields={{ id: f.id }} label="" icon="Trash2" title="Excluir arquivo?" description={`“${f.file_name}” será removido permanentemente.`} confirmLabel="Excluir arquivo" danger className="!px-1.5" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {docs.length > 0 && (
              <ul className="mt-6 divide-y divide-blush rounded-2xl ring-1 ring-blush">
                {docs.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blush text-deep">
                      <Icon name="FileText" size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <a href={urls[f.storage_path]} target="_blank" rel="noreferrer" className="block truncate text-[14px] text-ink hover:text-deep">{f.file_name}</a>
                      <span className="text-[12px] text-ink-soft">{size(f.size_bytes)} · {formatDateTime(f.created_at, tz)}</span>
                    </span>
                    <VisibilityToggle id={f.id} visibility={f.visibility} />
                    <ConfirmAction action={deleteAttachment} fields={{ id: f.id }} label="" icon="Trash2" title="Excluir arquivo?" description={`“${f.file_name}” será removido permanentemente.`} confirmLabel="Excluir arquivo" danger className="!px-1.5" />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function VisibilityToggle({ id, visibility }: { id: string; visibility: string }) {
  return (
    <span className="flex items-center gap-1">
      <Badge tone={visibility === "shareable" ? "success" : "neutral"} className="!text-[11px]">{visibility === "shareable" ? "Compartilhável" : "Interno"}</Badge>
      <QuickAction
        action={toggleAttachmentVisibility}
        fields={{ id, to: visibility === "shareable" ? "internal" : "shareable" }}
        label={visibility === "shareable" ? "Tornar interno" : "Tornar compartilhável"}
        icon={visibility === "shareable" ? "EyeOff" : "Eye"}
        iconOnly
      />
    </span>
  );
}
