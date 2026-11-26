import type { Metadata } from "next";
import { SupplierDirectory } from "@/components/suppliers/directory";

export const metadata: Metadata = { title: "Fabricantes terceiristas" };

export default async function ManufacturersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <SupplierDirectory
      sp={await searchParams}
      base="/terceiristas"
      title="Fabricantes terceiristas"
      description="Fabricantes full service, terceiristas e empresas de envase — filtre por aptidão para cada tipo de produto."
      manufacturersOnly
    />
  );
}
