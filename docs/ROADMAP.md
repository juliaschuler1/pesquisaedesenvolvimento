# Plano de implementação

## Fase 1 — Fundação ✅ concluída

Funcionando com banco permanente e testado ponta a ponta:

- Login, criação de conta e workspace da consultoria (primeiro acesso)
- Isolamento total entre workspaces (RLS) e armazenamento privado de arquivos
- Design system rosa-claro (DM Sans + Playfair Display), responsivo, com estados vazios, de carregamento e de erro
- Menu lateral recolhível em grupos, **+ Adicionar novo módulo**, pesquisa global (Ctrl K) e botão **Criar**
- **Dashboard** calculado dos dados reais, com filtros (cliente, categoria, status, prioridade, período de lançamento) e indicadores clicáveis; esteira de desenvolvimento; prazos críticos; semana; categorias; etapas; lançamentos; atividade recente
- **Clientes:** pasta digital (visão geral, projetos, contatos, reuniões e atividades, cronogramas, documentos, histórico), logo, campos personalizados, duplicar, arquivar, lixeira
- **Projetos:** capa, código, categoria/tipo editáveis, conceito, datas, prioridade, status, custo-alvo, orçamento, informações comuns aos SKUs, abas personalizáveis por projeto (+ Nova aba), duplicar, arquivar, lixeira
- **SKUs:** GTIN/EAN validado, cor, Pantone, volumetria, quantidade, herança das informações comuns
- **Cronograma:** modelo de 27 etapas, pesos, marcos, dependências, linha de base preservada, desvio em dias, impacto em dependentes antes de reprogramar (com confirmação), iniciar/pausar/reativar/concluir, reordenar
- **Atividades e Agenda:** tarefas, reuniões, visitas técnicas, aprovações, prazos e follow-ups; calendário mensal com marcos e lançamentos
- **Documentos:** upload (até 25 MB), visibilidade interna/compartilhável
- **Categorias e listas** editáveis + “+ Adicionar nova opção” nos campos de seleção
- **Construtor de módulos:** módulos personalizados (tabela, cards, checklist; global/por cliente/por projeto) e campos personalizados (10 tipos) com versões
- **Histórico de versões** automático e **Configurações** (identidade visual, fuso, dados demonstrativos, lixeira, status das integrações)

## Fase 2 — Cadastros e bibliotecas ✅ concluída

- **Fornecedores e mailing:** ficha completa, múltiplos contatos, categorias, aptidão por tipo de produto (Apto / Em avaliação / Suspenso / N/A), avaliação de qualidade com ano, notas de qualidade/atendimento/prazo, condições comerciais, certificações, logo, catálogos e documentos, campos personalizados, histórico
- **Fabricantes terceiristas:** mesma base, filtrada por categoria e aptidão ("quem é apto a fazer gloss?")
- **Exportar mailing** (.xlsx) com os filtros atuais
- **Fornecedores no projeto:** vínculo com papel (terceirista, embalagem…), visível no projeto e na ficha do fornecedor
- **Importação inteligente** (Excel e CSV): escolha de aba e linha de cabeçalho, planilhas em matriz, seções da planilha → categorias, mapeamento automático editável, novos campos personalizados, prévia com duplicidades, atualização sem sobrescrever (ou substituição, se escolhida), relatório de erros, histórico e **desfazer**; modelos de planilha para baixar; destinos: fornecedores, clientes e embalagens
- **Biblioteca de embalagens** com galeria visual de tipos (imagens ilustrativas identificadas como tal), fotos reais, ficha técnica completa, fornecedor, custo, MOQ, lead time, componentes compatíveis, desenhos técnicos e catálogos; vistas galeria, cards e tabela; bibliotecas de aplicadores e de válvulas/componentes
- **Bibliotecas técnicas:** matérias-primas, ativos, fragrâncias, claims e tecnologias, referências e tendências — com categoria editável, fonte, link, data de atualização, imagem, documentos e campos próprios por biblioteca
- Pesquisa global inclui fornecedores, embalagens e bibliotecas

## Fase 3 — Pesquisa e inteligência de mercado

Concorrentes com fotos e preços, pesquisa por link/nome com IA (dados verificados × inferidos × não encontrados), comparativos de preço por ml/g, matriz de posicionamento, benchmark técnico, fórmula de referência com INCI e OCR.

## Fase 4 — Briefing inteligente

Formulário em 10 etapas com salvamento automático, seleção visual de embalagens, identidade visual e moodboard, target comercial e cenários, Modo reunião (sem dados internos), exportação em PDF editorial.

## Fase 5 — Gestão do desenvolvimento

Amostras e rodadas, testes e laudos, Gantt/Kanban/calendário do cronograma, timeline de follow-ups, cotações e comparativo de propostas, relatórios automáticos.

## Fase 6 — Personalização e IA

Construtor visual completo de formulários (imagens, tabelas, paletas, calculados, condicionais, relacionamentos), módulos com Kanban/calendário/galeria e permissões, AI Studio.

## Fase 7 — Validação e publicação

Testes de segurança, exportação das bases e backups pela plataforma, gestão de membros e convites, documentação final.
