# Pipeline de ingestão para pesquisa e RAG

## Fontes
- páginas web;
- notas;
- PDFs;
- imagens com OCR, se suportado;
- outros documentos em formatos explicitamente permitidos.

## Pipeline
1. Guardar a fonte original e seus metadados.
2. Extrair texto com um extrator adequado ao formato.
3. Guardar versão do extrator e estado de extração.
4. Normalizar espaços e caracteres sem destruir a estrutura relevante.
5. Dividir o texto em chunks com limites configuráveis e sobreposição controlada.
6. Associar cada chunk a item, posição, título e localizador.
7. Indexar texto e, quando habilitado, gerar embedding.
8. Guardar hash do texto para detectar conteúdo alterado.
9. Invalidar derivados obsoletos após nova extração.
10. Expor estado e falhas na interface.

## Chunking
- Não dividir indiscriminadamente no meio de tabelas, títulos ou parágrafos quando for possível preservar a estrutura.
- Usar estratégia adequada ao formato.
- Guardar posição inicial/final ou outro localizador que permita abrir a fonte.
- Não gerar chunks vazios.
- Evitar enviar conteúdo inteiro se somente alguns trechos são necessários.

## OCR
OCR pode errar. Quando o texto vier de OCR, identificar sua origem e não tratar texto reconhecido como infalível. Definir formatos, idiomas e limites suportados.

## Atualização e remoção
Se a fonte mudar, regenerar derivados afetados. Se o item for excluído, remover chunks, embeddings e índices de forma consistente. Jobs repetidos devem ser idempotentes.

## Limites
Definir máximo de bytes, páginas, caracteres, tempo de extração, chunks por item e custo máximo por tarefa. O limite real depende da hospedagem e dos provedores escolhidos.
