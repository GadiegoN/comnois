# Processamento em segundo plano

## Objetivo
Executar tarefas lentas sem bloquear a interface e sem perder o item original.

## Pipeline proposto
1. Criar item e registrar job.
2. Validar e obter conteúdo permitido.
3. Extrair metadados e texto.
4. Normalizar e sanitizar conteúdo.
5. Detectar idioma quando necessário.
6. Persistir conteúdo extraído e versão do extrator.
7. Atualizar pesquisa textual.
8. Opcionalmente executar OCR, resumo, etiquetas ou embeddings.
9. Atualizar estado final e métricas.

## Jobs possíveis
- `fetch_metadata`
- `extract_text`
- `ocr_asset`
- `index_text`
- `generate_summary`
- `suggest_tags`
- `create_embeddings`
- `delete_derived_data`
- `import_batch`
- `export_batch`

A implementação pode usar nomes diferentes, mas cada tarefa deve ter finalidade e entrada/saída explícitas.

## Requisitos da fila
- Persistência antes de confirmar que o job foi aceito.
- Estados claros: aguardando, em execução, concluído, falhou, cancelado.
- Tentativas limitadas com atraso progressivo para falhas transitórias.
- Erros permanentes não devem repetir indefinidamente.
- Timeout por tipo de tarefa.
- Idempotência: repetir um job não duplica efeitos.
- Possibilidade de reprocessar manualmente quando permitido.
- Jobs órfãos ou travados devem ser detectáveis e recuperáveis.
- Concorrência limitada para proteger CPU, memória, banco e serviços externos.

## Falhas e estado do item
O item original deve continuar disponível quando a extração falhar. A interface deve apresentar uma explicação útil e uma ação possível, não um stack trace.

## Segurança de captura web
- Permitir somente protocolos aprovados.
- Bloquear loopback, redes privadas, link-local e destinos internos.
- Revalidar DNS e destino após redirecionamentos.
- Limitar redirecionamentos, bytes, duração e tipo de conteúdo.
- Não enviar cookies/sessões do usuário para destinos arbitrários.
- Executar navegador headless em ambiente isolado e com recursos limitados.
- Não executar scripts baixados no contexto da aplicação.
- Revalidar todo redirecionamento contra SSRF.

## Operação
Métricas mínimas: tamanho da fila, idade do job mais antigo, taxa de sucesso/falha, duração por tipo e tentativas. Alarmes devem sinalizar fila parada e aumento de erros.
