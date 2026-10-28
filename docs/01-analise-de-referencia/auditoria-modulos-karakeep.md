# Auditoria técnica direcionada do Karakeep

**Data:** 2026-10-28  
**Repositório:** `karakeep-app/karakeep`  
**Referência de versão:** releases públicas consultadas até `v0.34.1` e arquivos expostos pela branch `main`.  
**Estado:** auditoria parcial baseada em código-fonte e documentação pública acessíveis via GitHub. Ainda não equivale a clonar o repositório e executar testes localmente. Antes de decisões irreversíveis, registrar SHA exato do commit auditado.

## 1. Resultado executivo

A inspeção aprofundou cinco áreas: persistência, regras de domínio, processamento assíncrono, busca e IA. As conclusões mais úteis para nosso produto são:

1. **O banco relacional é a fonte dos dados de domínio; o índice de busca é uma projeção derivada.** O worker de indexação busca o item e suas relações no banco para construir o documento indexável. Isso orienta nossa arquitetura a permitir reconstruir índices a partir dos dados persistidos.
2. **Jobs devem ser tipados, observáveis e recuperáveis.** O worker de busca valida o payload, mede execução, registra sucesso/falha, limita concorrência e timeout e desativa batching nas tentativas seguintes. Não basta criar uma fila sem política de retry e rastreamento.
3. **Pesquisa textual e semântica têm pré-requisitos diferentes.** O modo textual deve funcionar sem embeddings. Busca semântica depende de modelo de embedding, dimensões compatíveis, geração/indexação e suporte no mecanismo de busca; o modo híbrido precisa de fallback explícito.
4. **Configuração de IA é parte da arquitetura, não só uma variável de ambiente.** Modelos, endpoints compatíveis, dimensões, limites de contexto, timeouts e custos precisam ser validados e observáveis.
5. **Limites e casos de falha precisam fazer parte do produto.** As notas de release documentam correções para paginação, tamanho de conteúdo enviado a prompts, uploads, exclusões durante indexação, timeouts de inferência e falha de workers. Esses casos devem virar testes de aceitação nossos.

## 2. Banco de dados e modelo de domínio

### Evidência observada

- A documentação de desenvolvimento localiza o esquema em `packages/db/schema.ts` e exige migrações ao alterar o modelo. O repositório disponibiliza snapshots do Drizzle com dialeto `sqlite`.
- O snapshot de esquema consultado mostra entidades relacionais como usuários, bookmarks, links, textos, assets, tags, listas e tabelas de associação. Há índices e restrições de unicidade voltados a consultas por usuário e relações entre entidades.
- O código do `SearchIndexingWorker` consulta `bookmarks` e carrega relações de link, texto, asset e tags antes de formar o documento de pesquisa.

Fontes: [guia de migrações](https://github.com/karakeep-app/karakeep/blob/main/docs/versioned_docs/version-v0.29.0/07-development/03-database.md), [snapshot Drizzle](https://github.com/karakeep-app/karakeep/blob/main/packages/db/drizzle/meta/0070_snapshot.json), [worker de indexação](https://github.com/karakeep-app/karakeep/blob/main/apps/workers/workers/searchWorker.ts).

### Implicações para nosso esquema

- Tratar `items`/documentos como entidade central e modelar separadamente conteúdo extraído, arquivos físicos, tags, coleções e segmentos de texto.
- Toda entidade privada precisa ter escopo de proprietário/workspace verificável em operações de leitura, alteração, exclusão, busca e jobs.
- Definir constraints e índices no banco; não depender de validações de interface para integridade.
- A indexação externa deve ser reconstruível. O registro persistido não deve depender de o documento existir no mecanismo de busca.
- Exclusão lógica/física, remoção de arquivos, embeddings e documentos de busca devem ter política explícita e fluxo idempotente.
- Não copiar o esquema de Karakeep. Seu modelo atende ao produto e às escolhas de persistência dele; o nosso modelo deve incluir origem do conteúdo, versões do processamento, chunks e referências verificáveis necessárias ao RAG.

### Pendente de confirmação local

Ainda é necessário ler o `schema.ts` completo e as migrações atuais do commit fixado para documentar cada tabela, FK, índice, política de exclusão e transação. Um snapshot isolado é evidência estrutural, não substitui a revisão do esquema fonte e do histórico de migrações.

## 3. Regras de negócio e API

### Evidência observada

- O monorepo atual descreve pacotes separados para banco, API, tRPC, lógica compartilhada e serviços server-side. A documentação do projeto indica validação de limites de paginação nos endpoints; as notas de release registram uma correção específica para impedir que mover uma lista para dentro de uma sublista descendente crie ciclos problemáticos.
- A CLI oficial documenta filtros estruturados para favoritos, arquivados, tags, listas, tipo de conteúdo, estado de captura, origem e datas. Também distingue operações de listagem e pesquisa.
- O comando de importação tem política explícita para duplicatas (`skip`, `overwrite`, `append` e variantes que reprocessam), o que demonstra que importação e recaptura são fluxos distintos.

Fontes: [AGENTS.md](https://github.com/karakeep-app/karakeep/blob/main/AGENTS.md), [skill oficial e linguagem de consulta](https://github.com/karakeep-app/karakeep/blob/main/skills/SKILL.md), [notas de release](https://github.com/karakeep-app/karakeep/releases).

### Decisões para nosso produto

- A camada de domínio deve validar invariantes mesmo quando a chamada vem da API, worker, importador ou futuro cliente mobile.
- Separar **listar**, **filtrar** e **pesquisar** como operações semânticas diferentes, mesmo que compartilhem componentes internos.
- Definir comportamento explícito de duplicatas e recaptura por origem, em vez de resolver tudo com uma comparação simples de URL.
- Impedir ciclos em relações hierárquicas e validar paginação/limites no servidor.
- Aplicar autorização por usuário/workspace antes de retornar conteúdo, snippets, arquivos ou resultados de busca.

### Pendente

A inspeção disponível não cobre todos os procedimentos de API e serviços de domínio. A próxima auditoria local deve seguir operações representativas de criação, edição, arquivamento, exclusão, tags, coleções e compartilhamento até suas consultas SQL e testes.

## 4. Workers, filas e consistência

### Evidência observada no `searchWorker.ts`

- O worker registra execução e tracing, usa uma fila tipada (`SearchIndexingQueue`) e valida os dados do job com um schema antes de executar.
- A configuração define concorrência, intervalo de polling e timeout.
- Existem callbacks separados para conclusão e falha, métricas para jobs concluídos/falhos e registro de falha permanente quando não restam tentativas.
- A indexação lê novamente o item no banco. Se o item já tiver sido removido, o worker registra aviso e ignora a indexação; isso evita recriar no índice um item inexistente.
- Operações de indexação e exclusão são explícitas. O batching é desligado nas tentativas posteriores para favorecer a confiabilidade.
- Se o mecanismo de busca não estiver configurado, o worker registra o estado e não executa a operação de busca.

Fonte direta: [apps/workers/workers/searchWorker.ts](https://github.com/karakeep-app/karakeep/blob/main/apps/workers/workers/searchWorker.ts). A configuração pública documenta limites separados para concorrência e timeout de diferentes categorias de jobs: [variáveis de ambiente](https://github.com/karakeep-app/karakeep/blob/main/docs/docs/03-configuration/01-environment-variables.md).

### Decisões para nosso produto

- Cada job deve carregar um tipo versionável, identificador da entidade, payload validável e contexto mínimo para rastreamento.
- Jobs devem ser idempotentes: reexecutar extração, chunking ou indexação não pode duplicar segmentos nem gerar associações extras.
- Guardar estados de processamento por etapa (`pending`, `processing`, `succeeded`, `retrying`, `failed`) e uma mensagem de erro segura para diagnóstico.
- Ter retry com limite, backoff, timeout, fila de falhas permanentes e ação manual de reprocessamento.
- Em indexação/exclusão, sempre reler o estado atual do banco; não confiar cegamente em payload antigo da fila.
- Expor na interface se o conteúdo foi salvo mas ainda está sendo processado, falhou parcialmente ou precisa de nova tentativa.
- Escolher a fila concreta só depois de comparar persistência, deploy, custo e comportamento sob reinício. A solução escolhida precisa garantir que o job não desapareça se o processo web cair.

## 5. Pesquisa: índice, filtros e modos

### Evidência observada

- A busca de texto completo é o modo padrão documentado na CLI. Busca semântica utiliza embeddings; busca híbrida combina resultados e pode voltar à busca textual se a consulta contiver apenas filtros ou se a infraestrutura semântica estiver indisponível.
- A pesquisa semântica é descrita como experimental nas notas de release consultadas e depende de embeddings ativados e indexação automática configurada.
- O `SearchIndexingWorker` cria um documento de busca com campos derivados de link, conteúdo de assets/textos, nota, resumo, título, data de criação e tags. Também inclui identificadores do item e do usuário.
- A configuração expõe o endereço do Meilisearch e parâmetros para concorrência/timeout de indexação. A documentação indica que o serviço de busca é uma dependência separada.

Fontes: [skill oficial](https://github.com/karakeep-app/karakeep/blob/main/skills/SKILL.md), [worker de busca](https://github.com/karakeep-app/karakeep/blob/main/apps/workers/workers/searchWorker.ts), [configuração](https://github.com/karakeep-app/karakeep/blob/main/docs/docs/03-configuration/01-environment-variables.md), [release sobre busca semântica](https://github.com/karakeep-app/karakeep/releases).

### Decisões para nosso produto

- Implementar primeiro pesquisa textual confiável, filtros e paginação determinística.
- Criar um contrato interno de busca para permitir trocar ou complementar o mecanismo sem espalhar dependências.
- Tratar índice como projeção derivada e implementar reindexação completa/parcial.
- Não exigir embeddings para salvar, abrir ou pesquisar por texto.
- Liberar modo semântico somente quando modelo, dimensões, custo e qualidade tiverem sido validados com um conjunto de consultas reais.
- Para híbrida, documentar estratégia de fusão/ranking e fallback; não apenas concatenar resultados de duas buscas.
- Criar testes que cubram item excluído durante indexação, atualização concorrente, falha de indexação, duplicidade de jobs, filtros combinados e paginação estável.

## 6. IA, inferência e embeddings

### Evidência observada

- O módulo público `packages/shared/inference.ts` contém adaptadores para inferência e validação do formato de respostas de embeddings, incluindo verificação de arrays numéricos e validação de dimensões.
- As variáveis documentadas separam modelos de texto, imagem e embeddings, endpoint compatível, dimensões esperadas, limite de contexto para embeddings e concorrência de jobs.
- A documentação de busca semântica alerta que mudar modelo ou dimensões após gerar vetores exige regeneração dos embeddings existentes.
- As notas de release registram correções para conteúdo muito longo enviado à tokenização/prompt, timeout de inferência e incompatibilidade de dimensões/formato de embeddings. Isso reforça que respostas de provedor não devem ser consideradas válidas sem checagem.

Fontes: [adaptadores de inferência](https://github.com/karakeep-app/karakeep/blob/main/packages/shared/inference.ts), [configuração de embeddings e workers](https://github.com/karakeep-app/karakeep/blob/main/docs/docs/03-configuration/01-environment-variables.md), [notas de release](https://github.com/karakeep-app/karakeep/releases), [guia de embeddings](https://github.com/karakeep-app/karakeep/discussions/2979).

### Decisões para nosso produto

- Definir interfaces separadas para geração de texto, extração estruturada, visão e embeddings; um provedor pode suportar algumas capacidades e não outras.
- Validar resposta, dimensão, limite de entrada e timeout antes de persistir resultados.
- Registrar provedor/modelo e versão de processamento nos artefatos derivados para permitir auditoria e reprocessamento.
- Não misturar falha de IA com falha de captura: o conteúdo original deve continuar disponível mesmo quando resumo, tags ou embeddings falharem.
- Aplicar limites de custo, tamanho e concorrência por conta/workspace, com opção de desativar IA.
- Tratar o conteúdo importado como dado não confiável, nunca como instruções de sistema. Ao construir RAG, a resposta deve se apoiar em trechos recuperados e autorizados, com citações que o servidor consegue validar.
- Antes de regenerar embeddings, exigir compatibilidade do modelo/dimensão e apresentar o impacto de custo/tempo.

## 7. Decisões técnicas preliminares para nossa plataforma

| Tema | Decisão proposta | Motivo | Estado |
|---|---|---|---|
| Fonte da verdade | PostgreSQL guarda entidades e conteúdo normalizado; índice é derivado | Recuperação, transações e reindexação | Proposta forte |
| Busca inicial | Full-text + filtros no PostgreSQL | Reduz serviços obrigatórios no início | Validar com dataset de teste |
| Busca externa | Abstração para índice dedicado se houver necessidade medida | Separar domínio de implementação de busca | Pendente de benchmark |
| Vetores | Não obrigatórios na primeira entrega; avaliar pgvector após baseline textual | Evita complexidade/custo prematuros | Pendente |
| Jobs | Worker separado e fila persistente com retries/timeout | Tarefas longas e reinício seguro | Obrigatório; tecnologia pendente |
| Pipeline | Extração, normalização, chunking, indexação e IA como etapas independentes | Falhas isoladas e reprocessamento | Proposta forte |
| Observabilidade | Estado por etapa, logs estruturados e métricas de falha/latência | Suporte e diagnóstico | Obrigatório |
| IA | Adaptadores por capacidade, configuração validada e limites | Provedores variam em formatos/custos | Obrigatório |
| Citações RAG | Guardar origem e offsets/trechos recuperados; validar permissões no servidor | Evitar fontes inventadas ou vazamento entre usuários | Obrigatório |

Estas são decisões para nossa arquitetura, não afirmações de que Karakeep usa a mesma estrutura ou tem as mesmas necessidades.

## 8. Matriz de confiança e pendências

| Área | Evidência consultada | Confiança atual | O que falta para fechar |
|---|---|---|---|
| Banco | documentação de migrações, snapshot Drizzle e uso do schema no worker | Média | Ler schema fonte e migrações do commit fixado; revisar constraints/transações |
| Regras/API | estrutura do monorepo, skill CLI, notas de release | Média | Traçar operações de domínio e autorização no código/testes |
| Workers | código do worker de indexação e configuração de workers | Alta para indexação; baixa para demais jobs | Revisar todos os workers, configuração de fila, retries e encerramento do processo |
| Busca | worker, linguagem de consulta e docs de busca semântica | Alta para pipeline de indexação e modos documentados | Auditar cliente do índice, ranking, exclusão e sincronização end-to-end |
| IA | adaptadores de inferência, variáveis e notas de release | Média | Inspecionar workers de tagging/sumarização/OCR e seus prompts/testes |
| Segurança | notas de release e requisitos gerais | Parcial | Revisar autorização, SSRF do crawler, arquivos, logs e ameaças de prompt injection no código |
| Licença | README e metadados do repositório | Alta para licença declarada | Revisar avisos/dependências e consultar assessoria jurídica se houver reutilização |

## 9. Próxima etapa de auditoria local

Para encerrar a auditoria antes de implementar:

1. Clonar o repositório oficial, registrar SHA e versão/tag.
2. Ler `packages/db/schema.ts` e migrações na ordem; produzir mapa das entidades e relações.
3. Seguir os procedimentos de API que criam/alteram/excluem itens até o banco e a fila.
4. Revisar todos os workers em `apps/workers`, o cliente da fila e a política de retries.
5. Seguir o ciclo de busca: alteração no banco → job → documento indexável → cliente de busca → query → exclusão/reindexação.
6. Seguir o ciclo de IA: entrada → normalização → prompt/modelo → validação → persistência → indexação.
7. Executar testes relevantes e registrar evidência observada, não apenas comportamento inferido da documentação.
8. Atualizar `registro-de-decisoes.md` e só então congelar as decisões de banco, busca e fila.

## 10. Fontes principais

- https://github.com/karakeep-app/karakeep/blob/main/packages/db/schema.ts
- https://github.com/karakeep-app/karakeep/blob/main/packages/db/drizzle/meta/0070_snapshot.json
- https://github.com/karakeep-app/karakeep/blob/main/apps/workers/workers/searchWorker.ts
- https://github.com/karakeep-app/karakeep/blob/main/packages/shared/inference.ts
- https://github.com/karakeep-app/karakeep/blob/main/skills/SKILL.md
- https://github.com/karakeep-app/karakeep/blob/main/docs/docs/03-configuration/01-environment-variables.md
- https://github.com/karakeep-app/karakeep/releases
