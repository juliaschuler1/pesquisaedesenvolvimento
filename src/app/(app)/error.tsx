"use client";

import { Button } from "@/components/ui/primitives";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-serif text-[26px] text-ink">Algo não carregou como deveria</h1>
      <p className="mt-2 max-w-md text-[14px] text-ink-soft">
        {error.message?.includes("Variável de ambiente")
          ? error.message
          : "Verifique sua conexão e tente novamente. Se persistir, informe o código abaixo ao suporte técnico."}
      </p>
      {error.digest && <p className="mt-2 text-[12px] text-ink-soft tabular">Código: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
