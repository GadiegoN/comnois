# Changelog

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
