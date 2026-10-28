# Especificação funcional — biblioteca e captura

## Tipos de item
- **Link:** URL de página web.
- **Nota:** texto escrito diretamente pelo usuário.
- **Arquivo:** arquivo enviado pelo usuário, inicialmente com formatos e tamanhos explicitamente permitidos.
- **Imagem:** pode ser arquivo enviado ou imagem capturada/importada, conforme fluxo implementado.

Cada tipo deve declarar quais operações suporta. Não apresentar ações indisponíveis como se funcionassem.

## Fluxo: salvar link
1. O usuário aciona “Adicionar”.
2. Cola uma URL e confirma.
3. O servidor valida o formato e os protocolos permitidos.
4. O sistema cria um item imediatamente com a URL original.
5. Um job tenta obter metadados e conteúdo.
6. A interface mostra o item e o estado do processamento.
7. Ao concluir, o item passa a ser pesquisável conforme os índices disponíveis.
8. Se a extração falhar, o link continua salvo e o usuário pode abri-lo, ver o erro resumido e tentar novamente.

## Fluxo: criar nota
1. O usuário abre “Nova nota”.
2. Informa título opcional e conteúdo.
3. Salva.
4. O sistema persiste a nota e atualiza a pesquisa.
5. A nota fica disponível sem depender de um serviço externo de extração.

## Fluxo: enviar arquivo
1. O usuário seleciona arquivo permitido.
2. A aplicação valida tamanho, extensão e tipo real quando possível.
3. O arquivo é armazenado em área privada.
4. O item fica visível enquanto extração/OCR, se aplicável, é processado.
5. A interface apresenta sucesso parcial ou falha com ação de recuperação.
6. Download e visualização verificam autorização no servidor.

## Biblioteca
A tela principal oferece:
- lista ou grade de itens;
- busca;
- filtros por tipo, etiqueta, coleção, favorito, arquivo e estado de processamento;
- ordenação por data de criação e atualização;
- ações individuais e ações em lote com confirmação quando destrutivas;
- paginação ou carregamento incremental sem duplicar resultados.

## Detalhe do item
Exibe, quando disponíveis:
- título, URL de origem e domínio;
- descrição, data de captura e tipo;
- conteúdo extraído;
- etiquetas e coleções;
- estado e erro de processamento;
- favorito, arquivar, editar e excluir;
- arquivo original ou link de origem;
- ações de reprocessar, copiar link ou exportar, quando implementadas.

## Regras de duplicidade
- A detecção deve normalizar URLs com cuidado, preservando parâmetros que possam mudar o conteúdo.
- A regra inicial proposta é avisar que já existe um item semelhante e oferecer abrir o existente ou salvar outro quando fizer sentido.
- Não excluir automaticamente conteúdo do usuário.
- Importações repetidas devem produzir resultado previsível e relatório de duplicatas.

## Arquivar e excluir
- Arquivar é reversível e não apaga o original.
- Excluir pede confirmação e remove ou agenda a remoção de conteúdo derivado, arquivos, embeddings e índices.
- A interface deve distinguir arquivar de excluir.
- Se a exclusão física for assíncrona, o item não pode continuar aparecendo em busca para usuários não autorizados.

## Estados de processamento
- `pending`: aguardando processamento.
- `processing`: em execução.
- `completed`: tarefas aplicáveis concluídas.
- `partial`: item salvo, mas uma ou mais extrações opcionais falharam.
- `failed`: processamento essencial falhou; item original permanece quando possível.
- `cancelled`: tarefa cancelada por ação válida.

Os nomes podem mudar na implementação, mas os estados e seus significados precisam permanecer claros.

## Critérios de aceitação
- Um link pode ser salvo mesmo se a extração falhar.
- A tela não perde alterações silenciosamente.
- Um job repetido não cria derivados duplicados.
- Arquivos privados não são acessíveis por URL pública previsível.
- Ações em lote mostram quais itens foram processados e quais falharam.
