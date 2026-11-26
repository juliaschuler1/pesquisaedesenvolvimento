import Link from "next/link";
import { buttonClass } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <p className="font-serif text-[64px] leading-none text-pastel">404</p>
      <h1 className="mt-3 font-serif text-[26px] text-ink">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-[14px] text-ink-soft">O endereço pode ter mudado, ou o registro foi excluído ou pertence a outro workspace.</p>
      <Link href="/dashboard" className={buttonClass("primary", "md", "mt-6")}>Voltar ao dashboard</Link>
    </div>
  );
}
