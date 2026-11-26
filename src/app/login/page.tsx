import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { BrandMark } from "@/components/shell/sidebar";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-blush lg:block" aria-hidden>
        <Swatches />
        <div className="absolute right-12 bottom-12 left-12">
          <p className="font-serif text-[44px] leading-[1.08] text-ink">
            Da concepção
            <br />
            ao lançamento.
          </p>
          <p className="mt-4 max-w-[42ch] text-[15px] text-ink-soft">
            Pesquisa, briefing, fornecedores, amostras e cronogramas de cada produto num só lugar.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 flex items-center gap-3">
            <BrandMark size={44} />
            <div>
              <p className="font-serif text-[19px] leading-tight text-ink">Beauty Development Studio</p>
              <p className="text-[12.5px] text-ink-soft">Pesquisa, desenvolvimento e inovação cosmética</p>
            </div>
          </div>
          <LoginForm next={next ?? ""} />
        </div>
      </section>
    </div>
  );
}

/** Composição de "cartela de cores": faixas como swatches de batom/esmalte. */
function Swatches() {
  const cols = ["#FFF7FA", "#FCE4EC", "#F4C2D7", "#E9A8C2", "#D98BAA", "#B76E8C", "#583746"];
  return (
    <div className="absolute inset-0 flex gap-3 px-12 pt-12 pb-[42%]">
      {cols.map((c, i) => (
        <div key={c} className="flex flex-1 flex-col justify-end" style={{ paddingTop: `${(i % 3) * 9 + i * 3}%` }}>
          <div className="h-full rounded-t-[999px] rounded-b-[28px] shadow-[0_20px_40px_-24px_rgb(88_55_70/0.5)]" style={{ background: c }} />
          <span className="mt-2 text-center text-[10.5px] tracking-wide text-ink-soft">{c}</span>
        </div>
      ))}
    </div>
  );
}
