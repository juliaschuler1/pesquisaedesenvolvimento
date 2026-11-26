"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(_: { error?: string } | null, fd: FormData) {
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Informe o nome da consultoria." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_workspace", { p_name: name.slice(0, 120) });
  if (error) return { error: "Não foi possível criar o workspace. Tente novamente." };
  if (fd.get("demo") === "on") {
    await supabase.rpc("load_demo_data");
  }
  redirect("/dashboard");
}
