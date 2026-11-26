import { ConfirmAction, QuickAction } from "@/components/ui/interactive";
import { archiveRecord, purgeRecord, restoreRecord, trashRecord, unarchiveRecord } from "@/lib/actions/records";

/** Botões de arquivar / restaurar / excluir (lixeira) / excluir definitivamente, conforme o estado do registro. */
export function LifecycleActions({
  entity,
  id,
  name,
  archivedAt,
  deletedAt,
  noun,
  compact,
}: {
  entity: "clients" | "projects" | "skus" | "custom_records";
  id: string;
  name: string;
  archivedAt: string | null;
  deletedAt: string | null;
  noun: string;
  compact?: boolean;
}) {
  const c = compact ? { className: "!px-2", label: "" } : null;
  const fields = { entity, id };
  if (deletedAt) {
    return (
      <>
        <QuickAction action={restoreRecord} fields={fields} label="Restaurar" icon="Undo2" variant="secondary" />
        <ConfirmAction
          action={purgeRecord}
          fields={fields}
          label="Excluir definitivamente"
          icon="Trash2"
          title={`Excluir “${name}” definitivamente?`}
          description="Esta ação não pode ser desfeita. O histórico de alterações é preservado."
          confirmLabel="Excluir definitivamente"
          danger
        />
      </>
    );
  }
  return (
    <>
      {archivedAt ? (
        <QuickAction action={unarchiveRecord} fields={fields} label="Desarquivar" icon="ArchiveRestore" variant="secondary" iconOnly={compact} />
      ) : (
        <ConfirmAction
          action={archiveRecord}
          fields={fields}
          label={c ? "" : "Arquivar"}
          className={c?.className}
          icon="Archive"
          title={`Arquivar ${noun}?`}
          description={`“${name}” sai das listas e indicadores, mas continua disponível em “Arquivados”.`}
          confirmLabel="Arquivar"
          variant="ghost"
        />
      )}
      <ConfirmAction
        action={trashRecord}
        fields={fields}
        label={c ? "" : "Excluir"}
        className={c?.className}
        icon="Trash2"
        title={`Excluir ${noun}?`}
        description={`“${name}” vai para a lixeira. Você pode restaurá-lo em Configurações → Lixeira.`}
        confirmLabel="Mover para a lixeira"
        danger
      />
    </>
  );
}
