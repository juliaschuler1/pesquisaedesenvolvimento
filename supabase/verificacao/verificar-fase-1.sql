-- Verificação da instalação (Fase 1). Só lê informações; não altera nada.
with esperado(tipo, nome) as (values
  ('tabela','organizations'),('tabela','profiles'),('tabela','memberships'),('tabela','org_settings'),
  ('tabela','nav_groups'),('tabela','modules'),('tabela','option_sets'),('tabela','options'),
  ('tabela','custom_fields'),('tabela','custom_field_versions'),('tabela','clients'),('tabela','client_contacts'),
  ('tabela','projects'),('tabela','project_tabs'),('tabela','skus'),('tabela','schedule_templates'),
  ('tabela','schedule_items'),('tabela','activities'),('tabela','custom_records'),('tabela','attachments'),
  ('tabela','audit_log'),('visão','project_progress'),
  ('função','bootstrap_workspace'),('função','seed_org_defaults'),('função','apply_schedule_template'),
  ('função','global_search'),('função','load_demo_data'),('função','remove_demo_data'),
  ('função','audit_row'),('função','handle_new_user'),
  ('bucket','files'),('gatilho','on_auth_user_created')
),
existe(tipo, nome) as (
  select 'tabela', table_name::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
  union all select 'visão', table_name::text from information_schema.views where table_schema = 'public'
  union all select 'função', routine_name::text from information_schema.routines where routine_schema = 'public'
  union all select 'bucket', id::text from storage.buckets
  union all select 'gatilho', tgname::text from pg_trigger where not tgisinternal
)
select case
  when count(*) filter (where x.nome is null) = 0 then '✅ Instalação da Fase 1 completa (' || count(*) || ' itens conferidos)'
  else '⚠️ Faltando: ' || string_agg(e.tipo || ' ' || e.nome, ', ') filter (where x.nome is null)
end as resultado
from esperado e
left join (select distinct tipo, nome from existe) x on x.tipo = e.tipo and x.nome = e.nome;
