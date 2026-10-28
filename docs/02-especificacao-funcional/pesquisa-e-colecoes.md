# Especificação funcional — pesquisa e coleções

## Pesquisa
A pesquisa deve localizar itens dentro do escopo autorizado do usuário/workspace. A versão inicial suporta texto e filtros; pesquisa semântica entra quando o pipeline de embeddings estiver pronto.

## Filtros propostos
- Tipo de item.
- Etiquetas.
- Coleção.
- Favoritos.
- Arquivados/ativos.
- Estado do processamento.
- Intervalo de datas, se útil e implementado.

Os filtros combinados usam regra consistente e visível. Por padrão, filtros de categorias diferentes combinam-se com AND; múltiplas etiquetas podem usar comportamento configurável e documentado.

## Ordenação
- Mais recentes.
- Mais antigos.
- Atualizados recentemente.
- Relevância quando houver consulta textual.

A ordenação por relevância não deve ser exibida quando não existe consulta ou quando o mecanismo não fornece uma pontuação significativa.

## Coleções
- Criar, renomear e excluir coleção.
- Adicionar/remover itens.
- Um item pode pertencer a várias coleções.
- Excluir coleção não exclui os itens.
- Coleções inteligentes são futuras; devem ter regras visíveis e resultados recalculáveis.

## Etiquetas
- Criar, renomear e remover etiquetas.
- Associar várias etiquetas ao item.
- Remover uma etiqueta não exclui o item.
- Etiquetas sugeridas por IA devem ser identificadas como sugestões e nunca substituir silenciosamente as etiquetas manuais.

## Critérios de aceitação
- A pesquisa respeita autorização e filtros.
- Atualizar ou excluir um item atualiza os índices aplicáveis.
- A interface diferencia “nenhum resultado” de “pesquisa indisponível”.
- Filtros ativos podem ser removidos individualmente e limpos em conjunto.
- Resultados paginados não se repetem por erro de paginação.
