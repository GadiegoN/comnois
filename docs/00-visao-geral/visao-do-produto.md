# Visão do produto

## 1. Resumo

Criar uma plataforma de conhecimento pessoal e, futuramente, colaborativo, na qual uma pessoa possa guardar links, textos, imagens e documentos, encontrar esses materiais depois e consultar uma IA que responda usando as fontes salvas, com referências que permitam conferir as respostas.

O produto não deve ser apenas uma lista de favoritos nem uma caixa de chat genérica. O valor central é transformar materiais dispersos em uma biblioteca pesquisável, organizada e útil, mantendo o usuário no controle dos seus dados.

## 2. Problema

Informações importantes ficam espalhadas em abas, favoritos do navegador, PDFs, imagens, notas, artigos e ferramentas diferentes. Encontrá-las novamente pode exigir lembrar o nome exato ou refazer a pesquisa. Resumos e respostas gerados por IA podem perder contexto ou não mostrar de onde veio uma afirmação.

## 3. Proposta de valor

- Guardar diferentes tipos de conteúdo em um lugar.
- Capturar conteúdo com o mínimo de atrito.
- Extrair e indexar conteúdo de forma assíncrona, com estados claros.
- Encontrar materiais por texto, filtros e significado.
- Fazer perguntas sobre a própria biblioteca e conferir as fontes.
- Exportar os próprios dados sem ficar preso ao serviço.
- Escolher como a IA é executada, dentro das opções realmente suportadas.

## 4. Público inicial

**PROPOSTA:** pessoas que pesquisam, estudam, trabalham com conhecimento digital ou acumulam referências para projetos. O primeiro uso deve funcionar bem para uma pessoa sozinha. Colaboração entra depois que o fluxo individual estiver confiável.

## 5. Diferenciais pretendidos

1. **Respostas verificáveis:** citações levam ao item e ao trecho usado, e a interface distingue evidência direta de síntese.
2. **Processamento confiável:** itens mostram se estão aguardando, processando, prontos ou com falha; falhas podem ser corrigidas e reprocessadas.
3. **Portabilidade:** exportação de dados e arquivos em formato documentado.
4. **Controle de IA:** provedores configuráveis, possibilidade de desativar recursos de IA e transparência sobre consumo.
5. **Experiência clara:** organização e pesquisa úteis sem exigir que o usuário compreenda embeddings, filas ou modelos.

Esses diferenciais são objetivos de produto, não alegações de que concorrentes não oferecem tais recursos.

## 6. Escopo do produto

### Primeira versão funcional

- Contas e sessões seguras.
- Biblioteca privada por usuário.
- Salvar links e notas; anexar arquivos comuns após definir limites.
- Extração de metadados e conteúdo quando tecnicamente possível.
- Etiquetas, favoritos, arquivamento, filtros e coleções manuais.
- Pesquisa textual e filtros.
- Processamento em segundo plano com estado, erro e nova tentativa.
- Importação/exportação inicial.
- Configurações básicas de conta e privacidade.
- Testes, logs úteis e estratégia de backup.

### Fase seguinte

- Pesquisa semântica e híbrida.
- Assistente com respostas baseadas nas fontes e citações verificáveis.
- Resumos, extração de pontos-chave e sugestões de etiquetas.
- Extensão de navegador, API pública e webhooks.
- Regras e automações configuráveis.

### Fase posterior

- Workspaces compartilhados, convites, funções e permissões.
- Aplicativos móveis e suporte offline, se justificados.
- Serviço hospedado gerenciado e recursos pagos.
- Integrações adicionais baseadas em demanda validada.

## 7. Fora do escopo inicial

- Prometer captura perfeita de qualquer site.
- Treinar um modelo de linguagem próprio.
- Construir simultaneamente aplicações web, mobile e extensões completas.
- Garantir que toda resposta de IA seja correta.
- Abrir uma biblioteca privada a mecanismos de busca públicos.
- Cobrar por recursos antes de existir uma operação confiável e um modelo de custos.

## 8. Indicadores de sucesso

- Percentual de itens capturados que chegam a estado utilizável.
- Tempo entre captura e disponibilidade para pesquisa.
- Taxa de falhas de processamento e sucesso após nova tentativa.
- Sucesso das tarefas de pesquisa em testes com usuários.
- Percentual de respostas do assistente cujas citações abrem trechos relevantes.
- Exportações concluídas e restauráveis.
- Custo médio de processamento por item e por usuário ativo.
- Incidentes de autorização ou vazamento: meta zero.

## 9. Referência

Karakeep é referência funcional para estudar fluxos e decisões, não uma especificação a copiar cegamente. O produto deve ter identidade, código, experiência, documentação e decisões próprias. Ver `01-analise-de-referencia/karakeep.md`.
