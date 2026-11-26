import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/interactive";

export const metadata: Metadata = {
  title: { default: "Beauty Development Studio", template: "%s · Beauty Development Studio" },
  description: "Gestão de pesquisa, desenvolvimento e inovação de produtos cosméticos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
