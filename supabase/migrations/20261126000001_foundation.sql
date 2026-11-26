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
