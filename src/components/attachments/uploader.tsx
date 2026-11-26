"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { registerAttachment } from "@/lib/actions/attachments";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, safeFileName } from "@/lib/storage-rules";
import { useToast } from "@/components/ui/interactive";
import { cx } from "@/components/ui/primitives";

/** Envio direto do navegador ao Storage privado (sem limite de 4,5 MB das funções). */
export function Uploader({ orgId, entityType, entityId, back }: { orgId: string; entityType: string; entityId: string; back: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [visibility, setVisibility] = useState<"internal" | "shareable">("internal");
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  async function send(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 20);
    if (list.length === 0) return;
    const supabase = createClient();
    let ok = 0;
    for (const f of list) {
      if (!DOCUMENT_TYPES.includes(f.type)) {
        toast("error", `${f.name}: tipo de arquivo não permitido.`);
        continue;
      }
      if (f.size > MAX_DOCUMENT_BYTES) {
        toast("error", `${f.name}: excede 25 MB.`);
        continue;
      }
      setBusy(f.name);
      const path = `${orgId}/${entityType}/${entityId}/${Date.now()}-${safeFileName(f.name)}`;
      const { error } = await supabase.storage.from("files").upload(path, f, { contentType: f.type });
      if (error) {
        toast("error", `${f.name}: falha no envio.`);
        continue;
      }
      const res = await registerAttachment({ entityType, entityId, storagePath: path, fileName: f.name, mimeType: f.type, size: f.size, visibility, back });
      if (res?.ok) ok++;
      else toast("error", res?.message ?? `${f.name}: não registrado.`);
    }
    setBusy(null);
    if (ok) {
      toast("success", ok === 1 ? "Arquivo enviado." : `${ok} arquivos enviados.`);
      router.refresh();
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          send(e.dataTransfer.files);
        }}
        className={cx(
          "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          drag ? "border-deep bg-blush" : "border-pastel bg-[#fffafc]",
        )}
      >
        {busy ? <Loader2 className="animate-spin text-deep" /> : <UploadCloud className="text-deep" strokeWidth={1.6} />}
        <p className="text-[14px] text-ink">{busy ? `Enviando ${busy}…` : "Arraste arquivos aqui ou"}</p>
        {!busy && (
          <button type="button" onClick={() => input.current?.click()} className="text-[14px] font-medium text-deep underline-offset-4 hover:underline">
            escolha no computador
          </button>
        )}
        <p className="text-[12px] text-ink-soft">Imagens, PDF, planilhas, documentos e ZIP · até 25 MB cada</p>
        <input ref={input} type="file" multiple hidden accept={DOCUMENT_TYPES.join(",")} onChange={(e) => e.target.files && send(e.target.files)} />
      </div>
      <fieldset className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-ink">
        <legend className="sr-only">Visibilidade dos novos arquivos</legend>
        <span className="text-ink-soft">Novos arquivos:</span>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="vis" checked={visibility === "internal"} onChange={() => setVisibility("internal")} className="accent-[var(--brand-deep)]" /> Internos
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="vis" checked={visibility === "shareable"} onChange={() => setVisibility("shareable")} className="accent-[var(--brand-deep)]" /> Compartilháveis com o cliente
        </label>
      </fieldset>
    </div>
  );
}
