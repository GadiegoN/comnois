# Análise da referência: Karakeep

A análise detalhada dos módulos, arquitetura, matriz funcional, recomendações e auditoria pendente está em [`confronto-com-karakeep.md`](./confronto-com-karakeep.md).

## Resumo confirmado

Karakeep documenta captura de links, notas, imagens e PDFs; metadados automáticos; listas e colaboração; busca textual e semântica; etiquetas e resumos por LLM; OCR; extensões; apps móveis; leitura offline; RSS; API; destaques; arquivamento de páginas; vídeo; ações em lote; SSO e importadores. A disponibilidade e os detalhes de cada recurso devem ser verificados na versão analisada.

A estrutura documentada inclui `apps/web`, `apps/workers`, `apps/mobile`, `apps/browser-extension`, `apps/landing` e pacotes compartilhados para banco, lógica tRPC, código comum, serviços server-side e plugins de armazenamento.

A arquitetura pública consultada descreve Next.js, SQLite, fila de tarefas baseada em SQLite, workers para crawling/IA/indexação e Meilisearch para pesquisa. **PostgreSQL + pgvector é uma opção proposta para nosso produto, não a arquitetura documentada do Karakeep.**

## Fontes
- https://github.com/karakeep-app/karakeep
- https://docs.karakeep.com/development/directories/
- https://docs.karakeep.com/development/architecture/
- https://docs.karakeep.com/development/setup/
- https://github.com/karakeep-app/karakeep/blob/main/AGENTS.md

O repositório informa licença AGPL-3.0. Antes de reutilizar código, revisar as obrigações da licença e das dependências. A abordagem padrão é construir uma implementação independente.
