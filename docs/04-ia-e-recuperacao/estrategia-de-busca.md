# Estratégia de busca

## Etapa 1 — pesquisa textual
Usar pesquisa textual e filtros do banco para encontrar termos, títulos, domínios, etiquetas e conteúdo extraído. É mais simples de operar e não exige embeddings.

## Etapa 2 — pesquisa semântica
Quando houver necessidade validada, dividir o conteúdo em trechos e gerar embeddings. Cada vetor precisa estar associado ao item, trecho, versão do conteúdo e modelo utilizado.

## Etapa 3 — pesquisa híbrida
Combinar resultados lexicais e semânticos. Uma estratégia possível é Reciprocal Rank Fusion (RRF), mas parâmetros devem ser avaliados com um conjunto de consultas reais e exemplos relevantes.

## Requisitos
- Restringir resultados ao escopo autorizado antes de montar contexto.
- Remover resultados de itens excluídos ou cujo conteúdo mudou.
- Versionar modelo de embedding e estratégia de chunking.
- Regerar embeddings quando o conteúdo ou modelo mudar.
- Definir limites de trechos e tokens por consulta.
- Evitar que documentos muito longos dominem todos os resultados.
- Oferecer filtros e ordenação quando úteis.
- Não prometer que similaridade semântica equivale a verdade.

## Avaliação
Manter conjunto de teste com perguntas e itens relevantes esperados. Medir recall dos documentos relevantes, precisão dos primeiros resultados, latência e custo. Testar consultas curtas, nomes próprios, siglas, erros de digitação e conteúdo em português.

## Escolha tecnológica
PostgreSQL full-text é a proposta inicial. pgvector pode ser avaliado para vetores. Um serviço de busca separado só deve ser introduzido se requisitos de qualidade, escala ou operação justificarem a complexidade.
