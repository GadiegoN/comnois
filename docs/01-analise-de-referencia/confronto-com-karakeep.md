# Confronto funcional e técnico com Karakeep

**Data da consulta:** 2026-10-28  
**Referência:** `karakeep-app/karakeep`, documentação pública e branch `main`.  
**Limite:** esta é uma análise documental de alto nível, não uma auditoria linha a linha. A branch `main` muda; antes da auditoria de código, registre o commit SHA do clone analisado.

## 1. Resumo executivo

Karakeep é um produto maduro de captura e organização de informações. Seu README documenta links, notas, imagens e PDFs; metadados automáticos; listas e colaboração; busca textual e semântica; etiquetas e resumos por LLM; OCR; extensões de navegador; apps móveis; leitura offline; RSS; REST API; destaques; arquivamento de páginas; vídeo; ações em lote; SSO e importadores. A disponibilidade e o comportamento exato devem ser confirmados na versão analisada.

A estrutura separa aplicação web, workers, mobile, extensão de navegador e landing page, com pacotes compartilhados para banco, lógica de negócio, código comum, serviços server-side e armazenamento. Para nossa plataforma, a biblioteca e a captura são a base; os diferenciais pretendidos são citações de IA verificáveis, transparência sobre evidências, portabilidade testável, processamento recuperável e controle dos provedores de IA. São metas nossas, não afirmações de que Karakeep não tenha recursos relacionados.

## 2. Módulos documentados

| Caminho | Responsabilidade documentada | Aprendizado para nosso produto |
|---|---|---|
| `apps/web` | Aplicação web principal | Começar pela experiência web e seus fluxos essenciais |
| `apps/workers` | Processamento em segundo plano | Não executar extração pesada dentro da requisição web |
| `apps/mobile` | App React Native | Adiar app móvel até estabilizar o domínio principal |
| `apps/browser-extension` | Extensão de navegador | Tratar captura do navegador como cliente futuro independente |
| `apps/landing` | Site público | Separar marketing do fluxo principal da aplicação |
| `packages/db` | Esquema e migrações | Versionar mudanças de dados e testar integridade |
| `packages/trpc` | Rotas/procedimentos de negócio | Organizar validação e lógica de domínio de forma reutilizável |
| `packages/shared` | Código comum, logs e configurações | Evitar duplicação entre clientes |
| `packages/shared-server` | Serviços server-side, filas e assets | Manter segredos e operações privilegiadas no servidor |
| `packages/plugins` | Armazenamento plugável, incluindo filesystem e S3 | Abstrair armazenamento sem espalhar dependências |

O repositório também contém documentação, tooling, scripts e arquivos de implantação. A tabela descreve os módulos listados na documentação, não todos os arquivos e chamadas internas.

## 3. Arquitetura documentada

A documentação pública descreve:
1. aplicação web Next.js;
2. SQLite como banco de dados;
3. fila de jobs baseada em SQLite;
4. workers para captura/crawling, inferência de etiquetas por IA e indexação;
5. Meilisearch para pesquisa;
6. navegador headless usado pelos workers para capturar páginas.

O guia de desenvolvimento informa que a pesquisa não funciona sem Meilisearch e que itens novos não passam pelo fluxo completo de captura/indexação se os workers não estiverem ativos. Isso destaca uma regra importante para nós: dependências indisponíveis devem gerar estados e mensagens explícitas.

O README consultado lista Next.js App Router, Drizzle ORM, Better Auth, tRPC, Puppeteer, OpenAI e Meilisearch. Confirmar versões e implementações nos arquivos reais do commit escolhido.

**Correção importante:** não atribuir PostgreSQL + pgvector ao Karakeep. A arquitetura pública consultada descreve SQLite e Meilisearch. PostgreSQL e pgvector são opções propostas para nosso produto e precisam ser validadas por custo, hospedagem e requisitos.

## 4. Matriz funcional

| Área | Karakeep documenta | Plano da nossa plataforma | Decisão |
|---|---|---|---|
| Links, notas e arquivos | Sim | Sim | Fundamental |
| Metadados automáticos | Sim | Sim | Falha de extração não pode perder o item |
| Etiquetas por IA e resumos | Sim | Sim, configuráveis | Não sobrescrever dados manuais silenciosamente |
| Pesquisa textual | Sim | Sim | Implementar primeiro |
| Pesquisa semântica | Sim | Planejada | Validar depois da pesquisa textual |
| Listas e colaboração | Sim | Coleções pessoais primeiro; workspaces depois | Evitar permissões complexas cedo demais |
| OCR | Sim | Planejado | Definir formatos, idiomas e custos |
| Extensão e apps móveis | Sim | Futuro | Web responsiva primeiro |
| RSS, API, webhooks e regras | Recursos documentados | Futuro | Priorizar pela demanda real |
| Importação | Vários importadores documentados | Importação/exportação documentada | Portabilidade testável |
| Assistente com citações verificadas | Há recursos de IA e pesquisa; detalhes precisam de inspeção | Requisito específico nosso | Validar cada citação no servidor |
| Hospedagem gerenciada | Existe opção cloud documentada | Possibilidade futura | Não assumir receita antes de validar custos |

## 5. O que aprender sem copiar cegamente

### Decisões que valem investigar
- separar tarefas lentas do fluxo web;
- tornar o armazenamento substituível;
- compartilhar tipos e lógica entre clientes;
- permitir reindexação quando o índice estiver fora de sincronia;
- documentar instalação própria e operação;
- tratar extensão e mobile como clientes do mesmo domínio.

### Questões que nosso projeto deve responder explicitamente
- O que acontece quando a captura funciona, mas a extração falha?
- Como detectar jobs presos e repetir tarefas sem duplicar resultados?
- Como manter banco e índice sincronizados?
- Como excluir conteúdo derivado e arquivos?
- Como impedir que conteúdo externo controle as instruções do assistente?
- Como garantir que citações apontem para trechos realmente recuperados e autorizados?
- Como mostrar custos e indisponibilidade de serviços externos?

Não concluir que Karakeep falha nesses pontos sem examinar seu código e seus testes. São perguntas da nossa auditoria e requisitos a validar.

## 6. Arquitetura proposta para nosso produto

- **Web:** Next.js App Router, React e TypeScript.
- **UI:** Tailwind CSS e shadcn/ui, após confirmar compatibilidade das versões escolhidas.
- **Banco:** PostgreSQL com Drizzle, proposta a validar.
- **Busca inicial:** pesquisa textual do PostgreSQL e filtros.
- **Busca semântica:** avaliar pgvector quando houver dataset de teste e necessidade confirmada.
- **Jobs:** fila persistente e worker separado; escolher implementação após comparar recuperação, concorrência e simplicidade de deploy.
- **Arquivos:** armazenamento privado abstraído; filesystem no desenvolvimento e opção S3 compatível em produção.
- **IA:** adaptadores com capacidades e limites explícitos.
- **Clientes futuros:** extensão, API pública e mobile após estabilizar os fluxos principais.

Não adicionar todos os serviços de uma vez. A primeira entrega deve ter biblioteca confiável, processamento rastreável, pesquisa textual e portabilidade. Pesquisa vetorial e assistente entram depois com critérios de avaliação.

## 7. Auditoria de código ainda necessária

A análise técnica direcionada posterior, com evidências de arquivos de código e decisões preliminares, está em [`auditoria-modulos-karakeep.md`](./auditoria-modulos-karakeep.md).

Antes de congelar a arquitetura, clonar o repositório e registrar o commit SHA. Investigar:

1. `package.json`, `pnpm-workspace.yaml`, `turbo.json` e lockfile: ferramentas e versões.
2. `packages/db`: tabelas, relações, índices, migrações, exclusão e tipos de itens.
3. `packages/trpc`: operações, validações, autorização e limites.
4. `packages/shared-server`: fila, armazenamento e fronteiras de confiança.
5. `apps/workers`: tipos de job, idempotência, retry, timeout e logs.
6. `apps/web`: biblioteca, busca, configurações, autenticação e estados de erro.
7. `packages/plugins`: contrato de armazenamento e seleção de backend.
8. Busca: indexação, remoção, reindexação, filtros e indisponibilidade.
9. IA: prompts, modelos, Ollama/provedores, resumos, etiquetas, limites e erros.
10. Importação/exportação: formatos, campos preservados, duplicatas e falhas parciais.
11. Extensão/mobile/CLI/MCP: autenticação, chamadas API e captura.
12. Testes e CI: autorização, processamento, pesquisa e migrações.
13. Docker/deploy: serviços, volumes, variáveis e restauração.
14. `LICENSE`, avisos e dependências: obrigações de licença.

Para cada ponto, registrar caminho, função, fluxo observado, evidência no código, lição para nosso produto e confiança. Não preencher por inferência quando o arquivo não foi inspecionado.

## 8. Licença e independência

O repositório informa licença AGPL-3.0. Antes de reutilizar código, revisar os efeitos da licença para distribuição e disponibilização pela rede, além das licenças das dependências. A abordagem padrão é implementação independente, com identidade, textos, código e documentação próprios. Isso não substitui revisão jurídica de licença.

## 9. Fontes consultadas

- Repositório: https://github.com/karakeep-app/karakeep
- README/stack: https://github.com/karakeep-app/karakeep#readme
- Estrutura: https://docs.karakeep.com/development/directories/
- Arquitetura: https://docs.karakeep.com/development/architecture/
- Guia de desenvolvimento: https://docs.karakeep.com/development/setup/
- `AGENTS.md`: https://github.com/karakeep-app/karakeep/blob/main/AGENTS.md

**Limite deste relatório:** fontes públicas consultadas em 2026-10-28. A documentação aberta identifica v0.34.0, enquanto `main` pode ter evoluído. Fixar commit e verificar arquivos reais antes de afirmar conclusões de auditoria linha a linha.
