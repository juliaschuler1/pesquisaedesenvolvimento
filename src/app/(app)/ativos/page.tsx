import type { Metadata } from "next";
import { KnowledgePage } from "@/components/library/knowledge-page";
import { KNOWLEDGE_LIBRARIES } from "@/lib/libraries";

export const metadata: Metadata = { title: KNOWLEDGE_LIBRARIES["ativos"].title };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <KnowledgePage lib="ativos" sp={await searchParams} />;
}
