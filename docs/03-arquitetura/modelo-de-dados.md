# Modelo de dados conceitual

> Não é um schema SQL definitivo. A implementação deve transformar o modelo em migrações revisáveis e verificar integridade, índices e autorização.

## Entidades principais

### User
- id
- e-mail normalizado e único
- nome de exibição opcional
- timestamps
- status da conta

### Session / AuthAccount
Entidades exigidas pela biblioteca de autenticação escolhida. Não duplicar mecanismos já fornecidos pela biblioteca sem necessidade.

### Workspace (fase posterior)
- id
- nome
- proprietário
- timestamps

### WorkspaceMember (fase posterior)
- workspace_id
- user_id
- papel
- status do convite/membro

### Item
- id
- owner_id ou workspace_id
- tipo
- título
- URL original, quando aplicável
- descrição e metadados
- estado de processamento
- estado de arquivamento/favorito
- timestamps
- campos para rastrear origem/importação quando necessário

### ItemContent
- item_id
- texto extraído ou conteúdo da nota, conforme estratégia de armazenamento
- idioma, origem e versão do extrator
- timestamps

### Asset
- id
- item_id
- chave privada de armazenamento
- nome original sanitizado
- MIME detectado
- tamanho e hash
- estado de verificação
- timestamps

### Tag
- id
- escopo/owner
- nome normalizado
- origem manual ou IA, quando aplicável

### ItemTag
- item_id
- tag_id
- origem e timestamps, se necessário

### Collection
- id
- escopo/owner
- nome
- tipo manual/inteligente
- regra estruturada para coleções inteligentes futuras

### CollectionItem
- collection_id
- item_id
- timestamps

### Highlight
- id
- item_id
- trecho e localizador dentro do conteúdo
- nota opcional
- timestamps

### ProcessingJob
- id
- item_id ou entidade alvo
- tipo
- estado
- tentativas
- próxima execução
- erro resumido sem segredos
- timestamps de início/fim

### Embedding (fase semântica)
- id
- item_id
- identificador do trecho/chunk
- versão do modelo
- dimensão e vetor
- hash do texto de origem
- timestamps

### Integration / Webhook (fase futura)
Credenciais armazenadas de forma protegida, escopos, status, assinatura, tentativas e eventos entregues.

### AuditLog (necessidade conforme produto)
Ator, ação, alvo, timestamp e metadados mínimos. Evitar registrar conteúdo sensível.

## Relações e integridade
- Um usuário possui muitos itens privados.
- Um item pode ter várias etiquetas e várias coleções.
- Uma coleção contém vários itens.
- Um item pode ter vários assets e jobs.
- Embeddings são derivados de versões de conteúdo; mudanças no conteúdo invalidam os embeddings antigos.
- Excluir item deve acionar remoção dos dados derivados.
- Workspace e item devem ter escopo inequívoco quando colaboração for implementada.

## Índices e restrições
- E-mail normalizado único.
- Índices para owner/workspace, estado, data e relações de junção.
- Restrições de unicidade para evitar relações duplicadas.
- Hash de arquivo pode ajudar a detectar duplicatas, sem assumir que conteúdo idêntico deve sempre ser fundido.
- Índices de pesquisa precisam ser atualizados de forma consistente ou reconstruível.

## Regras de migração
- Nunca alterar produção manualmente sem migração versionada.
- Para mudanças destrutivas, planejar backfill e janela de compatibilidade.
- Testar migração em banco descartável e verificar integridade das chaves estrangeiras.
