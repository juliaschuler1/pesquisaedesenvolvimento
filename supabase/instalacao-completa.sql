-- Beauty Development Studio — instalação completa (Fase 1)
-- Cole TODO este conteúdo no Supabase: SQL Editor → New query → Run.
-- Rode apenas uma vez em um projeto novo.

-- ===== supabase/migrations/20261126000001_foundation.sql =====
-- =====================================================================
-- Beauty Development Studio — Fase 1: Fundação
-- Workspaces, membros, identidade visual, navegação dinâmica, opções
-- editáveis, campos personalizados, módulos personalizados, histórico.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Workspaces (a consultoria) e membros
-- ---------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_path text,
  default_org_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- owner/admin/member: equipe interna. client_viewer: acesso restrito a um cliente (futuro portal).
create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','client_viewer')),
  client_id uuid, -- preenchido apenas para client_viewer (FK adicionada após a tabela clients)
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

-- ---------------------------------------------------------------------
-- Funções auxiliares de segurança (SECURITY DEFINER evita recursão de RLS)
-- ---------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.default_org_id from public.profiles p
      join public.memberships m on m.org_id = p.default_org_id and m.user_id = p.id
      where p.id = auth.uid()),
    (select m.org_id from public.memberships m where m.user_id = auth.uid() order by m.created_at limit 1)
  );
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = auth.uid());
$$;

-- Equipe interna (exclui client_viewer): acesso a dados internos/confidenciais.
create or replace function public.is_org_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role in ('owner','admin','member')
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$$;

-- Cliente visível para o usuário: equipe vê todos; client_viewer só o próprio.
create or replace function public.can_view_client(p_org uuid, p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
      and (m.role in ('owner','admin','member') or (m.role = 'client_viewer' and m.client_id = p_client))
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Identidade visual e preferências regionais (personalizável)
-- ---------------------------------------------------------------------
create table public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  brand_name text not null default 'Beauty Development Studio',
  tagline text default 'Da concepção ao lançamento.',
  logo_path text,
  theme jsonb not null default '{}'::jsonb,            -- cores e fontes sobrescritas
  document_theme jsonb not null default '{}'::jsonb,   -- identidade dos PDFs
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  locale text not null default 'pt-BR',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Navegação dinâmica: grupos e módulos (sistema e personalizados)
-- ---------------------------------------------------------------------
create table public.nav_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  position int not null default 0,
  visible boolean not null default true,
  unique (org_id, key)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  group_id uuid references public.nav_groups(id) on delete set null,
  key text not null,                     -- identificador estável (rota)
  label text not null,
  icon text not null default 'Circle',   -- nome do ícone Lucide
  description text,
  kind text not null default 'system' check (kind in ('system','custom')),
  -- available: implementado; planned: previsto em fase futura (exibido como "Em breve")
  availability text not null default 'available' check (availability in ('available','planned')),
  phase int,                              -- fase do plano em que o módulo será entregue
  scope text not null default 'global' check (scope in ('global','client','project')),
  default_view text not null default 'table' check (default_view in ('table','cards','gallery','checklist','calendar','kanban')),
  position int not null default 0,
  visible boolean not null default true,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);
create trigger modules_touch before update on public.modules for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Listas de opções editáveis ("+ Adicionar nova opção")
-- ---------------------------------------------------------------------
create table public.option_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  description text,
  unique (org_id, key)
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  set_id uuid not null references public.option_sets(id) on delete cascade,
  label text not null,
  color text,
  image_path text,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (set_id, label)
);
create index on public.options (set_id, position);

-- ---------------------------------------------------------------------
-- Campos personalizados (qualquer entidade ou módulo personalizado)
-- Versões anteriores preservadas: alterações geram nova linha em custom_field_versions.
-- ---------------------------------------------------------------------
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  entity text not null,                  -- 'clients','projects','skus' ou 'module:<key>'
  key text not null,
  label text not null,
  field_type text not null check (field_type in (
    'short_text','long_text','number','currency','percent','date','date_range',
    'single_select','multi_select','checkbox','image_select','image_upload','file_upload',
    'link','table','color_palette','computed','relation')),
  section text,
  position int not null default 0,
  required boolean not null default false,
  default_value jsonb,
  settings jsonb not null default '{}'::jsonb,  -- opções, option_set, regras, validações, relação
  visibility text not null default 'internal' check (visibility in ('internal','shareable')),
  version int not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, entity, key)
);
create trigger custom_fields_touch before update on public.custom_fields for each row execute function public.touch_updated_at();

create table public.custom_field_versions (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.custom_fields(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.custom_fields_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (to_jsonb(old) - 'updated_at' - 'version' - 'position') is distinct from (to_jsonb(new) - 'updated_at' - 'version' - 'position') then
    insert into public.custom_field_versions(field_id, org_id, version, snapshot)
    values (old.id, old.org_id, old.version, to_jsonb(old));
    new.version := old.version + 1;
  end if;
  return new;
end $$;
create trigger custom_fields_versioning before update on public.custom_fields
  for each row execute function public.custom_fields_version();

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name text not null,
  brand_name text,
  logo_path text,
  cnpj text,
  email text,
  phone text,
  whatsapp text,
  website text,
  social jsonb not null default '{}'::jsonb,
  segment text,
  positioning text,
  target_audience text,
  sales_channels text[] not null default '{}',
  commercial_info text,
  consulting_started_on date,
  notes text,           -- observações compartilháveis
  private_notes text,   -- observações internas (nunca exibidas a clientes)
  custom_data jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.clients (org_id) where deleted_at is null;
create index clients_name_trgm on public.clients using gin (name extensions.gin_trgm_ops);
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();

alter table public.memberships
  add constraint memberships_client_fk foreign key (client_id) references public.clients(id) on delete cascade;

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.client_contacts (client_id);

-- ---------------------------------------------------------------------
-- Projetos
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  code text,
  name text not null,
  cover_path text,
  category text,
  product_type text,
  concept text,
  objective text,
  rationale text,
  start_date date,
  launch_date date,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'planning' check (status in ('planning','active','paused','completed','cancelled')),
  owners text[] not null default '{}',
  target_cost numeric(14,4),
  budget numeric(14,2),
  currency text not null default 'BRL',
  sku_shared jsonb not null default '{}'::jsonb, -- informações comuns herdadas pelos SKUs
  notes text,
  private_notes text,
  custom_data jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code)
);
create index on public.projects (org_id, status) where deleted_at is null;
create index on public.projects (client_id);
create index projects_name_trgm on public.projects using gin (name extensions.gin_trgm_ops);
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- Abas do projeto: project_id nulo = padrão do workspace; preenchido = personalização do projeto.
create table public.project_tabs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  key text not null,
  label text not null,
  icon text not null default 'Circle',
  kind text not null default 'system' check (kind in ('system','custom')),
  availability text not null default 'available' check (availability in ('available','planned')),
  phase int,
  position int not null default 0,
  visible boolean not null default true
);
create unique index project_tabs_unique on public.project_tabs (org_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), key);

-- ---------------------------------------------------------------------
-- SKUs (campos nulos herdam de projects.sku_shared)
-- ---------------------------------------------------------------------
create table public.skus (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  code text,
  gtin text,
  color text,
  pantone text,
  fragrance text,
  volume numeric(12,3),
  volume_unit text check (volume_unit in ('ml','g','kg','L','un')),
  planned_quantity int,
  sample_version text,
  packaging text,
  specs text,
  status text not null default 'in_development' check (status in ('concept','in_development','sampling','approved','in_production','launched','paused','cancelled')),
  approvals text,
  image_path text,
  position int not null default 0,
  custom_data jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.skus (project_id) where deleted_at is null;
create trigger skus_touch before update on public.skus for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Cronograma (base do Gantt da Fase 5): etapas com peso, dependências e linha de base
-- ---------------------------------------------------------------------
create table public.schedule_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,  -- [{name, duration_days, weight, is_milestone}]
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.schedule_items(id) on delete cascade,
  name text not null,
  position int not null default 0,
  status text not null default 'not_started' check (status in ('not_started','in_progress','done','paused','skipped')),
  weight numeric(6,2) not null default 1 check (weight >= 0),
  is_milestone boolean not null default false,
  planned_start date,
  planned_end date,
  baseline_start date,   -- cronograma original preservado para comparação
  baseline_end date,
  actual_start date,
  actual_end date,
  depends_on uuid[] not null default '{}',
  owner text,
  priority text check (priority in ('low','medium','high','critical')),
  notes text,
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.schedule_items (project_id, position);
create trigger schedule_items_touch before update on public.schedule_items for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Atividades: tarefas, reuniões, visitas técnicas, prazos, follow-ups simples
-- ---------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  sku_id uuid references public.skus(id) on delete set null,
  schedule_item_id uuid references public.schedule_items(id) on delete set null,
  kind text not null default 'task' check (kind in ('task','meeting','technical_visit','follow_up','approval','deadline','other')),
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','in_progress','done','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  starts_at timestamptz,
  due_at timestamptz,
  location text,
  owner text,
  visibility text not null default 'internal' check (visibility in ('internal','shareable')),
  completed_at timestamptz,
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.activities (org_id, due_at) where deleted_at is null;
create index on public.activities (project_id);
create trigger activities_touch before update on public.activities for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Registros de módulos personalizados (Construtor de módulos)
-- ---------------------------------------------------------------------
create table public.custom_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  status text,
  data jsonb not null default '{}'::jsonb,
  position int not null default 0,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.custom_records (module_id) where deleted_at is null;
create trigger custom_records_touch before update on public.custom_records for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Anexos (imagens e documentos no Storage privado)
-- Caminho no bucket: <org_id>/<entity_type>/<entity_id>/<arquivo>
-- ---------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  kind text not null default 'document' check (kind in ('image','document')),
  caption text,
  visibility text not null default 'internal' check (visibility in ('internal','shareable')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.attachments (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- Histórico de alterações (preenchido por trigger, somente leitura para usuários)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,   -- insert, update, delete, archive, restore, complete
  label text,             -- nome legível do registro
  changes jsonb,
  client_id uuid,
  project_id uuid,
  created_at timestamptz not null default now()
);
create index on public.audit_log (org_id, created_at desc);
create index on public.audit_log (entity_type, entity_id);

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  prev jsonb;
  diff jsonb := '{}'::jsonb;
  act text := lower(tg_op);
  k text;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    prev := to_jsonb(old);
    for k in select jsonb_object_keys(rec) loop
      if k not in ('updated_at') and (rec -> k) is distinct from (prev -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('de', prev -> k, 'para', rec -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then return new; end if;
    if (prev ->> 'archived_at') is null and (rec ->> 'archived_at') is not null then act := 'archive';
    elsif (prev ->> 'archived_at') is not null and (rec ->> 'archived_at') is null then act := 'restore';
    elsif (prev ->> 'deleted_at') is null and (rec ->> 'deleted_at') is not null then act := 'delete';
    elsif (prev ->> 'deleted_at') is not null and (rec ->> 'deleted_at') is null then act := 'restore';
    elsif rec ? 'status' and (rec ->> 'status') in ('done','completed') and (prev ->> 'status') is distinct from (rec ->> 'status') then act := 'complete';
    end if;
  end if;
  insert into public.audit_log(org_id, actor_id, entity_type, entity_id, action, label, changes, client_id, project_id)
  values (
    (rec ->> 'org_id')::uuid,
    auth.uid(),
    tg_table_name,
    (rec ->> 'id')::uuid,
    act,
    coalesce(rec ->> 'name', rec ->> 'title', rec ->> 'label'),
    case when tg_op = 'UPDATE' then diff else null end,
    case when tg_table_name = 'clients' then (rec ->> 'id')::uuid else (rec ->> 'client_id')::uuid end,
    case when tg_table_name = 'projects' then (rec ->> 'id')::uuid else (rec ->> 'project_id')::uuid end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger clients_audit after insert or update or delete on public.clients for each row execute function public.audit_row();
create trigger projects_audit after insert or update or delete on public.projects for each row execute function public.audit_row();
create trigger skus_audit after insert or update or delete on public.skus for each row execute function public.audit_row();
create trigger schedule_items_audit after update on public.schedule_items for each row execute function public.audit_row();
create trigger activities_audit after insert or update or delete on public.activities for each row execute function public.audit_row();
create trigger custom_records_audit after insert or update or delete on public.custom_records for each row execute function public.audit_row();

-- O projeto de um SKU/etapa precisa estar no mesmo cliente do audit: completa client_id
create or replace function public.audit_fill_client()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is null and new.project_id is not null then
    select client_id into new.client_id from public.projects where id = new.project_id;
  end if;
  return new;
end $$;
create trigger audit_log_fill_client before insert on public.audit_log for each row execute function public.audit_fill_client();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.org_settings enable row level security;
alter table public.nav_groups enable row level security;
alter table public.modules enable row level security;
alter table public.option_sets enable row level security;
alter table public.options enable row level security;
alter table public.custom_fields enable row level security;
alter table public.custom_field_versions enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.projects enable row level security;
alter table public.project_tabs enable row level security;
alter table public.skus enable row level security;
alter table public.schedule_templates enable row level security;
alter table public.schedule_items enable row level security;
alter table public.activities enable row level security;
alter table public.custom_records enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_log enable row level security;

create policy "membros veem o workspace" on public.organizations for select using (public.is_org_member(id));
create policy "admins editam o workspace" on public.organizations for update using (public.is_org_admin(id));

create policy "perfil próprio" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "membros veem colegas" on public.profiles for select using (
  exists (select 1 from public.memberships a join public.memberships b on a.org_id = b.org_id
          where a.user_id = auth.uid() and b.user_id = profiles.id));

create policy "membros veem membros" on public.memberships for select using (public.is_org_member(org_id));
create policy "admins gerenciam membros" on public.memberships for all
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "membros leem identidade" on public.org_settings for select using (public.is_org_member(org_id));
create policy "admins editam identidade" on public.org_settings for update using (public.is_org_admin(org_id));

-- Tabelas de configuração: equipe lê; equipe edita (personalização é parte do dia a dia).
do $$
declare t text;
begin
  foreach t in array array['nav_groups','modules','option_sets','options','custom_fields','project_tabs','schedule_templates'] loop
    execute format('create policy "equipe lê %1$s" on public.%1$I for select using (public.is_org_member(org_id))', t);
    execute format('create policy "equipe edita %1$s" on public.%1$I for all using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id))', t);
  end loop;
end $$;

create policy "equipe lê versões de campos" on public.custom_field_versions for select using (public.is_org_staff(org_id));

-- Dados operacionais: somente equipe interna (portal do cliente usará visões filtradas).
do $$
declare t text;
begin
  foreach t in array array['clients','client_contacts','projects','skus','schedule_items','activities','custom_records','attachments'] loop
    execute format('create policy "equipe acessa %1$s" on public.%1$I for all using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id))', t);
  end loop;
end $$;

create policy "equipe lê histórico" on public.audit_log for select using (public.is_org_staff(org_id));

-- ---------------------------------------------------------------------
-- Storage privado
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do nothing;

create policy "equipe lê arquivos do workspace" on storage.objects for select
  using (bucket_id = 'files' and public.is_org_staff(((storage.foldername(name))[1])::uuid));
create policy "equipe envia arquivos do workspace" on storage.objects for insert
  with check (bucket_id = 'files' and public.is_org_staff(((storage.foldername(name))[1])::uuid));
create policy "equipe atualiza arquivos do workspace" on storage.objects for update
  using (bucket_id = 'files' and public.is_org_staff(((storage.foldername(name))[1])::uuid));
create policy "equipe remove arquivos do workspace" on storage.objects for delete
  using (bucket_id = 'files' and public.is_org_staff(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- Perfil automático ao criar usuário
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== supabase/migrations/20261126000002_bootstrap_and_functions.sql =====
-- =====================================================================
-- Fase 1: criação do workspace com padrões iniciais, cronograma,
-- pesquisa global e dados demonstrativos removíveis.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Padrões do workspace (idempotente: pode ser reexecutado sem duplicar)
-- ---------------------------------------------------------------------
create or replace function public.seed_org_defaults(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g record;
  m record;
  s record;
  gid uuid;
  sid uuid;
  i int;
  lbl text;
begin
  insert into public.org_settings(org_id) values (p_org) on conflict do nothing;

  -- Grupos do menu
  for g in select * from (values
    ('overview',   'Visão geral', 1),
    ('clients',    'Gestão de clientes', 2),
    ('development','Desenvolvimento de produtos', 3),
    ('knowledge',  'Banco de conhecimento', 4),
    ('commercial', 'Gestão comercial', 5),
    ('documents',  'Documentação', 6),
    ('admin',      'Administração', 7)
  ) as t(key, label, pos) loop
    insert into public.nav_groups(org_id, key, label, position) values (p_org, g.key, g.label, g.pos)
    on conflict (org_id, key) do nothing;
  end loop;

  -- Módulos do sistema: (grupo, chave, rótulo, ícone, disponibilidade, fase, descrição)
  for m in select * from (values
    ('overview','dashboard','Dashboard','LayoutDashboard','available',1,'Visão consolidada da operação.'),
    ('overview','agenda','Agenda','CalendarDays','available',1,'Reuniões, visitas técnicas e prazos em calendário.'),
    ('overview','atividades','Minhas atividades','ListChecks','available',1,'Tarefas, reuniões, visitas e prazos.'),
    ('clients','clientes','Clientes','Users','available',1,'Pasta digital de cada cliente.'),
    ('clients','projetos','Projetos','FolderKanban','available',1,'Ambientes de desenvolvimento por produto.'),
    ('clients','skus','SKUs','Boxes','available',1,'Todas as variações em desenvolvimento.'),
    ('development','pesquisa-de-mercado','Pesquisa de mercado','ScanSearch','planned',3,'Inteligência competitiva: concorrentes, preços, posicionamento e lacunas.'),
    ('development','concorrentes','Concorrentes','Store','planned',3,'Produtos concorrentes com fotos, preços e claims.'),
    ('development','benchmark','Benchmark técnico','FlaskConical','planned',3,'Referências de fórmula, textura, embalagem e performance.'),
    ('development','briefings','Briefings','ClipboardList','planned',4,'Gerador inteligente de briefings por etapas.'),
    ('development','identidade-visual','Identidade visual','Palette','planned',4,'Direção criativa, paletas e Pantones.'),
    ('development','moodboards','Moodboards','LayoutGrid','planned',4,'Painéis visuais com versões.'),
    ('development','amostras','Amostras','TestTube','planned',5,'Rodadas de amostras e avaliações.'),
    ('development','testes','Testes e aprovações','ShieldCheck','planned',5,'Estabilidade, compatibilidade, segurança e eficácia.'),
    ('development','cronogramas','Cronogramas','GanttChart','available',1,'Etapas de todos os projetos; Gantt interativo na Fase 5.'),
    ('development','follow-ups','Follow-ups','MessagesSquare','planned',5,'Timeline de atualizações por projeto.'),
    ('knowledge','fornecedores','Mailing de fornecedores','Contact','planned',2,'Base de fornecedores nacionais e internacionais.'),
    ('knowledge','terceiristas','Fabricantes terceiristas','Factory','planned',2,'Fabricantes full service e parciais.'),
    ('knowledge','embalagens','Biblioteca de embalagens','Package','planned',2,'Catálogo visual de embalagens.'),
    ('knowledge','aplicadores','Biblioteca de aplicadores','Brush','planned',2,'Aplicadores e retentores.'),
    ('knowledge','componentes','Válvulas e componentes','Cog','planned',2,'Válvulas, pumps, sprays e tampas.'),
    ('knowledge','materias-primas','Matérias-primas','Atom','planned',2,'Biblioteca de matérias-primas.'),
    ('knowledge','ativos','Ativos','Sparkles','planned',2,'Ativos cosméticos e suas funções.'),
    ('knowledge','fragrancias','Fragrâncias','Flower2','planned',2,'Fragrâncias e famílias olfativas.'),
    ('knowledge','categorias','Categorias e listas','Tags','available',1,'Categorias, texturas, acabamentos, claims e demais opções editáveis.'),
    ('knowledge','claims','Claims e tecnologias','BadgeCheck','planned',2,'Claims, tecnologias e evidências.'),
    ('knowledge','referencias','Referências e tendências','TrendingUp','planned',2,'Tendências e referências de mercado.'),
    ('commercial','target','Target e viabilidade','Target','planned',4,'Custos, cenários de produção e margens.'),
    ('commercial','cotacoes','Cotações','Receipt','planned',5,'Propostas de terceiristas.'),
    ('commercial','comparativo-propostas','Comparativo de propostas','Scale','planned',5,'Matriz comparativa de propostas.'),
    ('documents','briefings-exportados','Briefings exportados','FileDown','planned',4,'Versões exportadas em PDF.'),
    ('documents','relatorios','Relatórios','FileBarChart','planned',5,'Relatórios semanais, mensais e de status.'),
    ('documents','documentos-tecnicos','Documentos técnicos','FileText','planned',5,'Fichas técnicas, laudos e documentos.'),
    ('documents','historico','Histórico de versões','History','available',1,'Todas as alterações registradas na plataforma.'),
    ('admin','configuracoes','Configurações','Settings','available',1,'Identidade visual, menu e preferências.'),
    ('admin','importacao','Importação de dados','FileSpreadsheet','planned',2,'Importação inteligente de Excel e CSV.'),
    ('admin','modelos-formularios','Modelos de formulários','FormInput','planned',6,'Construtor visual de formulários.'),
    ('admin','modelos-cronogramas','Modelos de cronogramas','CalendarRange','planned',5,'Modelos personalizados de cronograma.'),
    ('admin','modelos-documentos','Modelos de documentos','FileType','planned',4,'Modelos de PDF com identidade editorial.'),
    ('admin','construtor-modulos','Construtor de módulos','Blocks','available',1,'Crie módulos e campos próprios sem programação.'),
    ('admin','ai-studio','AI Studio','Wand2','planned',6,'Expansão da plataforma em linguagem natural.'),
    ('admin','integracoes','Integrações','Plug','planned',6,'Anthropic, pesquisa web e outros serviços.'),
    ('admin','seguranca','Segurança e backups','LockKeyhole','planned',7,'Exportação das bases, backups e acessos.')
  ) as t(grp, key, label, icon, avail, phase, descr) loop
    select id into gid from public.nav_groups where org_id = p_org and key = m.grp;
    select coalesce(max(position), 0) + 1 into i from public.modules where org_id = p_org and group_id = gid;
    insert into public.modules(org_id, group_id, key, label, icon, availability, phase, description, position)
    values (p_org, gid, m.key, m.label, m.icon, m.avail, m.phase, m.descr, i)
    on conflict (org_id, key) do nothing;
  end loop;

  -- Abas padrão do projeto
  for m in select * from (values
    ('visao-geral','Visão geral','Sparkles','available',1,1),
    ('skus','SKUs','Boxes','available',1,2),
    ('pesquisa','Pesquisa de mercado','ScanSearch','planned',3,3),
    ('benchmark','Benchmark técnico','FlaskConical','planned',3,4),
    ('briefing','Briefing','ClipboardList','planned',4,5),
    ('identidade','Identidade visual','Palette','planned',4,6),
    ('embalagem-primaria','Embalagem primária','Package','planned',4,7),
    ('embalagem-secundaria','Embalagem secundária','PackageOpen','planned',4,8),
    ('target','Target e viabilidade','Target','planned',4,9),
    ('cotacoes','Fornecedores e cotações','Receipt','planned',5,10),
    ('amostras','Amostras','TestTube','planned',5,11),
    ('testes','Testes e aprovações','ShieldCheck','planned',5,12),
    ('cronograma','Cronograma','GanttChart','available',1,13),
    ('atividades','Atividades','ListChecks','available',1,14),
    ('documentos','Documentos','FileText','available',1,15),
    ('historico','Histórico','History','available',1,16)
  ) as t(key, label, icon, avail, phase, pos) loop
    insert into public.project_tabs(org_id, project_id, key, label, icon, availability, phase, position)
    values (p_org, null, m.key, m.label, m.icon, m.avail, m.phase, m.pos)
    on conflict do nothing;
  end loop;

  -- Listas de opções editáveis
  for s in select * from (values
    ('product_categories','Categorias de produtos', array['Maquiagem','Skincare','Bodycare','Haircare','Perfumaria','Esmaltes','Autobronzeamento']),
    ('product_types','Tipos de produto', array['Gloss','Batom líquido','Batom bala','Base','Corretivo','Blush','Iluminador','Máscara de cílios','Sérum facial','Hidratante facial','Protetor solar','Body splash','Óleo corporal','Shampoo','Condicionador','Máscara capilar','Perfume','Esmalte']),
    ('textures','Texturas', array['Líquida','Aquosa','Cremosa','Gel','Jelly','Mousse','Balm','Óleo','Sérum','Pó solto','Pó compacto','Stick','Bifásica','Sólida','Espuma']),
    ('finishes','Acabamentos', array['Matte','Semi-matte','Acetinado','Glow','Natural','Brilhoso','Cintilante','Metálico','Holográfico','Translúcido']),
    ('claims','Claims', array['Hidratação','Longa duração','Resistência à água','Resistência ao suor','Resistência ao atrito','Alta cobertura','Toque seco','Multifuncional','Vegano','Sem álcool','Oil free','Não pegajoso','Efeito blur','Dermatologicamente testado','Oftalmologicamente testado']),
    ('sales_channels','Canais de venda', array['E-commerce próprio','Marketplaces','Farmácias','Lojas de departamento','Varejo especializado','Venda direta','Salões e profissionais','Redes sociais']),
    ('client_segments','Segmentos de cliente', array['Marca própria','Marca de influenciadora','Indústria','Varejo','Startup de beleza','Profissional/salão']),
    ('packaging_materials','Materiais de embalagem', array['Vidro','PET','PP','PE','ABS','Alumínio','PCR']),
    ('activity_owners','Responsáveis', array['Consultoria','Cliente','Terceirista','Fornecedor de embalagem','Laboratório'])
  ) as t(key, label, items) loop
    insert into public.option_sets(org_id, key, label) values (p_org, s.key, s.label)
    on conflict (org_id, key) do nothing;
    select id into sid from public.option_sets where org_id = p_org and key = s.key;
    i := 0;
    foreach lbl in array s.items loop
      i := i + 1;
      insert into public.options(org_id, set_id, label, position) values (p_org, sid, lbl, i)
      on conflict (set_id, label) do nothing;
    end loop;
  end loop;

  -- Modelo inicial de cronograma (27 etapas)
  if not exists (select 1 from public.schedule_templates where org_id = p_org and is_default) then
    insert into public.schedule_templates(org_id, name, is_default, items) values (p_org, 'Desenvolvimento 360° (modelo inicial)', true,
    '[{"name":"Pesquisa de mercado","days":10,"weight":2},
      {"name":"Benchmark","days":7,"weight":2},
      {"name":"Elaboração do briefing","days":7,"weight":3},
      {"name":"Aprovação do briefing","days":3,"weight":1,"milestone":true},
      {"name":"Mapeamento de fornecedores","days":7,"weight":2},
      {"name":"Envio do briefing","days":2,"weight":1},
      {"name":"Solicitação de amostras","days":3,"weight":1},
      {"name":"Recebimento de amostras","days":21,"weight":2},
      {"name":"Avaliação técnica e sensorial","days":7,"weight":3},
      {"name":"Solicitação de ajustes","days":3,"weight":1},
      {"name":"Novas rodadas de amostras","days":21,"weight":3},
      {"name":"Aprovação da fórmula","days":3,"weight":2,"milestone":true},
      {"name":"Pesquisa de embalagens","days":10,"weight":2},
      {"name":"Homologação de embalagens","days":14,"weight":2},
      {"name":"Estabilidade","days":90,"weight":3},
      {"name":"Compatibilidade","days":90,"weight":2},
      {"name":"Testes complementares","days":30,"weight":2},
      {"name":"Validação de claims","days":14,"weight":2},
      {"name":"Desenvolvimento de identidade visual","days":21,"weight":2},
      {"name":"Aprovação de artes","days":5,"weight":1,"milestone":true},
      {"name":"Documentação técnica","days":10,"weight":2},
      {"name":"Regularização","days":30,"weight":2},
      {"name":"Cadastro de códigos e GTIN/EAN","days":5,"weight":1},
      {"name":"Planejamento de produção","days":7,"weight":1},
      {"name":"Produção e envase","days":21,"weight":3},
      {"name":"Entrega","days":5,"weight":1,"milestone":true},
      {"name":"Lançamento","days":1,"weight":1,"milestone":true}]'::jsonb);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Cria o workspace do primeiro acesso (o usuário vira owner)
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_workspace(p_name text default 'Minha consultoria')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária';
  end if;
  select org_id into v_org from public.memberships where user_id = auth.uid() order by created_at limit 1;
  if v_org is not null then
    return v_org;
  end if;
  insert into public.organizations(name) values (coalesce(nullif(trim(p_name), ''), 'Minha consultoria')) returning id into v_org;
  insert into public.memberships(org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  insert into public.profiles(id) values (auth.uid()) on conflict (id) do nothing;
  update public.profiles set default_org_id = v_org where id = auth.uid();
  perform public.seed_org_defaults(v_org);
  return v_org;
end $$;

-- ---------------------------------------------------------------------
-- Aplica um modelo de cronograma a um projeto (sequencial, com dependências)
-- ---------------------------------------------------------------------
create or replace function public.apply_schedule_template(p_project uuid, p_template uuid default null, p_start date default null)
returns int language plpgsql security invoker set search_path = public as $$
declare
  v_org uuid;
  v_items jsonb;
  v_item jsonb;
  v_cursor date;
  v_prev uuid;
  v_id uuid;
  v_pos int;
  v_count int := 0;
  v_demo boolean;
begin
  select org_id, coalesce(p_start, start_date, current_date), is_demo into v_org, v_cursor, v_demo
    from public.projects where id = p_project;
  if v_org is null then raise exception 'Projeto não encontrado'; end if;

  select items into v_items from public.schedule_templates
   where org_id = v_org and (id = p_template or (p_template is null and is_default))
   order by is_default desc limit 1;
  if v_items is null then raise exception 'Modelo de cronograma não encontrado'; end if;

  select coalesce(max(position), 0) into v_pos from public.schedule_items where project_id = p_project;
  select id into v_prev from public.schedule_items where project_id = p_project order by position desc limit 1;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_pos := v_pos + 1;
    insert into public.schedule_items(org_id, project_id, name, position, weight, is_milestone,
      planned_start, planned_end, baseline_start, baseline_end, depends_on, is_demo)
    values (v_org, p_project, v_item ->> 'name', v_pos,
      coalesce((v_item ->> 'weight')::numeric, 1),
      coalesce((v_item ->> 'milestone')::boolean, false),
      v_cursor, v_cursor + greatest(coalesce((v_item ->> 'days')::int, 1) - 1, 0),
      v_cursor, v_cursor + greatest(coalesce((v_item ->> 'days')::int, 1) - 1, 0),
      case when v_prev is null then '{}'::uuid[] else array[v_prev] end,
      v_demo)
    returning id into v_id;
    v_cursor := v_cursor + greatest(coalesce((v_item ->> 'days')::int, 1), 1);
    v_prev := v_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------
-- Progresso ponderado por projeto (etapas concluídas / total de pesos)
-- ---------------------------------------------------------------------
create or replace view public.project_progress with (security_invoker = true) as
select
  p.id as project_id,
  p.org_id,
  count(s.id) filter (where s.status <> 'skipped') as total_items,
  count(s.id) filter (where s.status = 'done') as done_items,
  case when coalesce(sum(s.weight) filter (where s.status <> 'skipped'), 0) = 0 then null
       else round(100 * coalesce(sum(s.weight) filter (where s.status = 'done'), 0)
                  / sum(s.weight) filter (where s.status <> 'skipped'), 1)
  end as progress,
  (select s2.name from public.schedule_items s2
    where s2.project_id = p.id and s2.status not in ('done','skipped') and s2.parent_id is null
    order by s2.position limit 1) as current_stage,
  count(s.id) filter (where s.status not in ('done','skipped') and s.planned_end < current_date) as late_items,
  max(s.planned_end) as planned_finish
from public.projects p
left join public.schedule_items s on s.project_id = p.id
where p.deleted_at is null
group by p.id;

-- ---------------------------------------------------------------------
-- Pesquisa global (respeita RLS por ser SECURITY INVOKER)
-- ---------------------------------------------------------------------
create or replace function public.global_search(q text, max_results int default 20)
returns table(entity_type text, id uuid, title text, subtitle text, href text, score real)
language sql stable security invoker set search_path = public, extensions as $$
  with term as (select trim(q) as t)
  select * from (
    select 'cliente'::text, c.id, c.name, coalesce(c.brand_name, c.segment), '/clientes/' || c.id,
           greatest(similarity(c.name, t), similarity(coalesce(c.brand_name, ''), t))
      from public.clients c, term
     where c.deleted_at is null and (c.name ilike '%' || t || '%' or c.brand_name ilike '%' || t || '%' or c.cnpj ilike '%' || t || '%')
    union all
    select 'projeto', p.id, p.name, coalesce(p.code, '') || ' · ' || coalesce(c.name, ''), '/projetos/' || p.id,
           similarity(p.name, t)
      from public.projects p join public.clients c on c.id = p.client_id, term
     where p.deleted_at is null and (p.name ilike '%' || t || '%' or p.code ilike '%' || t || '%' or p.category ilike '%' || t || '%')
    union all
    select 'sku', s.id, s.name, coalesce(s.code, '') || ' · ' || p.name, '/projetos/' || p.id || '?aba=skus',
           similarity(s.name, t)
      from public.skus s join public.projects p on p.id = s.project_id, term
     where s.deleted_at is null and (s.name ilike '%' || t || '%' or s.code ilike '%' || t || '%' or s.gtin ilike '%' || t || '%')
    union all
    select 'registro', r.id, r.title, m.label, '/' || m.key || '?registro=' || r.id, similarity(r.title, t)
      from public.custom_records r join public.modules m on m.id = r.module_id, term
     where r.deleted_at is null and r.title ilike '%' || t || '%'
  ) x(entity_type, id, title, subtitle, href, score)
  where length((select t from term)) >= 2
  order by score desc, title
  limit max_results;
$$;

-- ---------------------------------------------------------------------
-- Dados demonstrativos (claramente marcados com is_demo e removíveis)
-- ---------------------------------------------------------------------
create or replace function public.remove_demo_data()
returns void language plpgsql security invoker set search_path = public as $$
declare v_org uuid := public.current_org_id();
begin
  if not public.is_org_admin(v_org) then raise exception 'Apenas administradores podem remover dados demonstrativos'; end if;
  delete from public.activities where org_id = v_org and is_demo;
  delete from public.custom_records where org_id = v_org and is_demo;
  delete from public.skus where org_id = v_org and is_demo;
  delete from public.schedule_items where org_id = v_org and is_demo;
  delete from public.projects where org_id = v_org and is_demo;
  delete from public.clients where org_id = v_org and is_demo;
end $$;

create or replace function public.load_demo_data()
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  c1 uuid; c2 uuid; c3 uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
begin
  if not public.is_org_admin(v_org) then raise exception 'Apenas administradores podem carregar dados demonstrativos'; end if;
  if exists (select 1 from public.clients where org_id = v_org and is_demo) then return; end if;

  insert into public.clients(org_id, name, brand_name, segment, positioning, target_audience, sales_channels, consulting_started_on, notes, is_demo)
  values (v_org, '[DEMO] Aurora Beauty Ltda.', 'Aurora', 'Marca própria', 'Maquiagem clean premium', 'Mulheres 25–40, classes A/B', array['E-commerce próprio','Marketplaces'], current_date - 120, 'Cliente demonstrativo para testar a interface.', true)
  returning id into c1;
  insert into public.clients(org_id, name, brand_name, segment, positioning, target_audience, sales_channels, consulting_started_on, is_demo)
  values (v_org, '[DEMO] Lumi Skin Cosméticos', 'Lumi Skin', 'Startup de beleza', 'Skincare com ativos de alta performance', 'Pessoas 20–35 com pele oleosa', array['E-commerce próprio','Farmácias'], current_date - 60, true)
  returning id into c2;
  insert into public.clients(org_id, name, brand_name, segment, positioning, target_audience, sales_channels, consulting_started_on, is_demo)
  values (v_org, '[DEMO] Casa Pétala', 'Pétala', 'Marca de influenciadora', 'Bodycare sensorial e perfumado', 'Mulheres 18–30', array['Redes sociais','E-commerce próprio'], current_date - 30, true)
  returning id into c3;

  insert into public.projects(org_id, client_id, code, name, category, product_type, concept, objective, start_date, launch_date, priority, status, target_cost, budget, sku_shared, is_demo)
  values (v_org, c1, 'DEMO-001', 'Gloss Labial Glow', 'Maquiagem', 'Gloss', 'Gloss com brilho espelhado e tratamento labial.', 'Lançar linha de 4 cores no Dia das Mães.', current_date - 100, current_date + 150, 'high', 'active', 9.5, 85000,
          '{"volume": 6, "volume_unit": "ml", "packaging": "Frasco de gloss PETG com aplicador doe-foot", "fragrance": "Baunilha suave"}'::jsonb, true)
  returning id into p1;
  insert into public.projects(org_id, client_id, code, name, category, product_type, concept, objective, start_date, launch_date, priority, status, target_cost, is_demo)
  values (v_org, c1, 'DEMO-002', 'Base Sérum Blur', 'Maquiagem', 'Base', 'Base fluida com efeito blur e cuidado.', 'Expandir portfólio de pele.', current_date - 40, current_date + 240, 'medium', 'active', 18, true)
  returning id into p2;
  insert into public.projects(org_id, client_id, code, name, category, product_type, concept, objective, start_date, launch_date, priority, status, target_cost, is_demo)
  values (v_org, c2, 'DEMO-003', 'Sérum Niacinamida 10%', 'Skincare', 'Sérum facial', 'Sérum controle de oleosidade.', 'Produto herói da marca.', current_date - 200, current_date + 20, 'critical', 'active', 14, true)
  returning id into p3;
  insert into public.projects(org_id, client_id, code, name, category, product_type, concept, start_date, launch_date, priority, status, is_demo)
  values (v_org, c3, 'DEMO-004', 'Body Splash Pétala Rosa', 'Bodycare', 'Body splash', 'Fragrância floral frutal leve.', current_date - 15, current_date + 300, 'low', 'paused', true)
  returning id into p4;

  insert into public.skus(org_id, project_id, name, code, color, pantone, position, status, is_demo) values
    (v_org, p1, 'Glow Rosé', 'DEMO-001-01', 'Rosa translúcido', '698 C', 1, 'sampling', true),
    (v_org, p1, 'Glow Nude', 'DEMO-001-02', 'Nude', '7604 C', 2, 'sampling', true),
    (v_org, p1, 'Glow Berry', 'DEMO-001-03', 'Berry', '7637 C', 3, 'in_development', true),
    (v_org, p1, 'Glow Clear', 'DEMO-001-04', 'Transparente', null, 4, 'approved', true),
    (v_org, p2, 'Tom 01 Claro', 'DEMO-002-01', null, null, 1, 'in_development', true),
    (v_org, p2, 'Tom 05 Médio', 'DEMO-002-05', null, null, 2, 'in_development', true),
    (v_org, p3, 'Sérum 30 ml', 'DEMO-003-01', null, null, 1, 'in_production', true),
    (v_org, p4, 'Body Splash 200 ml', 'DEMO-004-01', null, null, 1, 'concept', true);

  perform public.apply_schedule_template(p1, null, current_date - 100);
  perform public.apply_schedule_template(p2, null, current_date - 40);
  perform public.apply_schedule_template(p3, null, current_date - 200);
  perform public.apply_schedule_template(p4, null, current_date - 15);

  update public.schedule_items set status = 'done', actual_start = planned_start, actual_end = planned_end, completed_at = now()
   where project_id = p1 and position <= 9;
  update public.schedule_items set status = 'in_progress', actual_start = planned_start where project_id = p1 and position = 10;
  update public.schedule_items set status = 'done', actual_start = planned_start, actual_end = planned_end, completed_at = now()
   where project_id = p2 and position <= 3;
  update public.schedule_items set status = 'done', actual_start = planned_start, actual_end = planned_end, completed_at = now()
   where project_id = p3 and position <= 22;
  update public.schedule_items set status = 'done', completed_at = now() where project_id = p4 and position <= 1;

  insert into public.activities(org_id, client_id, project_id, kind, title, status, priority, starts_at, due_at, location, is_demo) values
    (v_org, c1, p1, 'meeting', 'Apresentação das amostras de gloss', 'pending', 'high', date_trunc('day', now()) + interval '1 day 14 hours', date_trunc('day', now()) + interval '1 day 15 hours', 'Online', true),
    (v_org, c2, p3, 'technical_visit', 'Visita técnica ao terceirista — envase', 'pending', 'critical', date_trunc('day', now()) + interval '3 days 9 hours', date_trunc('day', now()) + interval '3 days 12 hours', 'Fábrica do terceirista', true),
    (v_org, c1, p2, 'follow_up', 'Cobrar retorno da cotação de base', 'pending', 'medium', null, now() - interval '2 days', null, true),
    (v_org, c1, p1, 'approval', 'Aprovação da cor Glow Berry', 'pending', 'high', null, now() + interval '5 days', null, true),
    (v_org, c3, p4, 'task', 'Levantar referências de body splash', 'in_progress', 'low', null, now() + interval '10 days', null, true),
    (v_org, c2, p3, 'deadline', 'Prazo final de regularização', 'pending', 'critical', null, now() + interval '12 days', null, true),
    (v_org, c1, p1, 'task', 'Enviar briefing ajustado ao terceirista', 'done', 'medium', null, now() - interval '6 days', null, true);
  update public.activities set completed_at = now() - interval '5 days' where org_id = v_org and is_demo and status = 'done';
end $$;

grant execute on function public.bootstrap_workspace(text) to authenticated;
grant execute on function public.apply_schedule_template(uuid, uuid, date) to authenticated;
grant execute on function public.global_search(text, int) to authenticated;
grant execute on function public.load_demo_data() to authenticated;
grant execute on function public.remove_demo_data() to authenticated;
revoke execute on function public.seed_org_defaults(uuid) from public, anon, authenticated;

