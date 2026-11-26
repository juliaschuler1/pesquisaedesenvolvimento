"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase do navegador (usa apenas a chave pública; RLS protege os dados). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
