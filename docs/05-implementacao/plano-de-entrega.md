# Plano de implementação

Este plano evita construir todas as integrações ao mesmo tempo, mas exige que cada etapa entregue comportamento real, testável e documentado.

## Etapa 0 — reconhecimento e decisões
- Inspecionar a versão atual do Karakeep e registrar commit, estrutura e fluxos relevantes.
- Confirmar stack, autenticação, jobs, armazenamento, hospedagem e licença do nosso produto.
- Criar repositório, convenções, variáveis de ambiente de exemplo e comandos de desenvolvimento.
- Registrar decisões aceitas.

**Concluída quando:** o projeto inicializa localmente, as decisões essenciais estão registradas e o caminho de deploy é conhecido.

## Etapa 1 — base segura
- Autenticação.
- Banco e migrações.
- autorização no servidor;
- layout responsivo e navegação;
- biblioteca privada;
- testes de acesso cruzado.

**Concluída quando:** dois usuários de teste não conseguem acessar os dados um do outro e o fluxo principal passa nos testes.

## Etapa 2 — captura e biblioteca
- Salvar link, nota e tipos de arquivo definidos.
- Detalhe do item.
- Etiquetas, favoritos, arquivamento, exclusão.
- Estados de processamento.
- Upload privado e limites.

**Concluída quando:** itens podem ser criados, consultados, editados, arquivados e excluídos com comportamento consistente.

## Etapa 3 — processamento e pesquisa textual
- Fila persistente e worker.
- Extração de metadados/conteúdo.
- Retries e reprocessamento.
- Indexação textual.
- Filtros e coleções manuais.
- Logs e métricas de jobs.

**Concluída quando:** uma falha não perde o item, os jobs podem ser recuperados e alterações refletem na pesquisa.

## Etapa 4 — portabilidade e robustez
- Importação e exportação.
- Backup e restauração testados.
- Testes de segurança para upload, autorização, XSS e SSRF.
- Documentação de operação.

**Concluída quando:** dados podem ser exportados e restaurados e os principais riscos foram testados.

## Etapa 5 — pesquisa semântica e assistente
- Dataset de avaliação.
- Chunking e embeddings.
- Recuperação híbrida.
- Respostas com citações validadas.
- Provedores e limites de consumo.
- Testes de prompt injection e ausência de evidência.

**Concluída quando:** as citações são verificadas pela aplicação e o assistente falha com segurança quando não há evidência ou provedor.

## Etapa 6 — extensibilidade
- API pública e tokens com escopos.
- Webhooks assinados.
- Extensão de navegador.
- Regras e automações.
- Integrações priorizadas por demanda.

## Etapa 7 — colaboração e serviço hospedado
- Workspaces, convites, papéis e auditoria.
- Limites por plano.
- Gestão de armazenamento e custos.
- Operação, suporte e política de retenção.
- Avaliação de licença e termos.

## Regra de progresso
Não marcar etapa como concluída apenas porque a tela existe. Exigir persistência real, estados de erro, autorização, testes e documentação pertinente.
