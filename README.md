# Beauty Development Studio

Plataforma de gestão de pesquisa, desenvolvimento e inovação de produtos cosméticos.
Nome, logo e cores são personalizáveis em **Configurações → Identidade visual**.

> **Situação atual: Fase 1 (Fundação) concluída.**
> Veja o que já funciona e o que vem a seguir em [`docs/ROADMAP.md`](docs/ROADMAP.md).
> Detalhes técnicos em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

---

## O que você vai precisar (uma vez só)

| O quê | Para quê | Custo |
|---|---|---|
| Conta no [GitHub](https://github.com) | Guardar o código com histórico de versões | Gratuito |
| Conta no [Supabase](https://supabase.com) | Banco de dados, login e arquivos (fotos, PDFs) | Plano gratuito serve para começar |
| Conta na [Vercel](https://vercel.com) | Publicar o site na internet | Plano gratuito serve para começar |
| Chave da [Anthropic](https://console.anthropic.com) (opcional) | Recursos de IA (a partir da Fase 3) | Paga por uso |

Nenhuma senha ou chave deve ser colada no chat. Elas são digitadas apenas nos painéis do Supabase e da Vercel, como explicado abaixo.

---

## Publicar na internet (passo a passo)

### 1. Criar o banco de dados no Supabase

1. Entre em [supabase.com](https://supabase.com) → **New project**.
2. Dê um nome (ex.: `beauty-studio`), crie uma **senha do banco** forte e guarde-a no seu gerenciador de senhas.
3. Em **Region**, escolha **South America (São Paulo)**.
4. Aguarde o projeto ficar pronto (1–2 minutos).

### 2. Criar as tabelas

1. No menu esquerdo do Supabase, clique em **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/migrations/20261126000001_foundation.sql` deste projeto, copie **todo** o conteúdo, cole no editor e clique em **Run**. Deve aparecer “Success”.
3. Repita com `supabase/migrations/20261126000002_bootstrap_and_functions.sql`.
4. Sempre rode os arquivos **em ordem** (pelo número no nome). Nas próximas fases, novos arquivos serão adicionados. Rode apenas os novos.

### 3. Ajustar o login

1. No Supabase, vá em **Authentication → Sign In / Providers → Email**.
2. Se quiser que só você (e quem você convidar) acesse, depois de criar sua conta desative **Allow new users to sign up**.
3. Em **Authentication → URL Configuration**, coloque em **Site URL** o endereço do site na Vercel (passo 5).

### 4. Pegar as chaves públicas

No Supabase: **Project Settings → API**. Você vai usar:
- **Project URL**
- **anon / public key** (pública por natureza; a proteção dos dados é feita pelas regras de segurança do banco)

> A chave **service_role** é secreta e **não** é necessária nesta fase. Nunca a coloque em variáveis começando com `NEXT_PUBLIC_`.

### 5. Publicar na Vercel

1. Envie este projeto para um repositório seu no GitHub.
2. Na [Vercel](https://vercel.com): **Add New → Project** → escolha o repositório.
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key
4. Clique em **Deploy**. Em 1–2 minutos o site estará no ar.
5. Abra o endereço, clique em **Criar conta**, e o primeiro acesso cria o workspace da sua consultoria.

---

## Rodar no seu computador (opcional, para desenvolvimento)

Pré-requisitos: [Node.js 22+](https://nodejs.org) e [Docker Desktop](https://www.docker.com/products/docker-desktop/) abertos.

Abra o **Terminal** na pasta do projeto e rode, um de cada vez:

```bash
npm install
```

```bash
npm run supabase:local -- start
```

Esse comando sobe um Supabase local (banco, login e arquivos), cria as chaves locais em `.env.local` e aplica as migrações.

```bash
npm run dev
```

Abra http://localhost:3000.

Outros comandos úteis:

```bash
npm run supabase:local -- stop
```

```bash
npm run supabase:local -- reset
```

`stop` desliga mantendo os dados; `reset` **apaga** os dados locais e recomeça do zero.

### Testes

```bash
npm test
```

Roda os testes de cálculo (formatação brasileira, indicadores, campos personalizados).

```bash
npm run test:e2e
```

Roda o teste de aceitação completo no navegador (com `npm run dev` e o Supabase local rodando). Ele cria uma conta de teste e percorre: cliente, projeto, SKUs, cronograma, follow-up, upload, campo e módulo personalizados, sair/entrar e isolamento entre workspaces.

---

## Dados demonstrativos

- No primeiro acesso, marque “Carregar dados demonstrativos” para explorar a interface.
- Todos os registros de demonstração têm “[DEMO]” no nome e o selo **Demonstração**.
- Para removê-los: **Configurações → Dados demonstrativos → Remover**. Seus dados reais não são afetados.

---

## Backup

**Plano gratuito do Supabase:** faça uma exportação periódica (sugestão: semanal).

1. No Supabase: **Database → Backups**. Nos planos pagos os backups diários são automáticos.
2. Para uma cópia completa manual, instale o [Supabase CLI](https://supabase.com/docs/guides/cli) e rode o comando abaixo, trocando a parte entre aspas pelo endereço de conexão em **Project Settings → Database → Connection string**:

```bash
npx supabase db dump --db-url "COLE_AQUI_A_CONNECTION_STRING" -f backup.sql
```

3. Os arquivos (fotos, PDFs) ficam em **Storage → files**. Baixe as pastas pelo painel quando quiser uma cópia.

Exportação com um clique dentro da plataforma: prevista na Fase 7 (módulo Segurança e backups).

---

## Inteligência artificial

Os recursos de IA (pesquisa por link, extração de INCI, resumos) chegam a partir da Fase 3.
Quando chegar a hora:

1. Crie uma chave em [console.anthropic.com](https://console.anthropic.com) → **API Keys**.
2. Na Vercel: **Settings → Environment Variables** → adicione `ANTHROPIC_API_KEY` (sem `NEXT_PUBLIC_`). Ela fica somente no servidor.
3. Faça um novo deploy. Em **Configurações → Integrações** o status muda para “Chave configurada”.

A plataforma nunca simula a IA: sem chave, os recursos aparecem como “Não configurada”.

---

## Manutenção

- **Atualizar o sistema:** cada fase traz novos arquivos em `supabase/migrations/`. Rode os novos no SQL Editor (em ordem) **antes** de publicar o código novo.
- **Nunca edite** uma migração já aplicada em produção. Mudanças viram um arquivo novo.
- **Lixeira:** registros excluídos ficam em Configurações → Lixeira até serem excluídos definitivamente.
- **Histórico:** toda alteração fica em Documentação → Histórico de versões.
