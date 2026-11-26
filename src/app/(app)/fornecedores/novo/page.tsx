import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { loadOptionSets } from "@/lib/data/options";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { SupplierForm } from "../supplier-form";

export const metadata: Metadata = { title: "Novo fornecedor" };

export default async function NewSupplier({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const [options, fields] = await Promise.all([loadOptionSets(["supplier_categories", "product_categories", "certifications"]), loadCustomFields("suppliers")]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={categoria?.startsWith("Fabricante") ? "Novo terceirista" : "Novo fornecedor"} back={{ href: "/fornecedores", label: "Fornecedores" }} />
      <SupplierForm options={options} customFields={fields} defaultCategory={categoria} />
    </div>
  );
}
