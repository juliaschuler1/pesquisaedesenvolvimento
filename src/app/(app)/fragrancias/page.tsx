import type { Metadata } from "next";
import { KnowledgePage } from "@/components/library/knowledge-page";
import { KNOWLEDGE_LIBRARIES } from "@/lib/libraries";

export const metadata: Metadata = { title: KNOWLEDGE_LIBRARIES["fragrancias"].title };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <KnowledgePage lib="fragrancias" sp={await searchParams} />;
}
