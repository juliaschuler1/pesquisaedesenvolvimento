# Arquitetura

## Stack

| Camada | Escolha | Observação |
|---|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript | Server Components + Server Actions; `cacheComponents` desativado (todas as telas são por usuário) |
| Estilo | Tailwind CSS 4 + tokens próprios (`src/app/globals.css`) | Cores sobrescritas por workspace via variáveis `--brand-*` |
| Fontes | DM Sans (interface) e Playfair Display (editorial), auto-hospedadas via `@fontsource` | Sem chamadas externas |
| Ícones | Lucide (registro em `src/components/ui/icon.tsx`) | Nomes salvos no banco para módulos |
| Dados | Supabase: PostgreSQL + Auth + Storage | RLS em todas as tabelas |
| Testes | Vitest (unidade) + Playwright (aceitação ponta a ponta) | `npm test`, `npm run test:e2e` |
| Hospedagem | Vercel + Supabase (região São Paulo) | |

## Segurança

- **Isolamento por workspace:** toda tabela tem `org_id` e políticas RLS usando `is_org_staff()` / `is_org_member()` (funções `SECURITY DEFINER` para evitar recursão).
- **Papéis:** `owner`, `admin`, `member` (equipe) e `client_viewer` (reservado ao futuro portal da cliente, com acesso restrito a um `client_id`; hoje não enxerga dados operacionais).
- **Dados internos:** colunas `private_notes`, campos e anexos com `visibility = 'internal'`. Documentos para clientes/fornecedores e o Modo reunião (Fases 4–5) só leem conteúdo `shareable`.
- **Arquivos:** bucket privado `files`, caminho `<org_id>/<entidade>/<id>/<arquivo>`, políticas de storage pelo primeiro segmento. Exibição por URLs assinadas de 1 h. Uploads grandes vão direto do navegador ao Storage (sem o limite de 4,5 MB das funções) e são registrados depois de validar caminho, tipo e tamanho no servidor.
- **Chaves:** só a URL e a chave `anon` são públicas. `ANTHROPIC_API_KEY` será lida apenas no servidor.
- **Entradas:** validação no servidor (`src/lib/forms.ts`, zod no login), cores do tema aceitas apenas como hexadecimal.

## Modelo de dados (Fase 1)

```
organizations ─┬─ memberships (user, papel)        profiles (usuário)
               ├─ org_settings (marca, cores, fuso)
               ├─ nav_groups ── modules (sistema | personalizado; available | planned)
               ├─ option_sets ── options                (listas editáveis)
               ├─ custom_fields ── custom_field_versions (campos sem código, versionados)
               ├─ clients ─┬─ client_contacts
               │           └─ projects ─┬─ skus (herdam projects.sku_shared)
               │                        ├─ schedule_items (peso, dependências, linha de base)
               │                        ├─ project_tabs (abas padrão ou por projeto)
               │                        └─ activities (tarefa, reunião, visita, follow-up…)
               ├─ custom_records (registros de módulos personalizados, JSONB)
               ├─ attachments (polimórfico: entidade + id)
               └─ audit_log (preenchido por trigger: quem, quando, o quê, diff)
```

Visões e funções: `project_progress` (progresso ponderado, etapa atual, etapas atrasadas), `global_search`, `apply_schedule_template`, `bootstrap_workspace`, `load_demo_data` / `remove_demo_data`.

## Estrutura dinâmica

- **Menu:** vem de `modules` + `nav_groups`. Reordenar, renomear, mover de grupo e ocultar ficam no Construtor de módulos.
- **Rotas:** módulos com página própria têm rota em `src/app/(app)/<chave>`. Os demais caem em `src/app/(app)/[module]`, que mostra o módulo personalizado (registros + campos) ou o painel “previsto para a Fase N”.
- **Campos personalizados:** `custom_fields.entity` = `clients`, `projects`, `skus` ou `module:<chave>`. Valores em `custom_data` / `data` (JSONB). Leitura e validação em `src/lib/custom-fields.ts`.
- **Abas do projeto:** linhas com `project_id` nulo são o padrão do workspace; ao personalizar, o projeto ganha cópias próprias.

## Pastas

```
src/app/(app)/…            telas autenticadas
src/app/login, bem-vinda   acesso e primeiro acesso
src/components/ui          design system (primitives, interactive, icon)
src/components/…           blocos reutilizáveis (dashboard, atividades, anexos, registros)
src/lib/                   sessão, formatação pt-BR, domínio, ações, dados
supabase/migrations        SQL versionado (aplicar em ordem)
supabase/local             Supabase local via Docker (desenvolvimento)
tests/unit, tests/e2e      testes
```
