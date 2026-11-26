import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { isProjectLate, type ProgressRow } from "@/lib/domain";
import { todayISO } from "@/lib/format";
import type { ProjectCardData } from "@/components/projects/project-card";

type Opts = {
  clientId?: string;
  status?: string;
  category?: string;
  q?: string;
  archived?: boolean;
  lateOnly?: boolean;
  launchWithinDays?: number;
  tz: string;
};

export async function loadProjectCards(o: Opts): Promise<ProjectCardData[]> {
  const supabase = await createClient();
  const today = todayISO(o.tz);
  let q = supabase
    .from("projects")
    .select("id, name, code, category, product_type, status, priority, launch_date, is_demo, cover_path, clients(name), skus(id, deleted_at)")
    .is("deleted_at", null)
    .order("launch_date", { ascending: true, nullsFirst: false });
  q = o.archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (o.clientId) q = q.eq("client_id", o.clientId);
  if (o.status) q = q.eq("status", o.status);
  if (o.category) q = q.eq("category", o.category);
  if (o.q) {
    const t = o.q.replace(/[%,()]/g, "");
    q = q.or(`name.ilike.%${t}%,code.ilike.%${t}%`);
  }
  if (o.launchWithinDays) {
    const end = new Date(today + "T12:00:00Z");
    end.setUTCDate(end.getUTCDate() + o.launchWithinDays);
    q = q.gte("launch_date", today).lte("launch_date", end.toISOString().slice(0, 10)).not("status", "in", "(completed,cancelled)");
  }
  const { data } = await q;
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [{ data: prog }, urls] = await Promise.all([
    ids.length ? supabase.from("project_progress").select("*").in("project_id", ids) : Promise.resolve({ data: [] as ProgressRow[] }),
    signedUrls(supabase, rows.map((r) => r.cover_path)),
  ]);
  const pmap = new Map(((prog ?? []) as ProgressRow[]).map((p) => [p.project_id, p]));
  let cards: ProjectCardData[] = rows.map((r) => {
    const pr = pmap.get(r.id);
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      category: r.category,
      product_type: r.product_type,
      status: r.status,
      priority: r.priority,
      launch_date: r.launch_date,
      is_demo: r.is_demo,
      client_name: (r.clients as unknown as { name: string } | null)?.name,
      cover_url: r.cover_path ? urls[r.cover_path] : null,
      progress: pr?.progress ?? null,
      current_stage: pr?.current_stage ?? null,
      late: isProjectLate(r, pr, today),
      sku_count: ((r.skus ?? []) as { deleted_at: string | null }[]).filter((s) => !s.deleted_at).length,
    };
  });
  if (o.lateOnly) cards = cards.filter((c) => c.late);
  return cards;
}
