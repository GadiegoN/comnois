# Comnois — Plataforma Inteligente de Conhecimento

Plataforma pessoal e colaborativa de gestão de conhecimento para capturar, preservar, organizar, pesquisar e consultar links, notas, PDFs e imagens com auxílio de IA e **citações verificáveis no servidor**.

---

## 1. Principais Capacidades Implementadas

- **Autenticação e Isolamento no Servidor:** cadastro, login, logout com revogação imediata no banco, senhas com hash `scrypt` + salt aleatório, recuperação de senha de uso único, tokens de API (`cmn_...`) e isolamento horizontal estrito por usuário e workspace.
- **Captura e Biblioteca:**
  - **Links:** validação anti-SSRF (bloqueio de IPs privados/loopback/metadata cloud, resolução DNS prévia e revalidação a cada redirecionamento), normalização de URL com detecção de duplicidades e extração assíncrona de título, descrição, texto limpo e HTML sanitizado.
  - **Notas:** criação e edição imediata com indexação síncrona sem depender de serviços externos.
  - **Arquivos e Imagens:** upload privado fora de `public/` com verificação de assinatura binária (magic bytes), limite de tamanho, hash SHA-256 e download protegido via `/api/assets/[id]`.
- **Organização & Automação:** etiquetas manuais e sugeridas por IA (com fluxo de aceitação ou rejeição pelo usuário), coleções manuais e **Coleções Inteligentes (*Smart Collections*)** dinâmicas, favoritos, arquivamento, destaques (*highlights*), ações em lote e regras de automação na captura.
- **Armazenamento Privado Dual (Local & S3/R2/MinIO):** abstração de storage com driver local fora de `public/` e driver remoto `S3CompatibleStorage` assinado com **AWS Signature V4** nativa.
- **Webhooks Assinados & Extensão de Navegador:** disparo de eventos (`item.created`, `item.processed`, `item.deleted`) assinados com **HMAC-SHA256** (`X-Comnois-Signature`), protegidos contra SSRF, além de extensão Chrome/Edge Manifest V3 em `extensions/chrome-capture/`.
- **Observabilidade, Integridade de Backup e Benchmark RAG:** diagnóstico em `/api/health` que verifica latência do banco, saúde da fila e integridade física dos blobs armazenados, mais motor de benchmark quantitativo de Busca (Lexical, Semântica e Híbrida RRF) e precisão de citações RAG.
- **Fila Persistente e Workers (`processing_jobs`):** estados observáveis (`pending`, `processing`, `retrying`, `succeeded`, `failed`, `cancelled`), retentativas com backoff exponencial, recuperação de tarefas travadas e proteção contra sobrescrita de edições mais recentes (`contentVersion`).
- **Pesquisa Textual, Semântica, Híbrida (RRF) e Query DSL:** busca lexical, busca vetorial e fusão híbrida via *Reciprocal Rank Fusion* ($k = 60$), linguagem de consulta inline (`is:fav`, `is:archived`, `type:link|note|file|image`, `status:completed|failed`, `site:github.com`, `#tag`, `after:YYYY-MM-DD`, `before:YYYY-MM-DD`) e reconstrução integral do índice a partir dos dados persistidos.
- **Assistente de Conhecimento (RAG Verificável):** respostas fundamentadas apenas em trechos autorizados da biblioteca, neutralização de *prompt injection*, indicação de divergências entre fontes e validação estrita de citações (`[CIT-1]`, `[CIT-2]`) no servidor.
- **Assinaturas de Feeds RSS 2.0 e Atom:** captura automática de blogs e fontes técnicas com validação anti-SSRF, desduplicação por URL normalizada e aplicação automática de etiquetas e coleções.
- **Portabilidade Multi-Formato e Prévia Dry-Run:** exportação e importação em formato JSON documentado (`comnois-export-v1`), **Favoritos HTML Netscape** (compatível com Chrome, Firefox, Safari, Edge, Raindrop, Pocket e Karakeep) e **CSV**, além de análise prévia não destrutiva (*Dry-Run Preview*) antes de importar.

---

## 2. Stack Confirmada

- **Web & API:** Next.js 15 App Router (`15.5.28`), React 19 (`19.3.1`), TypeScript estrito (`5.9.3`), Tailwind CSS 4 (`4.3.3`).
- **Banco de Dados & ORM:** PostgreSQL + Drizzle ORM (`0.39.3`) e Drizzle Kit (`0.30.6`). Suporta PostgreSQL externo / Neon (`postgresql://...`) via `pg` e PostgreSQL 16 embarcado (`pglite://...`) via `@electric-sql/pglite`.
- **Segurança & Extração:** `zod` (`3.25.76`), `cheerio` (`1.2.0`), `crypto.scrypt` / `AES-256-GCM` nativos do Node.js.
- **Testes:** Vitest (`3.2.7`).

---

## 3. Instalação e Execução Local

### Pré-requisitos
- Node.js 20+ (testado em `v24.14.0`)
- `pnpm` 9+

### Passo a passo

1. **Instalar dependências:**
   ```bash
   pnpm install
   ```

2. **Configurar variáveis de ambiente:**
   Copie `.env.example` para `.env` (já configurado por padrão para desenvolvimento local):
   ```env
   DATABASE_URL="pglite://.data/pgdata"
   AUTH_SECRET="dev-secret-key-alterar-em-producao-min-32-chars-2026"
   STORAGE_DRIVER="local"
   STORAGE_LOCAL_PATH=".data/storage"
   MAX_UPLOAD_BYTES="26214400"
   AI_DEFAULT_PROVIDER="extractive"
   ```
   > Para usar um servidor PostgreSQL externo ou Neon em produção, defina `DATABASE_URL="postgresql://usuario:senha@host:5432/banco?sslmode=require"`.

3. **Executar migrações do banco de dados:**
   ```bash
   pnpm db:migrate
   ```

4. **Iniciar a aplicação web:**
   ```bash
   pnpm dev
   ```
   Acesse `http://localhost:3000`.

5. **Executar o worker dedicado de processamento em segundo plano (opcional em terminal separado):**
   ```bash
   pnpm worker
   ```
   *(Você também pode acionar lotes da fila diretamente pela aba **Workers** na interface web).*

6. **Self-Hosting em Produção com Docker Compose (PostgreSQL 16 + Web + Worker):**
   ```bash
   docker compose up -d --build
   ```

7. **Utilizar a CLI Oficial (`pnpm cli`):**
   ```bash
   pnpm cli help
   pnpm cli search "is:fav #arquitetura postgres"
   pnpm cli add-note "Resumo Técnico" "Conteúdo da nota indexado imediatamente"
   pnpm cli ask "Quais são os controles contra SSRF documentados?"
   pnpm cli export html > meus-favoritos.html
   pnpm cli health
   ```

---

## 4. Comandos de Validação e Qualidade

- **Executar suíte completa de testes automatizados:**
  ```bash
  pnpm test
  ```
- **Verificar tipos TypeScript:**
  ```bash
  pnpm typecheck
  ```
- **Gerar novas migrações SQL após alterar `src/db/schema.ts`:**
  ```bash
  pnpm db:generate
  ```
- **Compilar para produção:**
  ```bash
  pnpm build
  ```

---

## 5. Operação, Backup e Restauração

1. **Backup consistente:**
   - **Banco PostgreSQL:** utilize `pg_dump --format=custom` (para PostgreSQL externo) ou faça snapshot consistente do diretório `.data/pgdata` (quando utilizando PGlite local com a aplicação parada).
   - **Arquivos privados:** faça backup sincronizado do diretório configurado em `STORAGE_LOCAL_PATH` (`.data/storage`) ou do bucket S3 correspondente.
   - **Portabilidade por usuário:** cada titular pode exportar e reimportar seu acervo completo em JSON pela aba **Portabilidade** ou endpoint `GET /api/portability`.
2. **Reconstrução de índices derivados:**
   - Caso os índices de busca ou embeddings precisem ser recriados após restauração ou troca de modelo de IA, acione **Reconstruir Índice & Vetores** na aba **Workers** (`POST /api/jobs` com `{"action": "reindex"}`).

---

## 6. Documentação do Projeto

Consulte o diretório `docs/` para especificações detalhadas:
- `docs/STATUS-IMPLEMENTACAO.md` — progresso, validações executadas e estado atual.
- `docs/00-visao-geral/registro-de-decisoes.md` — decisões arquiteturais aceitas (`DA-001` a `DA-010`).
- `docs/02-especificacao-funcional/` — requisitos funcionais.
- `docs/03-arquitetura/` — modelo de dados, workers, segurança e observabilidade.
- `docs/04-ia-e-recuperacao/` — busca híbrida, ingestão, citações e provedores de IA.
