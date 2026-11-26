"use client";

import { useActionState } from "react";
import { saveCustomTabContent } from "../actions";
import { Textarea } from "@/components/ui/primitives";
import { SubmitButton, useActionToast } from "@/components/ui/interactive";

export function CustomTabEditor({ projectId, tabKey, content }: { projectId: string; tabKey: string; content: string }) {
  const [state, action] = useActionState(saveCustomTabContent, null);
  useActionToast(state);
  return (
    <form action={action} className="flex flex-col gap-3 p-5">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="key" value={tabKey} />
      <Textarea name="content" defaultValue={content} rows={12} className="min-h-[260px]" placeholder="Anotações, decisões, especificações e links desta aba." aria-label="Conteúdo da aba" />
      <div className="flex justify-end">
        <SubmitButton>Salvar conteúdo</SubmitButton>
      </div>
    </form>
  );
}
