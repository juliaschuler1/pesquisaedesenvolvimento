import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type NavModule = {
  id: string;
  key: string;
  label: string;
  icon: string;
  description: string | null;
  kind: "system" | "custom";
  availability: "available" | "planned";
  phase: number | null;
  position: number;
  visible: boolean;
  enabled: boolean;
  group_id: string | null;
  default_view: string;
  scope: "global" | "client" | "project";
};

export type NavGroup = {
  id: string;
  key: string;
  label: string;
  position: number;
  visible: boolean;
  modules: NavModule[];
};

export type OrgSettings = {
  brand_name: string;
  tagline: string | null;
  logo_path: string | null;
  theme: Record<string, string>;
  timezone: string;
  currency: string;
};

export type Session = {
  userId: string;
  email: string;
  fullName: string;
  orgId: string;
  orgName: string;
  role: "owner" | "admin" | "member" | "client_viewer";
  settings: OrgSettings;
  nav: NavGroup[];
  logoUrl: string | null;
};

/** Usuário autenticado ou redireciona para o login. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

/** Sessão completa: usuário, workspace, identidade visual e menu. Uma consulta por requisição. */
export const getSession = cache(async (): Promise<Session> => {
  const { supabase, user } = await requireUser();

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(name)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/bem-vinda");

  const orgId = membership.org_id as string;
  const [{ data: profile }, { data: settings }, { data: groups }, { data: modules }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("org_settings").select("brand_name, tagline, logo_path, theme, timezone, currency").eq("org_id", orgId).maybeSingle(),
    supabase.from("nav_groups").select("id, key, label, position, visible").eq("org_id", orgId).order("position"),
    supabase
      .from("modules")
      .select("id, key, label, icon, description, kind, availability, phase, position, visible, enabled, group_id, default_view, scope")
      .eq("org_id", orgId)
      .order("position"),
  ]);

  const nav: NavGroup[] = (groups ?? []).map((g) => ({
    ...g,
    modules: ((modules ?? []) as NavModule[]).filter((m) => m.group_id === g.id),
  }));

  let logoUrl: string | null = null;
  if (settings?.logo_path) {
    const { data } = await supabase.storage.from("files").createSignedUrl(settings.logo_path, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  const orgRel = membership.organizations as unknown as { name: string } | null;
  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.email?.split("@")[0] ?? "",
    orgId,
    orgName: orgRel?.name ?? "",
    role: membership.role as Session["role"],
    settings: {
      brand_name: settings?.brand_name ?? "Beauty Development Studio",
      tagline: settings?.tagline ?? null,
      logo_path: settings?.logo_path ?? null,
      theme: (settings?.theme as Record<string, string>) ?? {},
      timezone: settings?.timezone ?? "America/Sao_Paulo",
      currency: settings?.currency ?? "BRL",
    },
    nav,
    logoUrl,
  };
});

export function isAdmin(s: Session) {
  return s.role === "owner" || s.role === "admin";
}
