# Arquitetura geral

## Componentes conceituais

1. **Aplicação web:** interface, validação de entrada e interação.
2. **Camada de aplicação/API:** casos de uso, autorização, regras de negócio e transações.
3. **PostgreSQL:** fonte de verdade para contas, itens, relações, estados e metadados.
4. **Armazenamento de arquivos:** binários privados, separados do banco quando apropriado.
5. **Fila persistente:** trabalhos demorados e retentativas.
6. **Worker:** extração, OCR, geração de resumos/etiquetas, embeddings e manutenção de índices.
7. **Camada de provedores de IA:** adaptadores para modelos comerciais ou locais.
8. **Mecanismo de busca:** pesquisa textual inicial; extensão vetorial/híbrida após validação.
9. **Observabilidade:** logs estruturados, métricas, alertas e rastreamento de jobs.

## Fluxo de captura

Navegador/usuário → API autenticada → validação e autorização → registro do item → job persistido → worker → extração e armazenamento → indexação → estado atualizado → interface.

O item original deve ser persistido antes do trabalho demorado sempre que possível. Uma falha de worker não deve perder a captura.

## Limites de responsabilidade
- Interface não decide autorização.
- Worker não confia em IDs recebidos sem verificar existência e escopo.
- Provedor de IA não recebe dados além do necessário para a tarefa.
- Pesquisa é derivada; banco principal é a fonte de verdade.
- Índices podem ser reconstruídos a partir de dados persistidos.
- Jobs precisam de idempotência, timeout e limite de tentativas.

## Princípios operacionais
- Separar processamento pesado de requisições web.
- Usar transações para mudanças relacionadas.
- Definir timeout e limites de memória para conteúdo externo.
- Tornar falhas e dependências externas observáveis.
- Evitar microserviços prematuros.
- Manter instruções de deploy, migração e rollback.

## Pendente antes do bootstrap
- versões atuais e compatíveis das dependências;
- autenticação;
- biblioteca de jobs;
- armazenamento de arquivos;
- limites de upload;
- provedor inicial de IA;
- plano de hospedagem e custo.
