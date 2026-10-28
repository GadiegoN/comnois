# Decisões arquiteturais

> Todas as decisões abaixo foram validadas na implementação e registradas detalhadamente em [`registro-de-decisoes.md`](./registro-de-decisoes.md).

## DA-001 — Aplicação web primeiro
**Status:** ACEITA  
Aplicação web responsiva em Next.js App Router (`src/app/`) e API interna/pública autenticada (`src/app/api/`).

## DA-002 — Stack web
**Status:** ACEITA  
Next.js 15 App Router, React 19, TypeScript em modo estrito e Tailwind CSS 4.

## DA-003 — Banco relacional
**Status:** ACEITA  
PostgreSQL como fonte da verdade com Drizzle ORM (`src/db/schema.ts`) e migrações versionadas (`drizzle/0000_easy_harrier.sql`). Suporta conexões `postgresql://` (PostgreSQL externo / Neon) e `pglite://` (PostgreSQL 16 embarcado para execução local e testes isolados).

## DA-004 — Pesquisa textual, semântica e híbrida
**Status:** ACEITA  
Pesquisa lexical, semântica (vetorial sobre `embeddings`) e híbrida via Reciprocal Rank Fusion (RRF, `k = 60`) implementadas em `src/server/search/index.ts`, com reconstrução completa do índice a partir dos dados fonte.

## DA-005 — Jobs e processamento assíncrono
**Status:** ACEITA  
Fila persistente e idempotente na tabela `processing_jobs` (`src/server/jobs/queue.ts`) com worker separado (`src/worker.ts`), controle de versão (`targetContentVersion`), timeout, retries com backoff exponencial e recuperação de jobs órfãos (`recoverStaleJobs`).

## DA-006 — Armazenamento privado de arquivos
**Status:** ACEITA  
Abstração `StorageProvider` (`src/server/storage/index.ts`) com armazenamento local privado fora de `public/` (`.data/storage`), validação de tamanho (25MB), verificação de assinatura binária (magic bytes), hash SHA-256 e entrega autenticada via `/api/assets/[id]`.

## DA-007 — IA por provedores e citações verificáveis
**Status:** ACEITA  
Interface `AIProviderAdapter` (`src/server/ai/providers.ts`) com suporte a provedor local determinístico (`extractive`), OpenAI e Ollama, controle de orçamento diário de tokens e validação estrita de citações e anti-prompt-injection no servidor (`src/server/ai/assistant.ts`).

## DA-008 — Autenticação e autorização
**Status:** ACEITA  
Autenticação server-side (`src/server/services/auth.ts`) com hashing `crypto.scrypt`, comparação em tempo constante (`timingSafeEqual`), sessões no banco com cookies `HttpOnly`/`SameSite=Lax`, tokens de recuperação de uso único e autorização estrita por proprietário/workspace no servidor.

## DA-009 — Repositório único modular
**Status:** ACEITA  
Repositório único organizado em camadas (`src/db`, `src/lib`, `src/server/services`, `src/server/jobs`, `src/server/search`, `src/server/ai`, `src/server/storage`, `src/app/api`, `src/components`).

## DA-010 — Independência de código e licença
**Status:** ACEITA  
Implementação 100% própria e independente, sem reutilização de código-fonte AGPL-3.0 do projeto de referência Karakeep.
