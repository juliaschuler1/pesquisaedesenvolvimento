import { Card } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/icon";

/** Painel honesto para áreas ainda não implementadas: diz o que virá e em que fase. */
export function PlannedPanel({ icon, title, phase, items }: { icon: string; title: string; phase: number; items: string[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-6 p-7 md:grid-cols-[auto_1fr] md:items-start">
        <div className="relative grid h-16 w-16 place-items-center">
          <span className="absolute inset-0 rotate-6 rounded-[22px] border-2 border-dashed border-pastel" />
          <Icon name={icon} size={24} className="text-deep" />
        </div>
        <div>
          <p className="text-[13px] text-ink-soft">Previsto para a Fase {phase} do plano de implementação</p>
          <h2 className="mt-1 font-serif text-[24px] text-ink">{title}</h2>
          <p className="mt-2 max-w-[62ch] text-[14px] text-ink-soft">
            Esta área ainda não está implementada. A estrutura de dados já está preparada para recebê-la sem retrabalho. O que ela vai fazer:
          </p>
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {items.map((i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mid" aria-hidden />
                {i}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
