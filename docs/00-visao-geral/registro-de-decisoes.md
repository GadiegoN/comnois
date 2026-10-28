# Registro de decisões

Use uma seção por decisão. Não sobrescreva uma decisão aceita sem registrar a mudança.

## DA-001 — Aplicação web responsiva primeiro
- **ID:** DA-001
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** Necessidade de entregar o fluxo completo de captura, biblioteca, pesquisa, processamento assíncrono, portabilidade e assistente de conhecimento com citações verificáveis.
- **Decisão:** Construir primeiro a aplicação web responsiva com API server-side unificada em Next.js App Router.
- **Alternativas consideradas:** Monorepo separado com clientes mobile/extensão simultâneos.
- **Consequências:** Menor sobrecarga operacional e foco total na integridade do domínio, segurança e testes.
- **Como validar:** Execução dos fluxos principais via interface web e API autenticada.

## DA-002 — Stack web (Next.js 15 App Router, React 19, TypeScript estrito, Tailwind CSS 4)
- **ID:** DA-002
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** Padronização da camada web e tipagem de ponta a ponta.
- **Decisão:** Adotar Next.js 15 com App Router, React 19, TypeScript (`strict: true`) e Tailwind CSS 4, mantendo regras de negócio e autorização exclusivamente no servidor.
- **Alternativas consideradas:** SPA separada com backend Express/Fastify.
- **Consequências:** Rotas de API, Server Components e camada de domínio compartilham tipos e validações Zod no mesmo repositório.
- **Como validar:** `pnpm typecheck` e `pnpm build` sem erros.

## DA-003 — Banco relacional PostgreSQL com Drizzle ORM e adaptador dual (pg / PGlite)
- **ID:** DA-003
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** O PostgreSQL é a fonte de verdade para todas as entidades. Em ambientes locais e suítes de teste onde um servidor PostgreSQL externo com `pgvector` pode não estar provisionado com credenciais conhecidas, ainda precisamos de execução PostgreSQL real sem mocks falsos.
- **Decisão:** Utilizar Drizzle ORM (`drizzle-orm/pg-core`) com suporte transparente a `postgresql://...` (via driver `pg`, compatível com PostgreSQL/Neon) e `pglite://...` (PostgreSQL 16 real embarcado com extensão `vector` / `pgvector` nativa).
- **Alternativas consideradas:** SQLite em desenvolvimento e PostgreSQL em produção (rejeitado por divergência de dialeto SQL, FTS e vetores).
- **Consequências:** Mesmo dialeto PostgreSQL, mesmas constraints, índices e migrações SQL em testes automatizados, desenvolvimento local e produção.
- **Como validar:** Testes de integração e migrações executados contra o motor PostgreSQL real.

## DA-004 — Pesquisa textual, semântica e híbrida (RRF) reconstruível
- **ID:** DA-004
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** Necessidade de pesquisa textual imediata (sem depender de IA), além de pesquisa semântica por chunks/embeddings e modo híbrido com fallback seguro.
- **Decisão:** Implementar pesquisa lexical sobre os dados e chunks no PostgreSQL (com ranking textual, filtros combináveis e snippets), pesquisa semântica sobre a tabela `embeddings` (com modelo, dimensão e hash de versão rastreados) e fusão híbrida via Reciprocal Rank Fusion (RRF, `k = 60`), garantindo reconstrução total do índice a partir das tabelas fonte.
- **Alternativas consideradas:** Dependência obrigatória de Meilisearch externo.
- **Consequências:** Zero dependência de infraestrutura externa para busca; índice sempre sincronizado e reconstruível.
- **Como validar:** Testes cobrindo busca textual, filtros, exclusão de itens, atualização de conteúdo, busca semântica/híbrida e reindexação.

## DA-005 — Fila persistente de jobs no PostgreSQL e Worker idempotente
- **ID:** DA-005
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** Tarefas demoradas (captura web, extração, chunking, indexação, resumo/tags por IA, geração de embeddings) não devem bloquear requisições nem perder estado em falhas.
- **Decisão:** Implementar fila transacional persistida na tabela `processing_jobs` com controle de estado (`pending`, `processing`, `succeeded`, `retrying`, `failed`, `cancelled`), tentativas com backoff exponencial, timeout por job, recuperação de jobs órfãos (`recoverStaleJobs`) e verificação de versão do item (`content_version`) para impedir que jobs antigos sobrescrevam edições mais novas ou recriem dados de itens excluídos.
- **Alternativas consideradas:** Filas em memória ou Redis/BullMQ obrigatório.
- **Consequências:** Consistência transacional com o banco principal e simplicidade operacional.
- **Como validar:** Testes de retry, falha de provedor, concorrência, recuperação de job travado e exclusão durante processamento.

## DA-006 — Armazenamento privado de arquivos com abstração Local / S3
- **ID:** DA-006
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** Arquivos enviados pelo usuário nunca devem ficar em diretórios públicos nem ser acessíveis sem verificação de autorização no servidor.
- **Decisão:** Criar a interface `StorageProvider` com implementação `LocalFilesystemStorage` gravando fora de `public/` (em `.data/storage`) e adaptador `S3CompatibleStorage`, validando tamanho máximo, MIME/assinatura mágica e hash SHA-256, servindo arquivos exclusivamente via rota autenticada `/api/assets/[id]`.
- **Alternativas consideradas:** Salvar uploads em `public/uploads`.
- **Consequências:** Proteção contra IDOR e acesso direto não autorizado.
- **Como validar:** Testes de upload, verificação de hash, bloqueio de formatos/tamanhos inválidos e bloqueio de download por outro usuário.

## DA-007 — Camada de provedores de IA isolada e RAG com validação estrita de citações
- **ID:** DA-007
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** O assistente deve responder apenas com base em fontes autorizadas do usuário, validar citações no servidor, resistir a prompt injection e continuar operando mesmo sem chave de API comercial.
- **Decisão:** Separar adaptadores (`OpenAIProvider`, `OllamaProvider`, `ExtractiveLocalProvider`), isolar trechos recuperados como dados não confiáveis, higienizar instruções maliciosas, exigir referências a IDs reais de chunks recuperados e rejeitar no servidor qualquer citação inventada ou fora do escopo autorizado.
- **Alternativas consideradas:** Confiar nas URLs/citações geradas livremente pelo LLM.
- **Consequências:** Zero alucinação de fontes/links, proteção contra prompt injection e controle de orçamento de tokens por usuário.
- **Como validar:** Testes automatizados de perguntas respondíveis, sem contexto, fontes conflitantes, citações forjadas, falha de provedor e prompt injection.

## DA-008 — Autenticação própria segura no servidor (Scrypt + Sessões HttpOnly no Banco)
- **ID:** DA-008
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** Necessidade de autenticação auditável, sem dependências instáveis, com hash forte de senha, cookies seguros, expiração, invalidação no logout e tokens de redefinição de uso único.
- **Decisão:** Implementar autenticação server-side utilizando `crypto.scrypt` com salt aleatório de 16 bytes e comparação em tempo constante (`timingSafeEqual`), sessões persistidas em banco com token opaco armazenado como hash SHA-256, cookie `HttpOnly`/`SameSite=Lax`/`Secure` e tokens de recuperação de senha de uso único com expiração e rate limiting.
- **Alternativas consideradas:** JWT stateless sem revogação imediata no servidor.
- **Consequências:** Logout e revogação de sessão têm efeito imediato no servidor.
- **Como validar:** Testes de cadastro, login, sessão expirada, logout, uso único de token de reset e isolamento entre usuários.

## DA-009 — Proteção anti-SSRF multi-camada na captura de links
- **ID:** DA-009
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** A captura de URLs fornecidas pelo usuário é vetor clássico de SSRF contra loopback, rede privada e serviços de metadata em nuvem.
- **Decisão:** Validar protocolo (`http:`/`https:`), bloquear hostnames locais e faixas IP privadas/reservadas (IPv4 e IPv6), resolver todos os registros DNS antes da conexão e seguir redirecionamentos manualmente revalidando URL e resolução DNS em cada salto, com limite de tamanho e timeout.
- **Alternativas consideradas:** Validar apenas a string da URL inicial.
- **Consequências:** Prevenção contra bypass por redirecionamento HTTP ou resolução DNS para IP interno.
- **Como validar:** Testes unitários e de integração de SSRF com IPs privados, loopback, link-local (`169.254.169.254`), redirecionamentos maliciosos e protocolos proibidos.

## DA-010 — Independência de código e licença
- **ID:** DA-010
- **Data:** 2026-10-28
- **Estado:** aceita
- **Contexto:** O projeto Karakeep utiliza licença AGPL-3.0.
- **Decisão:** Implementação 100% independente em código, schema, prompts, interface e documentação, sem copiar código-fonte ou elementos visuais do projeto de referência.
- **Alternativas consideradas:** Fork direto do Karakeep.
- **Consequências:** Controle total sobre arquitetura PostgreSQL e ausência de contaminação de licença.
- **Como validar:** Auditoria dos arquivos criados no repositório.
