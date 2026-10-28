# Status da Implementação — Plataforma Inteligente de Conhecimento

**Última atualização:** 2026-10-28  
**Estado global:** Etapas 1 a 9 concluídas e verificadas por suíte de testes automatizados, checagem estrita de tipos (`tsc --noEmit`), migrações Drizzle/PostgreSQL e build de produção (`next build`).

---

## 1. Etapas Concluídas

- **Etapa 1 — Diagnóstico e preparação:**
  - Inspeção completa dos 25 documentos do repositório (`README.md`, `AGENTS.md`, `CHANGELOG.md`, `00-visao-geral` a `06-operacao-e-negocio`).
  - Inicialização do repositório Git local (`git init`).
  - Formalização das decisões arquiteturais `DA-001` a `DA-010` em `docs/00-visao-geral/registro-de-decisoes.md` e `docs/00-visao-geral/decisoes-arquiteturais.md`.
- **Etapa 2 — Fundação executável:**
  - Configuração de Next.js 15 (`15.5.28`) com App Router, React 19 (`19.3.1`), TypeScript estrito (`5.9.3`), Tailwind CSS 4 (`4.3.3`), Drizzle ORM (`0.39.3`), `pg` (`8.23.1`), `@electric-sql/pglite` (`0.2.17`), `zod` (`3.25.76`), `cheerio` (`1.2.0`) e `vitest` (`3.2.7`).
  - Validação estrita de variáveis de ambiente (`src/lib/env.ts`).
  - Logger estruturado com redação automática de senhas, chaves de API, cookies e tokens (`src/lib/logger.ts`).
  - Conexão PostgreSQL dual (`src/db/index.ts`) compatível com PostgreSQL externo / Neon (`postgresql://...`) e PostgreSQL 16 embarcado (`pglite://...`) com migrações versionadas em `drizzle/0000_easy_harrier.sql`.
- **Etapa 3 — Persistência, identidade e isolamento:**
  - Cadastro, login, sessão persistida em banco (`sessions`) com hash SHA-256 e cookie `HttpOnly`/`SameSite=Lax`.
  - Hashing de senha com `crypto.scrypt` + salt aleatório de 16 bytes + verificação em tempo constante (`timingSafeEqual`).
  - Recuperação de senha com token de uso único (`password_reset_tokens`), expiração e revogação automática de sessões antigas.
  - Rate limiting por IP/identificador (`src/lib/security/rate-limit.ts`).
  - Isolamento estrito no servidor (`assertItemAccess`, `requireWorkspaceRole`) impedindo acesso cruzado (IDOR) entre usuários e workspaces.
- **Etapa 4 — Biblioteca e captura:**
  - Fluxo completo para criação, listagem, visualização de detalhe, edição, arquivamento, favorito, ações em lote e exclusão de `link`, `note`, `file` (PDF/TXT/MD/CSV/JSON) e `image` (PNG/JPG/WEBP).
  - Normalização de URLs preservando query params relevantes e removendo parâmetros de rastreamento (`utm_*`, `fbclid`, `gclid`) para detecção de duplicidade com aviso não destrutivo (`src/lib/security/url-normalizer.ts`).
  - Proteção anti-SSRF multi-camada (`src/lib/security/ssrf.ts`) bloqueando loopback, IPs privados/reservados (IPv4 e IPv6), link-local (`169.254.169.254`), resolvendo DNS antes da requisição e revalidando cada salto de redirecionamento HTTP.
  - Sanitização de HTML contra XSS (`src/lib/security/sanitize.ts`).
  - Armazenamento privado de arquivos fora de `public/` (`src/server/storage/index.ts`) com validação de magic bytes binários, hash SHA-256 e download autenticado via `/api/assets/[id]`.
- **Etapa 5 — Processamento assíncrono:**
  - Fila persistente na tabela `processing_jobs` (`src/server/jobs/queue.ts`) e processo worker dedicado (`src/worker.ts`).
  - Suporte a `fetch_link`, `extract_content`, `ocr_asset`, `chunk_and_index`, `generate_ai_metadata`, `generate_embeddings` e `delete_derived_data`.
  - Controle de idempotência (`idempotencyKey`), guarda de versão (`contentVersion` vs `targetContentVersion`), timeout por job, retentativas com backoff exponencial, recuperação de tarefas órfãs (`recoverStaleJobs`) e cancelamento seguro quando um item é excluído durante o processamento.
- **Etapa 6 — Pesquisa:**
  - Pipeline de chunking estruturado (`src/server/search/chunker.ts`) preservando parágrafos, offsets (`startOffset`, `endOffset`), localizador (`locator`) e hash SHA-256.
  - Pesquisa lexical, semântica (vetorial com similaridade de cosseno e rastreamento de `modelVersion`/`dimensions`) e híbrida via Reciprocal Rank Fusion (RRF, `k = 60`) com fallback automático para busca textual (`src/server/search/index.ts`).
  - Filtros combináveis (tipo, etiquetas, coleção, favorito, arquivado, estado de processamento), ordenação determinística e reconstrução integral do índice (`reindexUserLibrary`).
- **Etapa 7 — Assistente de conhecimento (RAG):**
  - Camada de provedores de IA isolada (`src/server/ai/providers.ts`) com `ExtractiveLocalProvider` (funcional sem chave externa), `OpenAICompatibleProvider` e `OllamaProvider`.
  - Criptografia AES-256-GCM para chaves de API salvas, mascaramento na leitura e controle diário de orçamento de tokens por usuário (`ai_usage_logs`).
  - Assistente fundamentado (`src/server/ai/assistant.ts`) que neutraliza tentativas de prompt injection no conteúdo recuperado, separa evidência direta de síntese, sinaliza divergências entre fontes e valida todas as citações (`[CIT-N]`) no servidor contra os trechos efetivamente recuperados.
- **Etapa 8 — Recursos complementares e Evoluções Avançadas:**
  - Exportação e importação portável (`src/server/services/portability.ts`) no formato documentado `comnois-export-v1` com manifesto, políticas de duplicidade (`skip`, `overwrite`, `append`), **prévia não destrutiva (*Dry-Run Preview*)**, **importador/exportador de Favoritos HTML Netscape** (`parseNetscapeBookmarksHtml` / `exportLibraryAsNetscapeHtml`) e **exportador CSV** (`exportLibraryAsCsv`).
  - **Linguagem de Consulta Estruturada (Query DSL)** na busca (`src/server/search/query-dsl.ts`), permitindo filtrar diretamente na barra de pesquisa por `is:fav`, `is:archived`, `type:link|note|file|image`, `status:completed|failed|pending`, `site:dominio.com`, `#tag` e datas (`after:YYYY-MM-DD`, `before:YYYY-MM-DD`).
  - **Assinaturas e Sincronização de Feeds RSS 2.0 / Atom** (`src/server/services/feeds.ts` e tabela `rss_feeds` na migração `drizzle/0002_clammy_human_cannonball.sql`) com proteção anti-SSRF, desduplicação automática de links e aplicação de etiquetas/coleções.
  - Coleções Inteligentes (*Smart Collections*) avaliadas dinamicamente por regras (`domainContains`, `titleContains`, `itemType`, `tagName`, `isFavorite`), **Hierarquia de Coleções com Prevenção de Ciclos** (`moveCollection` e `assertNoCollectionCycle` em `src/server/services/organization.ts`) e confirmação/rejeição explícita de etiquetas sugeridas por IA (`confirmOrRejectItemTag`).
  - **Exclusão Completa de Conta e Dados (Direito de Exclusão LGPD/GDPR)** (`deleteUserAccountCompletely` em `src/server/services/auth.ts`) com confirmação de senha, remoção física de todos os blobs no storage privado e cascata relacional completa, além de gestão de sessões ativas (`listUserSessions`, `revokeAllUserSessions`) e trilha de auditoria (`listUserAuditLogs`).
  - **CLI Oficial (`pnpm cli` / `src/cli.ts`)** para busca com Query DSL, adição de links/notas, perguntas ao Assistente RAG, exportação multi-formato, diagnóstico de saúde e benchmark via terminal.
  - Armazenamento compatível com S3 / Cloudflare R2 / MinIO (`S3CompatibleStorage`) com assinatura criptográfica nativa **AWS Signature V4** (`buildAwsSigV4Headers`) em `src/server/storage/index.ts`.
  - Webhooks de saída assinados com **HMAC-SHA256** (`X-Comnois-Signature: t=...,v1=...`), proteção anti-SSRF no cadastro e disparo, e histórico de entregas auditável (`webhooks` e `webhook_deliveries` em `src/server/services/webhooks.ts`).
  - Tokens de API com escopo granular (`read` vs `write`) validados em todas as rotas (`requireCurrentUser(requiredScope)`), regras de automação na captura e gestão de workspaces colaborativos com convites expiráveis, papéis (`owner`, `admin`, `member`) e transferência de propriedade.
  - Extensão de navegador Chrome/Edge Manifest V3 (`extensions/chrome-capture/`) e artefatos de self-hosting em produção (`Dockerfile` multi-stage e `docker-compose.yml` com PostgreSQL 16, Web e Worker).
- **Etapa 9 — Qualidade, Observabilidade, Diagnóstico de Backup e Benchmark RAG:**
  - Diagnóstico de saúde e verificação de integridade física de blobs no storage (`getSystemHealthAndBackupIntegrity` em `src/server/services/observability.ts`).
  - Benchmark quantitativo automatizado de Pesquisa (Lexical, Semântica e Híbrida RRF) e Assistente RAG (`runSearchAndRagEvaluationBenchmark` em `src/server/search/evaluator.ts` e endpoint `/api/health`), medindo Recall@3, Precision@1, MRR e precisão de citações verificadas.
  - Suíte de testes automatizados (`tests/platform.test.ts`), verificação estrita de tipos (`pnpm typecheck`) e build de produção (`pnpm build`).

---

## 2. Comandos de Validação Executados e Resultados Reais

| Comando | Finalidade | Resultado |
|---|---|---|
| `pnpm db:generate` | Geração de migrações SQL versionadas (24 tabelas PostgreSQL) | **PASS** (`0000`, `0001`, `0002` e `0003_curly_lionheart.sql`) |
| `pnpm db:migrate` | Aplicação das migrações SQL no banco PostgreSQL | **PASS** |
| `pnpm test` | Suíte de 15 testes cobrindo auth, RBAC, IDOR, LGPD erasure, SSRF, XSS, links, uploads, S3 SigV4, Smart Collections, prevenção de ciclos hierárquicos, tags de IA, Webhooks HMAC, Feeds RSS/Atom, Query DSL, CLI oficial, Netscape HTML/CSV Dry-Run, workers, busca RRF, RAG, portabilidade, integridade de storage e benchmark quantitativo | **PASS** (15/15 testes aprovados) |
| `pnpm typecheck` | Verificação estrita TypeScript (`tsc --noEmit`) | **PASS** (0 erros) |
| `pnpm build` | Build otimizado de produção Next.js 15 App Router | **PASS** |

---

## 3. Limitações Conhecidas e Dependências Externas

1. **Provedores comerciais de IA (OpenAI) e Ollama local:** os adaptadores HTTP estão implementados e validados por contrato, mas chamadas reais a endpoints externos dependem de chave `OPENAI_API_KEY` válida ou de um servidor Ollama em execução em `http://localhost:11434`. Por padrão, o provedor `extractive` local está ativo e permite usar toda a plataforma sem chaves externas.
2. **OCR óptico em imagens puras:** imagens enviadas são validadas por magic bytes e armazenadas com segurança; sem um provedor externo de visão/OCR configurado, o job conclui com estado `partial` explicando que a imagem está preservada mas sem extração óptica externa.
3. **E-mail transacional (SMTP):** na recuperação de senha em ambiente de desenvolvimento, o token de uso único é retornado no próprio fluxo local para permitir validação ponta a ponta sem servidor SMTP externo.

---

## 4. Próxima Unidade Funcional (Evolução Futura)

- Extensão de navegador dedicada consumindo a API `/api/items` autenticada por token `cmn_...`.
- Armazenamento de objetos remoto S3/R2 em ambiente cloud gerenciado.

