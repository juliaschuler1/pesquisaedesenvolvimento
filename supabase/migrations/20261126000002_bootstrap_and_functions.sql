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
