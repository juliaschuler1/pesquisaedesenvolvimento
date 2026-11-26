import type { Metadata } from "next";

export const metadata: Metadata = { title: "Configuração pendente" };

/** Exibida quando o site foi publicado sem as variáveis do Supabase. Não expõe nenhum valor. */
export default function SetupPending() {
  const url = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl rounded-[24px] bg-white p-8 shadow-[var(--shadow-soft)] ring-1 ring-blush">
        <h1 className="font-serif text-[28px] text-ink">Falta ligar o site ao banco de dados</h1>
        <p className="mt-2 text-[14px] text-ink-soft">O site foi publicado, mas não encontrou as variáveis do Supabase nesta hospedagem.</p>
        <ul className="mt-5 flex flex-col gap-2 text-[14px]">
          <li>{url ? "✅" : "❌"} NEXT_PUBLIC_SUPABASE_URL</li>
          <li>{key ? "✅" : "❌"} NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        </ul>
        <ol className="mt-6 list-decimal space-y-2 pl-5 text-[14px] text-ink">
          <li>Na Vercel, abra este projeto → <b>Settings</b> → <b>Environment Variables</b>.</li>
          <li>Adicione as variáveis marcadas com ❌ (valores em Supabase → Project Settings → API).</li>
          <li>Vá em <b>Deployments</b>, clique nos três pontos do último deploy → <b>Redeploy</b>.</li>
        </ol>
      </div>
    </div>
  );
}
