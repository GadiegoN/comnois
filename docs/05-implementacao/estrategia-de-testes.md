# Estratégia de testes

## Unitários
- validações e normalização;
- regras de duplicidade;
- transições de estado de jobs;
- divisão de conteúdo e validação de citações;
- autorização em funções de domínio.

## Integração
- banco e migrações;
- criação/edição/exclusão de itens;
- atualização de pesquisa;
- fila, retries e idempotência;
- armazenamento de arquivos;
- importação e exportação.

## Ponta a ponta
- cadastro/login/logout;
- captura de link e nota;
- falha de extração e reprocessamento;
- filtros e coleções;
- exclusão e confirmação;
- assistente com fontes, quando implementado.

## Segurança
- acesso cruzado entre usuários/workspaces;
- IDs manipulados;
- XSS em títulos, metadados e HTML;
- SSRF por URL e redirecionamentos;
- arquivos inválidos ou grandes;
- abuso de endpoints custosos;
- prompt injection em conteúdo recuperado;
- citações falsas ou fontes inacessíveis.

## Operação
- worker parado;
- provedor indisponível;
- job travado;
- falha de migração;
- backup e restauração;
- exportação interrompida.

## Dados de teste
Usar conteúdo sintético ou público permitido. Não inserir segredos nem conteúdo privado real em fixtures compartilhadas.
