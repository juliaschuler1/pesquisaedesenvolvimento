-- =====================================================================
-- Fase 2: fornecedores, terceiristas, importação de planilhas,
-- biblioteca de embalagens e bibliotecas técnicas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Importações (histórico e desfazer)
-- ---------------------------------------------------------------------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  target text not null,                 -- suppliers, clients, packaging_items, library:<chave>
  file_name text,
  sheet_name text,
  mapping jsonb not null default '{}'::jsonb,
  stats jsonb not null default '{}'::jsonb,       -- {created, updated, skipped, errors}
  report jsonb not null default '[]'::jsonb,      -- [{row, status, message, id}]
  created_ids uuid[] not null default '{}',
  update_snapshots jsonb not null default '[]'::jsonb, -- [{id, before:{...}, added_capabilities:[...]}]
  undone_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.import_batches (org_id, created_at desc);

-- ---------------------------------------------------------------------
-- Fornecedores
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name text not null,
  legal_name text,
  cnpj text,
  logo_path text,
  country text default 'Brasil',
  state text,
  city text,
  address text,
  website text,
  social jsonb not null default '{}'::jsonb,
  email text,
  phone text,
  whatsapp text,
  categories text[] not null default '{}',      -- fabricante terceirista, embalagens primárias…
  technologies text,
  strengths text,
  differentials text,
  product_categories text[] not null default '{}', -- categorias cosméticas atendidas
  operation_model text,
  moq text,
  lead_time text,
  price_range text,
  commercial_terms text,
  currency text not null default 'BRL',
  certifications text[] not null default '{}',
  quality_status text check (quality_status in ('approved','approved_conditional','rejected_conditional','rejected','pending')),
  quality_evaluated_year int check (quality_evaluated_year between 1990 and 2100),
  rating_quality smallint check (rating_quality between 1 and 5),
  rating_service smallint check (rating_service between 1 and 5),
  rating_deadline smallint check (rating_deadline between 1 and 5),
  notes text,
  internal_notes text,           -- avaliações e negociações internas (nunca compartilhadas)
  custom_data jsonb not null default '{}'::jsonb,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.suppliers (org_id) where deleted_at is null;
create index suppliers_name_trgm on public.suppliers using gin (name extensions.gin_trgm_ops);
create index suppliers_categories_idx on public.suppliers using gin (categories);
create trigger suppliers_touch before update on public.suppliers for each row execute function public.touch_updated_at();

create table public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  whatsapp text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.supplier_contacts (supplier_id);

-- O que o fornecedor está apto a produzir/fornecer (ex.: "Batom líquido e gloss": apto)
create table public.supplier_capabilities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  capability text not null,
  status text not null default 'apto' check (status in ('apto','em_avaliacao','suspenso','na')),
  notes text,
  unique (supplier_id, capability)
);
create index on public.supplier_capabilities (org_id, capability, status);

-- Fornecedores envolvidos em cada projeto
create table public.project_suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  role text,     -- terceirista, embalagem primária, fragrância…
  notes text,
  created_at timestamptz not null default now(),
  unique (project_id, supplier_id)
);

-- ---------------------------------------------------------------------
-- Biblioteca de embalagens e componentes
-- ---------------------------------------------------------------------
create table public.packaging_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  component text not null default 'frasco' check (component in (
    'frasco','pote','bisnaga','tampa','valvula','pump','spray','aplicador','retentor',
    'compacto','batom','lapiseira','sache','refil','cartucho','rotulo','sleeve','outro')),
  packaging_type text,            -- tipo visual (lista editável com imagem ilustrativa)
  name text not null,
  code text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  material text,
  capacity numeric(12,3),
  capacity_unit text check (capacity_unit in ('ml','g','kg','L','un')),
  fill_volume numeric(12,3),
  dimensions text,
  weight text,
  finish text,
  color text,
  pantone text,
  closure text,
  thread text,
  valve text,
  applicator text,
  retainer text,
  decoration text,
  customization text,
  moq text,
  lead_time text,
  unit_cost numeric(14,4),
  currency text not null default 'BRL',
  photo_path text,
  notes text,
  internal_notes text,
  custom_data jsonb not null default '{}'::jsonb,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.packaging_items (org_id, component) where deleted_at is null;
create index packaging_name_trgm on public.packaging_items using gin (name extensions.gin_trgm_ops);
create trigger packaging_items_touch before update on public.packaging_items for each row execute function public.touch_updated_at();

-- Componentes compatíveis (ex.: frasco ↔ tampa ↔ aplicador)
create table public.packaging_compat (
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  item_a uuid not null references public.packaging_items(id) on delete cascade,
  item_b uuid not null references public.packaging_items(id) on delete cascade,
  notes text,
  primary key (item_a, item_b),
  check (item_a < item_b)
);

-- ---------------------------------------------------------------------
-- Bibliotecas técnicas (matérias-primas, ativos, fragrâncias, claims, referências…)
-- Campos específicos de cada biblioteca são campos personalizados (entity 'library:<chave>').
-- ---------------------------------------------------------------------
create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  library text not null,
  name text not null,
  category text,
  description text,
  tags text[] not null default '{}',
  supplier_id uuid references public.suppliers(id) on delete set null,
  source_name text,
  source_url text,
  reviewed_on date,
  image_path text,
  data jsonb not null default '{}'::jsonb,
  notes text,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  is_demo boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.library_items (org_id, library) where deleted_at is null;
create index library_name_trgm on public.library_items using gin (name extensions.gin_trgm_ops);
create trigger library_items_touch before update on public.library_items for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Histórico, RLS
-- ---------------------------------------------------------------------
create trigger suppliers_audit after insert or update or delete on public.suppliers for each row execute function public.audit_row();
create trigger packaging_items_audit after insert or update or delete on public.packaging_items for each row execute function public.audit_row();
create trigger library_items_audit after insert or update or delete on public.library_items for each row execute function public.audit_row();

do $$
declare t text;
begin
  foreach t in array array['import_batches','suppliers','supplier_contacts','supplier_capabilities','project_suppliers','packaging_items','packaging_compat','library_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "equipe acessa %1$s" on public.%1$I for all using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Padrões da Fase 2 (idempotente; aplicado a workspaces novos e existentes)
-- ---------------------------------------------------------------------
create or replace function public.seed_phase2_defaults(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s record;
  sid uuid;
  i int;
  lbl text;
  img text;
  pair text[];
begin
  update public.modules set availability = 'available'
   where org_id = p_org and key in ('fornecedores','terceiristas','embalagens','aplicadores','componentes',
     'materias-primas','ativos','fragrancias','claims','referencias','importacao');

  for s in select * from (values
    ('supplier_categories','Categorias de fornecedores', array['Fabricantes terceiristas','Fabricantes full service','Empresas de envase','Fornecedores de embalagens primárias','Fornecedores de embalagens secundárias','Fornecedores de válvulas','Fornecedores de aplicadores','Fornecedores de matérias-primas','Casas de fragrâncias','Laboratórios de testes','Empresas de rotulagem','Gráficas','Prestadores de serviços regulatórios','Outros']),
    ('supplier_capabilities','Capacidades produtivas', array['Aerossol','Base e corretivo líquido','Batom e corretivo bala','Batom líquido e gloss','Compactados e sombras','Esmalte','Glitters e pigmentos','Lápis e lapiseiras','Líquidos','Máscara e delineador','Toalha demaquilante','Caneta delineadora','Pó solto','Skincare','Bodycare','Haircare','Perfumaria']),
    ('certifications','Certificações', array['ISO 9001','ISO 22716 (BPF cosméticos)','ISO 14001','Cruelty free','Vegano','Ecocert','FSC']),
    ('packaging_materials','Materiais de embalagem', array['Vidro','PET','PETG','PP','PE','PEAD','ABS','SAN','Alumínio','PCR','Acrílico','Papel cartão']),
    ('packaging_finishes','Acabamentos de embalagem', array['Brilhoso','Fosco','Leitoso','Translúcido','Transparente','Metalizado','Holográfico','Soft touch','Perolizado']),
    ('packaging_decorations','Decorações', array['Serigrafia','Tampografia','Hot stamping','Pintura','Metalização','Rotulagem','Laser','Sleeve']),
    ('closures','Fechamentos', array['Rosca','Pressão','Flip-top','Disc-top','Magnético','Baioneta']),
    ('raw_material_categories','Categorias de matérias-primas', array['Emolientes','Umectantes','Espessantes','Emulsionantes','Tensoativos','Conservantes','Pigmentos','Filtros solares','Silicones','Óleos e manteigas','Ceras','Polímeros filmógenos']),
    ('active_functions','Funções de ativos', array['Hidratante','Antioxidante','Clareador','Antiacne','Antissinais','Calmante','Esfoliante','Reparador de barreira','Seborregulador','Volumizador labial']),
    ('olfactive_families','Famílias olfativas', array['Floral','Frutal','Cítrica','Amadeirada','Oriental/Âmbar','Gourmand','Aromática','Aquática','Chipre','Fougère','Verde','Almiscarada']),
    ('reference_types','Tipos de referência', array['Tendência','Lançamento de mercado','Relatório','Artigo técnico','Regulatório','Evento/feira'])
  ) as t(key, label, items) loop
    insert into public.option_sets(org_id, key, label) values (p_org, s.key, s.label) on conflict (org_id, key) do nothing;
    select id into sid from public.option_sets where org_id = p_org and key = s.key;
    select coalesce(max(position), 0) into i from public.options where set_id = sid;
    foreach lbl in array s.items loop
      i := i + 1;
      insert into public.options(org_id, set_id, label, position) values (p_org, sid, lbl, i) on conflict (set_id, label) do nothing;
    end loop;
  end loop;

  -- Tipos de embalagem com imagem ilustrativa (arquivos em /public/embalagens)
  insert into public.option_sets(org_id, key, label, description)
  values (p_org, 'packaging_types', 'Tipos de embalagem', 'Imagens ilustrativas de tipo — não representam modelos de fornecedores.')
  on conflict (org_id, key) do nothing;
  select id into sid from public.option_sets where org_id = p_org and key = 'packaging_types';
  i := 0;
  foreach pair slice 1 in array array[
    ['Bisnaga','bisnaga'], ['Bisnaga com ponteira','bisnaga-ponteira'], ['Bisnaga com aplicador','bisnaga-aplicador'],
    ['Frasco pump','frasco-pump'], ['Airless','airless'], ['Frasco spray','frasco-spray'], ['Spray gatilho','spray-gatilho'],
    ['Conta-gotas','conta-gotas'], ['Frasco de base','frasco-base'], ['Frasco de perfume','frasco-perfume'],
    ['Roll-on','roll-on'], ['Stick','stick'], ['Pote','pote'], ['Pote de vidro','pote-vidro'], ['Pó solto','po-solto'],
    ['Compacto','compacto'], ['Paleta','paleta'], ['Batom bala','batom-bala'], ['Balm em stick','balm-stick'],
    ['Frasco de gloss','frasco-gloss'], ['Frasco de batom líquido','batom-liquido'], ['Máscara de cílios','mascara-cilios'],
    ['Delineador','delineador'], ['Lapiseira','lapiseira'], ['Frasco','frasco'], ['Ampola/monodose','ampola'],
    ['Frasco de esmalte',''], ['Sachê',''], ['Refil','']
  ] loop
    i := i + 1;
    img := case when pair[2] = '' then null else '/embalagens/' || pair[2] || '.webp' end;
    insert into public.options(org_id, set_id, label, position, image_path) values (p_org, sid, pair[1], i, img)
    on conflict (set_id, label) do nothing;
  end loop;
end $$;
revoke execute on function public.seed_phase2_defaults(uuid) from public, anon, authenticated;

-- Workspaces novos recebem os padrões das duas fases
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
  perform public.seed_phase2_defaults(v_org);
  return v_org;
end $$;

-- Workspaces existentes
do $$
declare o record;
begin
  for o in select id from public.organizations loop
    perform public.seed_phase2_defaults(o.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Pesquisa global ampliada
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
    select 'projeto', p.id, p.name, coalesce(p.code, '') || ' · ' || coalesce(c.name, ''), '/projetos/' || p.id, similarity(p.name, t)
      from public.projects p join public.clients c on c.id = p.client_id, term
     where p.deleted_at is null and (p.name ilike '%' || t || '%' or p.code ilike '%' || t || '%' or p.category ilike '%' || t || '%')
    union all
    select 'sku', s.id, s.name, coalesce(s.code, '') || ' · ' || p.name, '/projetos/' || p.id || '?aba=skus', similarity(s.name, t)
      from public.skus s join public.projects p on p.id = s.project_id, term
     where s.deleted_at is null and (s.name ilike '%' || t || '%' or s.code ilike '%' || t || '%' or s.gtin ilike '%' || t || '%')
    union all
    select 'fornecedor', f.id, f.name, array_to_string(f.categories, ', '), '/fornecedores/' || f.id, similarity(f.name, t)
      from public.suppliers f, term
     where f.deleted_at is null and (f.name ilike '%' || t || '%' or f.legal_name ilike '%' || t || '%' or f.cnpj ilike '%' || t || '%')
    union all
    select 'embalagem', e.id, e.name, coalesce(e.packaging_type, e.component) || coalesce(' · ' || e.code, ''), '/embalagens/' || e.id, similarity(e.name, t)
      from public.packaging_items e, term
     where e.deleted_at is null and (e.name ilike '%' || t || '%' or e.code ilike '%' || t || '%')
    union all
    select 'biblioteca', l.id, l.name, coalesce(l.category, l.library), '/' || l.library || '?item=' || l.id, similarity(l.name, t)
      from public.library_items l, term
     where l.deleted_at is null and (l.name ilike '%' || t || '%' or array_to_string(l.tags, ' ') ilike '%' || t || '%')
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
-- Desfazer importação: remove o que foi criado e restaura o que foi atualizado
-- ---------------------------------------------------------------------
create or replace function public.undo_import(p_batch uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  b public.import_batches;
  snap jsonb;
  removed int := 0;
  restored int := 0;
  tbl text;
begin
  select * into b from public.import_batches where id = p_batch for update;
  if b.id is null then raise exception 'Importação não encontrada'; end if;
  if b.undone_at is not null then raise exception 'Esta importação já foi desfeita'; end if;
  tbl := case when b.target like 'library:%' then 'library_items' else b.target end;
  if tbl not in ('suppliers','clients','packaging_items','library_items') then raise exception 'Destino inválido'; end if;

  for snap in select * from jsonb_array_elements(b.update_snapshots) loop
    if tbl = 'suppliers' then
      delete from public.supplier_capabilities
       where supplier_id = (snap ->> 'id')::uuid
         and capability in (select jsonb_array_elements_text(coalesce(snap -> 'added_capabilities', '[]'::jsonb)));
      update public.supplier_capabilities c set status = x.value
        from jsonb_each_text(coalesce(snap -> 'previous_capabilities', '{}'::jsonb)) x
       where c.supplier_id = (snap ->> 'id')::uuid and c.capability = x.key;
    end if;
    if coalesce(snap -> 'before', '{}'::jsonb) <> '{}'::jsonb then
    execute format(
      'update public.%I t set %s where t.id = $1',
      tbl,
      (select string_agg(format('%I = (jsonb_populate_record(null::public.%I, $2)).%I', k, tbl, k), ', ')
         from jsonb_object_keys(snap -> 'before') k)
    ) using (snap ->> 'id')::uuid, snap -> 'before';
    end if;
    restored := restored + 1;
  end loop;

  execute format('delete from public.%I where id = any($1)', tbl) using b.created_ids;
  get diagnostics removed = row_count;

  update public.import_batches set undone_at = now() where id = p_batch;
  return jsonb_build_object('removed', removed, 'restored', restored);
end $$;
grant execute on function public.undo_import(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Dados demonstrativos ampliados
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
  delete from public.packaging_items where org_id = v_org and is_demo;
  delete from public.library_items where org_id = v_org and is_demo;
  delete from public.suppliers where org_id = v_org and is_demo;
end $$;

create or replace function public.load_demo_suppliers()
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  s1 uuid; s2 uuid; s3 uuid;
begin
  if not public.is_org_admin(v_org) then raise exception 'Apenas administradores'; end if;
  if exists (select 1 from public.suppliers where org_id = v_org and is_demo) then return; end if;
  insert into public.suppliers(org_id, name, country, city, state, categories, operation_model, moq, lead_time, quality_status, quality_evaluated_year, rating_quality, rating_service, rating_deadline, notes, is_demo)
  values (v_org, '[DEMO] Laboratório Rosa Cosméticos', 'Brasil', 'São Paulo', 'SP', array['Fabricantes terceiristas','Fabricantes full service'], 'Full service', '3.000 un. por SKU', '90 dias', 'approved', 2026, 5, 4, 4, 'Fornecedor demonstrativo.', true)
  returning id into s1;
  insert into public.suppliers(org_id, name, country, city, state, categories, moq, lead_time, quality_status, is_demo)
  values (v_org, '[DEMO] Embalagens Pétala', 'Brasil', 'Diadema', 'SP', array['Fornecedores de embalagens primárias'], '10.000 un.', '45 dias', 'pending', true)
  returning id into s2;
  insert into public.suppliers(org_id, name, country, city, categories, currency, quality_status, is_demo)
  values (v_org, '[DEMO] Maison Fragrances', 'França', 'Grasse', array['Casas de fragrâncias'], 'EUR', 'approved_conditional', true)
  returning id into s3;
  insert into public.supplier_capabilities(org_id, supplier_id, capability, status) values
    (v_org, s1, 'Batom líquido e gloss', 'apto'), (v_org, s1, 'Base e corretivo líquido', 'apto'), (v_org, s1, 'Compactados e sombras', 'em_avaliacao'),
    (v_org, s2, 'Batom líquido e gloss', 'apto'), (v_org, s2, 'Máscara e delineador', 'apto');
  insert into public.supplier_contacts(org_id, supplier_id, name, role, email, is_primary)
  values (v_org, s1, 'Contato Demonstrativo', 'Comercial', 'comercial@exemplo.com', true);
  insert into public.packaging_items(org_id, component, packaging_type, name, code, supplier_id, material, capacity, capacity_unit, finish, closure, applicator, moq, lead_time, unit_cost, is_demo)
  values
    (v_org, 'frasco', 'Frasco de gloss', '[DEMO] Frasco gloss 6 ml cilíndrico', 'DEMO-EMB-01', s2, 'PETG', 6, 'ml', 'Transparente', 'Rosca', 'Doe-foot', '10.000 un.', '45 dias', 1.35, true),
    (v_org, 'frasco', 'Frasco pump', '[DEMO] Frasco pump 150 ml', 'DEMO-EMB-02', s2, 'PET', 150, 'ml', 'Fosco', 'Rosca 24/410', null, '5.000 un.', '30 dias', 2.10, true),
    (v_org, 'pote', 'Pote', '[DEMO] Pote 50 g parede dupla', 'DEMO-EMB-03', s2, 'PP', 50, 'g', 'Soft touch', 'Rosca', null, '5.000 un.', '40 dias', 3.80, true);
end $$;
grant execute on function public.load_demo_suppliers() to authenticated;
