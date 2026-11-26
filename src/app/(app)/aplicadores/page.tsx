import type { Metadata } from "next";
import { PackagingLibrary } from "@/components/packaging/library";

export const metadata: Metadata = { title: "Biblioteca de aplicadores" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <PackagingLibrary lib="aplicadores" sp={await searchParams} />;
}
