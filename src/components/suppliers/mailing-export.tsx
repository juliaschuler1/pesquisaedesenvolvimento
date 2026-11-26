"use client";

import { useState } from "react";
import { Button } from "@/components/ui/primitives";

/** Exporta a lista exibida (com os filtros atuais) como planilha .xlsx. */
export function MailingExport({ rows }: { rows: Record<string, string>[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      icon="Download"
      disabled={busy || rows.length === 0}
      onClick={async () => {
        setBusy(true);
        try {
          const { default: writeXlsxFile } = await import("write-excel-file/browser");
          const cols = Object.keys(rows[0]);
          const data = [cols.map((c) => ({ value: c, fontWeight: "bold" })), ...rows.map((r) => cols.map((c) => ({ value: r[c] ?? "" })))];
          const today = new Date().toISOString().slice(0, 10);
          await writeXlsxFile(data as never).toFile(`mailing-fornecedores-${today}.xlsx`);
        } finally {
          setBusy(false);
        }
      }}
    >
      Exportar mailing
    </Button>
  );
}
