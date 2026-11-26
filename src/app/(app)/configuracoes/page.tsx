import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession, isAdmin } from "@/lib/session";
import { env } from "@/lib/env";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ConfirmAction } from "@/components/ui/interactive";
import { LifecycleActions } from "@/components/records/lifecycle";
import { loadDemo, removeDemo } from "@/lib/actions/admin";
import { formatDateTime } from "@/lib/format";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const s = await getSession();
  const admin = isAdmin(s);
  const supabase = await createClient();
  const [demoClients, trashClients, trashProjects, trashSkus, trashRecords, trashSuppliers, trashPack, trashLib] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase.from("clients").select("id, name, deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    supabase.from("projects").select("id, name, deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    supabase.from("skus").select("id, name, deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    supabase.from("custom_records").select("id, title, deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }),
    supabase.from("suppliers").select("id, name, deleted_at").not("deleted_at", "is", null),
    supabase.from("packaging_items").select("id, name, deleted_at").not("deleted_at", "is", null),
    supabase.from("library_items").select("id, name, deleted_at").not("deleted_at", "is", null),
  ]);
  const hasDemo = (demoClients.count ?? 0) > 0;
  const trash = [
    ...(trashClients.data ?? []).map((r) => ({ entity: "clients" as const, id: r.id, name: r.name, kind: "Cliente", at: r.deleted_at! })),
    ...(trashProjects.data ?? []).map((r) => ({ entity: "projects" as const, id: r.id, name: r.name, kind: "Projeto", at: r.deleted_at! })),
    ...(trashSkus.data ?? []).map((r) => ({ entity: "skus" as const, id: r.id, name: r.name, kind: "SKU", at: r.deleted_at! })),
    ...(trashRecords.data ?? []).map((r) => ({ entity: "custom_records" as const, id: r.id, name: r.title, kind: "Registro", at: r.deleted_at! })),
    ...(trashSuppliers.data ?? []).map((r) => ({ entity: "suppliers" as const, id: r.id, name: r.name, kind: "Fornecedor", at: r.deleted_at! })),
    ...(trashPack.data ?? []).map((r) => ({ entity: "packaging_items" as const, id: r.id, name: r.name, kind: "Embalagem", at: r.deleted_at! })),
    ...(trashLib.data ?? []).map((r) => ({ entity: "library_items" as const, id: r.id, name: r.name, kind: "Biblioteca", at: r.deleted_at! })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description={`Workspace ${s.orgName}. Você está como ${s.role === "owner" ? "proprietária(o)" : s.role === "admin" ? "administrador(a)" : "membro"}.`} />

      <Card>
        <CardHeader title="Identidade visual" description="Nome, logo e cores da plataforma. A tipografia (DM Sans e Playfair Display) poderá ser trocada nos modelos de documentos (Fase 4)." />
        <BrandingForm brandName={s.settings.brand_name} tagline={s.settings.tagline} theme={s.settings.theme} timezone={s.settings.timezone} logoUrl={s.logoUrl} disabled={!admin} />
        {!admin && <p className="px-5 pb-5 text-[13px] text-ink-soft">Somente administradores podem alterar a identidade visual.</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="demonstracao">
          <CardHeader title="Dados demonstrativos" description="Clientes e projetos fictícios marcados com “[DEMO]” para explorar a interface." />
          <div className="flex flex-col gap-3 p-5">
            <p className="text-[14px] text-ink">
              {hasDemo ? "Os dados demonstrativos estão carregados." : "Nenhum dado demonstrativo no workspace."}
            </p>
            <div className="flex flex-wrap gap-2">
              {!hasDemo ? (
                <ConfirmAction action={loadDemo} fields={{}} label="Carregar dados demonstrativos" icon="Sparkles" variant="secondary" size="md" title="Carregar dados demonstrativos?" description="Serão criados 3 clientes, 4 projetos, SKUs, cronogramas e atividades, todos marcados como [DEMO]." confirmLabel="Carregar" />
              ) : (
                <ConfirmAction action={removeDemo} fields={{}} label="Remover dados demonstrativos" icon="Trash2" variant="secondary" size="md" title="Remover todos os dados demonstrativos?" description="Apenas registros marcados como demonstração são excluídos. Seus dados reais não são afetados." confirmLabel="Remover" danger />
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Integrações" description="Status real. Nada é simulado." />
          <ul className="flex flex-col gap-3 p-5 text-[14px]">
            <li className="flex items-center justify-between gap-3">
              <span>Banco de dados e arquivos (Supabase)</span>
              <Badge tone="success">Conectado</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Inteligência artificial (Anthropic)</span>
              {env.aiConfigured() ? <Badge tone="success">Chave configurada · recursos na Fase 3</Badge> : <Badge tone="neutral">Não configurada</Badge>}
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Pesquisa web e extração de páginas</span>
              <Badge tone="neutral">Fase 3</Badge>
            </li>
          </ul>
          <p className="border-t border-blush px-5 py-3 text-[12.5px] text-ink-soft">Como configurar a chave de IA com segurança está no README, seção “Inteligência artificial”.</p>
        </Card>
      </div>

      <Card id="lixeira">
        <CardHeader title="Lixeira" description="Registros excluídos podem ser restaurados ou excluídos definitivamente." />
        {trash.length === 0 ? (
          <p className="px-5 pt-3 pb-5 text-[13.5px] text-ink-soft">A lixeira está vazia.</p>
        ) : (
          <ul className="mt-3 divide-y divide-blush">
            {trash.map((t) => (
              <li key={t.entity + t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Badge>{t.kind}</Badge>
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{t.name}</span>
                <span className="text-[12px] text-ink-soft">excluído em {formatDateTime(t.at, s.settings.timezone)}</span>
                <LifecycleActions entity={t.entity} id={t.id} name={t.name} archivedAt={null} deletedAt={t.at} noun="" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Personalização" />
        <ul className="grid gap-3 p-5 sm:grid-cols-3">
          <li><Link href="/construtor-modulos" className="block rounded-2xl bg-blush/50 p-4 hover:bg-blush"><span className="block text-[14px] font-medium text-ink">Menu e módulos</span><span className="text-[12.5px] text-ink-soft">Reorganize, oculte e crie módulos.</span></Link></li>
          <li><Link href="/construtor-modulos?entidade=clients" className="block rounded-2xl bg-blush/50 p-4 hover:bg-blush"><span className="block text-[14px] font-medium text-ink">Campos personalizados</span><span className="text-[12.5px] text-ink-soft">Adicione campos às fichas.</span></Link></li>
          <li><Link href="/categorias" className="block rounded-2xl bg-blush/50 p-4 hover:bg-blush"><span className="block text-[14px] font-medium text-ink">Categorias e listas</span><span className="text-[12.5px] text-ink-soft">Texturas, claims, acabamentos…</span></Link></li>
        </ul>
      </Card>
    </div>
  );
}
