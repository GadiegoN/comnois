# Respostas com fontes verificáveis

## Contrato de resposta
Uma resposta fundamentada deve incluir:
- texto da resposta;
- lista de fontes realmente recuperadas;
- vínculo entre afirmações e fontes, quando possível;
- trechos citados;
- aviso de insuficiência quando as evidências não sustentarem uma resposta.

## Fluxo de recuperação
1. Validar identidade e escopo.
2. Recuperar documentos autorizados.
3. Selecionar trechos relevantes.
4. Remover duplicatas e controlar diversidade das fontes.
5. Montar contexto com identificadores internos não forjáveis pelo modelo.
6. Pedir resposta em formato estruturado.
7. Validar que cada citação corresponde a um trecho realmente fornecido.
8. Renderizar links usando dados do banco, não URLs inventadas pelo modelo.

## Proteção contra citações falsas
- O modelo não é a fonte de verdade para IDs, títulos ou URLs.
- A aplicação deve mapear IDs de citação aos resultados reais da recuperação.
- Citações inexistentes devem ser rejeitadas.
- Se a validação falhar, tentar corrigir uma vez ou retornar erro controlado.
- Exibir trechos curtos e suficientes para conferência.

## Limitações transparentes
- Informar quando nenhum conteúdo relevante foi encontrado.
- Distinguir ausência de evidência de evidência de ausência.
- Indicar se a pesquisa foi limitada por filtros, período ou quantidade de resultados.
- Não alegar leitura completa de todos os documentos quando apenas chunks foram recuperados.

## Avaliação
Criar casos de teste com:
- resposta direta presente em uma fonte;
- resposta distribuída por várias fontes;
- fontes conflitantes;
- pergunta sem resposta;
- conteúdo malicioso tentando alterar as instruções;
- fonte excluída ou sem permissão;
- provedor indisponível.
