import type { Metadata } from "next";
import { SupplierDirectory } from "@/components/suppliers/directory";

export const metadata: Metadata = { title: "Mailing de fornecedores" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <SupplierDirectory
      sp={await searchParams}
      base="/fornecedores"
      title="Mailing de fornecedores"
      description="Fabricantes, embalagens, matérias-primas, fragrâncias, laboratórios e serviços — nacionais e internacionais."
    />
  );
}
