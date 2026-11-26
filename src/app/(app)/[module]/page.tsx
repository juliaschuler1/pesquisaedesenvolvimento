import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { ButtonLink, Card, EmptyState, PageHeader, cx } from "@/components/ui/primitives";
import { QuickAction } from "@/components/ui/interactive";
import { PlannedPanel } from "@/components/records/planned-panel";
import { QueryTabs } from "@/components/records/view-tabs";
import { SearchBox } from "@/components/records/search-box";
import { LifecycleActions } from "@/components/records/lifecycle";
import { loadCustomFields } from "@/lib/data/custom-fields";
import { displayCustomValue } from "@/lib/custom-fields";
import { toggleRecordDone } from "@/lib/actions/custom-records";
import { formatDate } from "@/lib/format";
import { RecordDialogButton } from "./record-dialog";

const PLANNED_DETAILS: Record<string, string[]> = {
  "pesquisa-de-mercado": ["Visão consolidada de pesquisas por projeto", "Cards de concorrentes com fotos e preços", "Pesquisa por link ou nome com IA (quando configurada)", "Comparativos de preço por ml/g, claims, ativos e embalagens"],
  concorrentes: ["Cadastro com galeria, preços regulares × promocionais", "Concorrente direto ou indireto", "Fonte, URL e data da consulta registradas", "Conversão em benchmark técnico"],
  benchmark: ["Benchmarks por finalidade (fórmula, textura, embalagem…)", "Fórmula de referência com INCI e OCR", "Avaliação interna e orientações ao terceirista"],
  briefings: ["Gerador em 10 etapas, com salvamento automático", "Modo reunião com a cliente", "Versões, aprovação e PDF editorial"],
  "identidade-visual": ["Direção criativa por produto", "Paletas, Pantones, tipografia e mockups"],
  moodboards: ["Quadro com arrastar, soltar e redimensionar", "Versões e seleção para briefing"],
  amostras: ["Rodadas, versões e avaliações", "Comparação lado a lado", "Status de solicitada a aprovada"],
  testes: ["Estabilidade, compatibilidade e demais testes", "Laudos e evidências", "Vínculo com claims pretendidos"],
  "follow-ups": ["Timeline por projeto", "Decisões, pendências e próximos passos", "Lembretes e alertas"],
  fornecedores: ["Ficha completa com múltiplos contatos", "Filtros avançados por categoria e especialidade", "Importação de planilhas e exportação do mailing"],
  terceiristas: ["Fabricantes full service e parciais", "MOQ, lead time, certificações e avaliações"],
  embalagens: ["Catálogo visual com galeria e ficha técnica", "Filtros por tipo, material, volumetria e fornecedor", "Bibliotecas de frascos, tampas, válvulas, rótulos…"],
  aplicadores: ["Aplicadores e retentores com fotos e compatibilidades"],
  componentes: ["Válvulas, pumps, sprays e tampas", "Componentes compatíveis relacionados"],
  "materias-primas": ["Matérias-primas com fornecedores e documentos"],
  ativos: ["Ativos, funções e evidências"],
  fragrancias: ["Fragrâncias, famílias olfativas e notas"],
  claims: ["Claims e tecnologias com fontes e evidências"],
  referencias: ["Tendências e referências de mercado com datas"],
  target: ["Custos, cenários de volume e margens"],
  cotacoes: ["Propostas de terceiristas por versão"],
  "comparativo-propostas": ["Matriz comparativa por valor, prazo e escopo"],
  "briefings-exportados": ["Versões exportadas com data e destinatário"],
  relatorios: ["Relatórios semanais, mensais e de status em PDF"],
  "documentos-tecnicos": ["Fichas técnicas, laudos e documentos centralizados"],
  importacao: ["Upload de Excel/CSV, mapeamento de colunas e pré-visualização", "Detecção de duplicidades e histórico de importações"],
  "modelos-formularios": ["Construtor visual de formulários por categoria"],
  "modelos-cronogramas": ["Modelos personalizados de cronograma"],
  "modelos-documentos": ["Modelos de PDF com identidade editorial"],
  "ai-studio": ["Chat para propor novos módulos e campos", "Prévia e aprovação antes de aplicar", "Especificações técnicas para mudanças de código"],
  integracoes: ["API da Anthropic com chave protegida no servidor", "Pesquisa web e extração de páginas", "Controle de custos e limites"],
  seguranca: ["Exportação completa das bases", "Rotina de backups", "Gestão de acessos e membros"],
};

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }): Promise<Metadata> {
  const { module } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("modules").select("label").eq("key", module).maybeSingle();
  return { title: data?.label ?? "Módulo" };
}

export default async function ModulePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ ver?: string; q?: string; configurar?: string }> }) {
  const { module: key } = await params;
  const sp = await searchParams;
  const s = await getSession();
  const mod = s.nav.flatMap((g) => g.modules).find((m) => m.key === key);
  if (!mod) notFound();

  if (mod.availability === "planned") {
    return (
      <div>
        <PageHeader title={mod.label} description={mod.description ?? undefined} />
        <PlannedPanel icon={mod.icon} title={mod.label} phase={mod.phase ?? 2} items={PLANNED_DETAILS[mod.key] ?? [mod.description ?? "Funcionalidade prevista."]} />
      </div>
    );
  }
  if (mod.kind !== "custom") notFound();

  const supabase = await createClient();
  const fields = await loadCustomFields(`module:${key}`);
  let q = supabase.from("custom_records").select("*, clients(name), projects(name)").eq("module_id", mod.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(500);
  q = sp.ver === "arquivados" ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%,()]/g, "")}%`);
  const [{ data }, { data: clients }, { data: projects }] = await Promise.all([
    q,
    supabase.from("clients").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("projects").select("id, name").is("deleted_at", null).order("name"),
  ]);
  const records = data ?? [];
  const shown = fields.slice(0, 4);
  const dialogProps = { moduleId: mod.id, moduleKey: key, scope: mod.scope, fields, clients: clients ?? [], projects: projects ?? [] };

  return (
    <div>
      <PageHeader
        title={mod.label}
        description={mod.description ?? "Módulo personalizado."}
        actions={
          <>
            <ButtonLink href={`/construtor-modulos?entidade=${encodeURIComponent(`module:${key}`)}`} variant="secondary" icon="Settings">Campos</ButtonLink>
            <RecordDialogButton {...dialogProps} />
          </>
        }
      />
      {(sp.configurar || fields.length === 0) && (
        <Card className="mb-5 bg-blush/50">
          <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <p className="text-[14px] text-ink">
              {fields.length === 0 ? "Este módulo ainda não tem campos além do título." : "Módulo criado."} Defina os campos que cada registro deve ter.
            </p>
            <ButtonLink href={`/construtor-modulos?entidade=${encodeURIComponent(`module:${key}`)}`} size="sm" icon="Plus">Configurar campos</ButtonLink>
          </div>
        </Card>
      )}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <QueryTabs base={`/${key}`} param="ver" current={sp.ver ?? ""} tabs={[{ value: "", label: "Ativos" }, { value: "arquivados", label: "Arquivados", muted: true }]} />
        <SearchBox placeholder="Buscar por título" />
      </div>

      {records.length === 0 ? (
        <Card><EmptyState icon={mod.icon} title="Nenhum registro" description="Os registros deste módulo ficam salvos no banco permanente, com histórico." action={<RecordDialogButton {...dialogProps} />} /></Card>
      ) : mod.default_view === "cards" ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {records.map((r) => (
            <li key={r.id}>
              <Card as="article" className="flex h-full flex-col p-5">
                <h3 className="font-serif text-[18px] text-ink">{r.title}</h3>
                <dl className="mt-3 flex flex-col gap-1.5 text-[13px]">
                  {shown.map((f) => (
                    <div key={f.id} className="flex gap-2"><dt className="text-ink-soft">{f.label}:</dt><dd className="text-ink">{displayCustomValue(f, (r.data as Record<string, unknown>)[f.key])}</dd></div>
                  ))}
                </dl>
                <div className="mt-auto flex flex-wrap gap-1 pt-4">
                  <RecordDialogButton {...dialogProps} record={r} label="Editar" icon="Pencil" variant="ghost" size="sm" />
                  <LifecycleActions entity="custom_records" id={r.id} name={r.title} archivedAt={r.archived_at} deletedAt={r.deleted_at} noun="este registro" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-blush bg-[#fffafc] text-[12px] text-ink-soft">
                {mod.default_view === "checklist" && <th className="w-12 px-4 py-2.5" />}
                <th className="px-5 py-2.5 font-medium">Título</th>
                {dialogProps.scope !== "global" && <th className="px-3 py-2.5 font-medium">{dialogProps.scope === "client" ? "Cliente" : "Projeto"}</th>}
                {shown.map((f) => <th key={f.id} className="px-3 py-2.5 font-medium">{f.label}</th>)}
                <th className="px-3 py-2.5 font-medium">Atualizado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-blush">
              {records.map((r) => (
                <tr key={r.id} className="group">
                  {mod.default_view === "checklist" && (
                    <td className="px-4 py-2.5">
                      <QuickAction action={toggleRecordDone} fields={{ id: r.id, module_key: key }} label={r.status === "done" ? "Reabrir" : "Concluir"} icon={r.status === "done" ? "CheckCircle2" : "Circle"} iconOnly className={cx("!rounded-full", r.status === "done" ? "!text-success" : "")} />
                    </td>
                  )}
                  <td className={cx("px-5 py-3", r.status === "done" ? "text-ink-soft line-through" : "text-ink")}>{r.title}</td>
                  {dialogProps.scope === "client" && <td className="px-3 py-3 text-ink-soft">{(r.clients as { name: string } | null)?.name ?? "—"}</td>}
                  {dialogProps.scope === "project" && <td className="px-3 py-3 text-ink-soft">{(r.projects as { name: string } | null)?.name ?? "—"}</td>}
                  {shown.map((f) => <td key={f.id} className="px-3 py-3 text-ink">{displayCustomValue(f, (r.data as Record<string, unknown>)[f.key])}</td>)}
                  <td className="px-3 py-3 text-ink-soft tabular">{formatDate(r.updated_at, s.settings.timezone)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-0.5">
                      <RecordDialogButton {...dialogProps} record={r} label="Editar" icon="Pencil" variant="ghost" size="sm" />
                      <LifecycleActions entity="custom_records" id={r.id} name={r.title} archivedAt={r.archived_at} deletedAt={r.deleted_at} noun="este registro" compact />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="mt-4 text-[12.5px] text-ink-soft">
        Kanban, calendário e galeria para módulos personalizados chegam com o construtor completo (Fase 6). <Link href="/construtor-modulos" className="text-deep hover:underline">Construtor de módulos</Link>
      </p>
    </div>
  );
}
