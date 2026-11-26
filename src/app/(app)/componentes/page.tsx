import type { Metadata } from "next";
import { PackagingLibrary } from "@/components/packaging/library";

export const metadata: Metadata = { title: "Válvulas e componentes" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PackagingLibrary lib="componentes" sp={await searchParams} />;
}
