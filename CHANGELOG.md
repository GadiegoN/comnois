# Changelog

## 2.0.0 — 2026-11-04 — Importador Round-Trip de Vault Markdown/Obsidian, OCR Multimodal (Gemini Vision + Metadados PNG) e Extensão Chrome v2.0
- Implementado o **Importador de Vault Markdown / Obsidian** (`parseMarkdownVaultImport` e detecção automática `markdown-vault` em `previewImportLibrary` e `importUserLibrary` em `src/server/services/portability.ts`, integrado ao seletor de formato em `src/components/workspace/PortabilityTab.tsx`), completando o ciclo *round-trip* de exportação e reimportação de múltiplos nós `.md` preservando `[[WikiLinks]]`, `#tags`, URLs e coleções.
- Implementado **OCR Multimodal de Imagens (`extractImageOcr`) e Extrator Determinístico de Metadados `tEXt`/XMP (`extractEmbeddedImageMetadataText`)** em `src/server/ai/providers.ts` e integrado ao worker `ocr_asset` em `src/server/jobs/queue.ts`, suportando transcrição óptica nativa via Google Gemini Vision (`inlineData`) e extração offline de chunks textuais embutidos em imagens PNG/XMP.
- Evoluída a **Extensão de Navegador Chrome/Edge para `v2.0.0`** (`extensions/chrome-capture/`), permitindo alternar entre captura de Links e captura de Notas / Trechos selecionados com `[[WikiLinks]]`.
- Expandida a suíte de testes de integração (`tests/platform.test.ts`) para **20 cenários ponta a ponta**.

## 1.9.0 — 2026-11-04 — Exportador de Vault Markdown/Obsidian, Smart Collections via Query DSL e Grafo via MCP & CLI
- Implementado o **Exportador de Vault Markdown / Obsidian** (`exportLibraryAsMarkdownVault` em `src/server/services/portability.ts`, endpoint `GET /api/portability?format=markdown`, comando `pnpm cli export markdown` e cartão em `src/components/workspace/PortabilityTab.tsx`), exportando a biblioteca inteira como um Vault estruturado com metadados YAML, índice completo de `[[WikiLinks]]`, tags, destaques e conteúdo.
- Expandidas as **Coleções Inteligentes (*Smart Collections*)** (`evaluateSmartCollectionItemIds` em `src/server/services/organization.ts`) para avaliar expressões completas da **Query DSL** (`is:fav`, `type:...`, `site:...`, `#tag`, texto livre) e adicionado seletor de **Coleção Pai (`parentId`)** na criação de coleções hierárquicas em `src/components/workspace/OrganizationTab.tsx`.
- Adicionada a ferramenta **`comnois_knowledge_graph`** ao servidor **Model Context Protocol (MCP — JSON-RPC 2.0)** (`src/server/mcp.ts`) e o comando **`pnpm cli graph`** na CLI oficial (`src/cli.ts`), permitindo que agentes externos e operadores consultem a topologia completa do Grafo de Nós.
- Expandida a suíte de testes de integração (`tests/platform.test.ts`) para **19 cenários ponta a ponta**.

## 1.8.0 — 2026-11-04 — Links Bidirecionais entre Nós (`[[WikiLinks]]` & Backlinks) e Síntese Permanente de Respostas RAG em Nós
- Implementada a resolução bidirecional de **`[[WikiLinks]]` e Backlinks Automáticos** (`extractWikiLinks` e `resolveNodeLinksAndBacklinks` em `src/server/search/index.ts`, integrados a `getItemDetail` e `exportSingleItemAsMarkdown` em `src/server/services/items.ts`), permitindo referenciar outros nós com `[[Título do Nó]]` e inspecionar todos os nós que citam o documento atual com snippet de contexto.
- Integrados os links explícitos `[[WikiLinks]]` ao **Motor de Grafo de Conhecimento** (`buildKnowledgeGraph`), promovendo referências diretas entre nós a arestas de afinidade máxima (`similarityScore = 1.0`, `isExplicitWikiLink = true`).
- Implementada a **Síntese de Resposta RAG em Nó Permanente** (`saveAssistantAnswerAsNote` em `src/server/ai/assistant.ts`, `POST /api/assistant` com `action: "saveAsNote"` e botão **Salvar Síntese como Nó (`[[WikiLinks]]`)** em `src/components/workspace/AssistantTab.tsx`), transformando respostas fundamentadas do Assistente em notas estruturadas automaticamente conectadas via `[[WikiLinks]]` às fontes citadas.
- Adicionada renderização visual de badges `[[WikiLinks]]` em `src/components/ui/MarkdownReader.tsx`, seção interativa de **Links Bidirecionais entre Nós** em `src/components/workspace/ItemDetailDrawer.tsx`, correção de chaves únicas em `listUserWorkspaces` e expansão da suíte para **18 testes automatizados ponta a ponta** (`tests/platform.test.ts`).

## 1.7.0 — 2026-11-04 — Motor Semântico de Grafo no Servidor (`/api/graph`), Provedor Nativo Google Gemini e Leitor Editorial Markdown
- Implementado o **Motor Semântico de Grafo de Conhecimento no Servidor** (`buildKnowledgeGraph` em `src/server/search/index.ts` e endpoint `GET /api/graph` em `src/app/api/graph/route.ts`), calculando centroides vetoriais por item, similaridade de cosseno (65%), interseção de etiquetas confirmadas (30%), bônus de domínio, grau do nó e índice de centralidade, consumido em tempo real por `src/components/workspace/KnowledgeGraphTab.tsx` com seletor de limiar semântico (`25%`, `35%`, `50%`).
- Implementado o **Provedor Nativo Google Gemini (`GeminiProvider`)** em `src/server/ai/providers.ts` (`gemini-2.5-flash` via `:generateContent` e `text-embedding-004` via `:embedContent`), integrado ao esquema (`src/db/schema.ts`) e à interface de configuração (`src/components/workspace/SettingsAndSecurityTab.tsx`).
- Criado o **Leitor Editorial Estruturado (`src/components/ui/MarkdownReader.tsx`)** integrado ao painel de detalhes (`src/components/workspace/ItemDetailDrawer.tsx`) com alternância entre modo **Editorial** (renderização tipográfica de títulos, blocos de código, citações, listas e seleção instantânea de destaques) e **Texto Bruto**.
- Expandida a suíte de testes de integração (`tests/platform.test.ts`) para **17 cenários ponta a ponta**, cobrindo o grafo semântico no servidor com isolamento multi-tenant e a configuração criptografada do provedor Google Gemini.

## 1.6.0 — 2026-11-04 — Grafo Interativo de Nós do Conhecimento ("Com Nós"), Command Palette Global (`Ctrl+K`) e Seleção Rápida de Destaques
- Implementada a aba **Grafo de Nós do Conhecimento** (`src/components/workspace/KnowledgeGraphTab.tsx`), renderizando visualmente os itens do acervo como nós em layout radial concêntrico conectados por arestas ponderadas (tags compartilhadas e domínio), com filtro em tempo real, inspeção de vizinhança semântica e abertura direta do documento.
- Implementado o **Command Palette Global (`Ctrl+K` / `Cmd+K`)** (`src/components/workspace/CommandPaletteModal.tsx`), permitindo navegação instantânea por teclado entre as 7 abas do Workspace, busca rápida de nós por título/`#tag`, troca imediata entre os 4 temas visuais e envio direto de perguntas ao Assistente RAG.
- Adicionada captura automática de seleção de texto (`onMouseUp`) no leitor de documentos (`src/components/workspace/ItemDetailDrawer.tsx`) para preenchimento instantâneo de novos Destaques (*Highlights*).
- Completados os controles de sessão, auditoria de segurança, convites RBAC de workspaces e configuração detalhada de provedores de IA (OpenAI/Ollama/Extrativo com barra de orçamento de tokens) em `src/components/workspace/SettingsAndSecurityTab.tsx`.

## 1.5.0 — 2026-10-28 — Arquitetura Front-End Modular, Design System Multi-Tema (4 Temas) e Landing Page do Produto
- Refatorado e decomposto o front-end do Workspace em **componentes modulares reutilizáveis** (`src/components/ui/`, `src/components/workspace/`, `src/components/providers/` e `src/types/platform.ts`), separando claramente rotas SSR Server Components (`src/app/page.tsx`, `src/app/welcome/page.tsx`, `src/app/layout.tsx`) de Client Components interativos.
- Implementado **Design System Semântico com 4 Temas Visuais** em `src/app/globals.css` (integrado ao `@theme` do Tailwind CSS v4) com persistência instantânea via `ThemeProvider` e `ThemeSwitcher`: **Alabaster** (`light`), **Sépia Editorial** (`sepia`), **Obsidian** (`dark`) e **Aurora** (`nord`).
- Criada **Landing Page de Apresentação do Produto** (`src/components/landing/LandingPage.tsx`, rota `/welcome` e `/` para visitantes não autenticados) com vitrine interativa em tempo real (`LandingShowcaseClient.tsx`) demonstrando o Assistente RAG Verificável, a Busca Híbrida RRF + Query DSL e a integração CLI / MCP / Snapshots Offline.
- Adicionado controle de vivacidade (`SELECT 1`), limpeza automática de locks órfãos (`postmaster.pid`) e auto-recuperação resiliente para o banco PostgreSQL 16 embarcado (PGlite WASM) em `src/db/index.ts`, além de botão de importação rápida dos 28 documentos oficiais da arquitetura na barra da Biblioteca (`action: "ingestDocs"` em `/api/jobs`).

## 1.4.0 — 2026-10-28 — Histórico RAG com Retenção, Conexões Semânticas, Snapshots Offline, Diagnóstico Vetorial e Servidor MCP
- Implementado **Histórico Auditável de Conversas do Assistente RAG & Controle de Retenção de Privacidade** (`assistant_conversations` e `assistant_messages` na migração `drizzle/0004_worried_rumiko_fujikawa.sql`, `listAssistantConversations`, `getAssistantConversationMessages`, `deleteAssistantConversation` e `purgeAssistantHistory` em `src/server/ai/assistant.ts`).
- Implementada **Descoberta Semântica de Itens Relacionados ("Conexões do Conhecimento")** (`findRelatedItems` em `src/server/search/index.ts`), combinando similaridade de cosseno entre embeddings de chunks, interseção de etiquetas e domínio com isolamento estrito por usuário.
- Implementados **Snapshots Imutáveis de Leitura Offline & Exportação Individual Markdown (`.md`)** (`createOfflineSnapshotForItem` e `exportSingleItemAsMarkdown` em `src/server/services/items.ts`), preservando metadados YAML, destaques e hash de integridade SHA-256 no storage privado.
- Implementado **Diagnóstico de Cobertura & Consistência do Índice Vetorial** (`getEmbeddingIndexDiagnostics` em `src/server/search/index.ts` e integrado ao `/api/health`), detectando divergências de dimensão/modelo (`hasModelDrift`, `hasDimensionMismatch`) e estimando custo de reindexação.
- Implementado **Servidor Model Context Protocol (MCP — JSON-RPC 2.0)** (`src/server/mcp.ts` e `pnpm cli mcp`), expondo `comnois_search`, `comnois_ask_rag`, `comnois_related_items`, `comnois_add_note` e `comnois_add_link` para integração com agentes externos.

## 1.3.0 — 2026-10-28 — Hierarquia de Coleções Anti-Ciclo, CLI Oficial e Exclusão Completa LGPD/GDPR
- Implementada **Hierarquia de Coleções com Prevenção de Ciclos** (`parentId` na migração `drizzle/0003_curly_lionheart.sql`, `moveCollection` e `assertNoCollectionCycle` em `src/server/services/organization.ts`).
- Implementado o **Cliente de Linha de Comando (CLI Oficial)** em `src/cli.ts` (`pnpm cli search|add-link|add-note|ask|export|health|benchmark`).
- Implementada **Exclusão Completa de Conta e Dados (Direito de Exclusão LGPD/GDPR)** (`deleteUserAccountCompletely` em `src/server/services/auth.ts`), removendo blobs físicos do storage privado e todos os registros e derivados em cascata mediante confirmação de senha, além de listagem/revogação de sessões ativas e trilha de auditoria.

## 1.2.0 — 2026-10-28 — Query DSL de Busca, Favoritos Netscape HTML/CSV com Dry-Run, Feeds RSS/Atom e Docker Self-Hosting
- Implementada **Linguagem de Consulta Estruturada (Query DSL)** em `src/server/search/query-dsl.ts` (`is:fav`, `is:archived`, `type:link|note|file|image`, `status:*`, `site:dominio`, `#tag`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`).
- Expandido o módulo de portabilidade (`src/server/services/portability.ts`) com **importador e exportador de Favoritos HTML Netscape**, **exportador CSV** e **prévia de importação não destrutiva (*Dry-Run Preview*)**.
- Implementadas **Assinaturas e Sincronização de Feeds RSS 2.0 e Atom** (`src/server/services/feeds.ts` e tabela `rss_feeds` na migração `drizzle/0002_clammy_human_cannonball.sql`) com proteção anti-SSRF e desduplicação automática.
- Adicionados `Dockerfile` multi-stage e `docker-compose.yml` (orquestrando `postgres:16-alpine`, `web` e `worker`) para implantação e self-hosting simplificados.

## 1.1.0 — 2026-10-28 — Smart Collections, S3 SigV4, Webhooks HMAC, Benchmark RAG & Extensão de Navegador
- Adicionadas **Coleções Inteligentes (*Smart Collections*)** baseadas em regras dinâmicas (`domainContains`, `titleContains`, `itemType`, `tagName`, `isFavorite`) e fluxo de confirmação ou rejeição de etiquetas sugeridas por IA (`confirmOrRejectItemTag`).
- Implementado adaptador `S3CompatibleStorage` com assinatura nativa **AWS Signature V4** (`buildAwsSigV4Headers`) para suporte a AWS S3, Cloudflare R2 e MinIO.
- Implementados **Webhooks de saída assinados com HMAC-SHA256** (`X-Comnois-Signature`), validação anti-SSRF e histórico de entregas auditável (`webhooks` e `webhook_deliveries` na migração `drizzle/0001_wonderful_bill_hollister.sql`).
- Adicionado controle granular de escopos de token de API (`read` vs `write`) no servidor e pacote da **Extensão de Navegador Chrome/Edge Manifest V3** em `extensions/chrome-capture/`.
- Implementados diagnóstico de integridade física de blobs no storage (`getSystemHealthAndBackupIntegrity`) e motor de avaliação quantitativa de Pesquisa & RAG (`runSearchAndRagEvaluationBenchmark`) com métricas Recall@3, Precision@1, MRR e precisão de citações.

## 1.0.0 — 2026-10-28 — Implementação Completa da Plataforma
- Implementada fundação Next.js 15 App Router, React 19, TypeScript estrito, Tailwind CSS 4 e Drizzle ORM com PostgreSQL (21 tabelas e migração versionada `drizzle/0000_easy_harrier.sql`).
- Implementada autenticação segura (`scrypt`, sessões `HttpOnly` no banco, recuperação de senha de uso único, tokens de API `cmn_...` e isolamento estrito entre usuários e workspaces).
- Implementada biblioteca completa para captura de links (com proteção anti-SSRF multi-camada e detecção de duplicidades), notas e upload privado de arquivos/PDFs/imagens.
- Implementados workers e fila persistente (`processing_jobs`) com idempotência, retries com backoff, recuperação de jobs órfãos e proteção de versão de conteúdo.
- Implementadas pesquisas lexical, semântica (vetorial) e híbrida (Reciprocal Rank Fusion) com reconstrução integral do índice.
- Implementado Assistente de Conhecimento (RAG) com citações verificadas no servidor, defesa contra prompt injection e controle de provedores/custos de IA.
- Implementada portabilidade completa (exportação e importação JSON `comnois-export-v1`) e suíte automatizada de testes (`vitest`).

## 0.2.0 — Confronto e auditoria técnica de referência (Karakeep)
- Acrescentado relatório comparativo de módulos e auditoria técnica direcionada em `docs/01-analise-de-referencia/`.

## 0.1.0 — Estrutura documental inicial
- Definida visão do produto, princípios, especificação funcional, arquitetura, RAG e plano de entrega.
