# Princípios e regras globais

## Princípios

1. **Dados do usuário pertencem ao usuário.** Deve haver exportação e exclusão efetiva conforme a política definida.
2. **Privado por padrão.** Nenhum item ou arquivo é público sem uma ação explícita e um modelo de compartilhamento implementado.
3. **Servidor autoriza.** Ocultar um botão no cliente não substitui validação de autorização no servidor.
4. **Estado visível.** Processamento demorado não pode parecer concluído quando ainda está em andamento.
5. **Falhas recuperáveis.** Um erro de extração não deve apagar o item original nem impedir que o usuário o abra.
6. **IA com evidências.** O assistente deve reconhecer quando não há fontes suficientes e não fabricar citações.
7. **Conteúdo externo é não confiável.** Textos capturados podem conter prompt injection, HTML malicioso ou links perigosos.
8. **Custos são parte do produto.** Chamadas de IA, OCR e downloads precisam de limites, estimativas ou controles.
9. **Acessibilidade e responsividade.** Fluxos principais devem funcionar por teclado e em telas pequenas.
10. **Sem dependências invisíveis.** Recursos que precisam de worker, serviço de busca ou provedor devem indicar quando esse serviço está indisponível.

## Regras globais

- Cada item pertence a um proprietário ou workspace.
- Toda consulta a um item deve aplicar escopo de autorização no servidor.
- Um arquivo não pode ser acessado apenas por adivinhar seu identificador ou URL.
- Itens arquivados continuam recuperáveis e pesquisáveis quando o usuário inclui o arquivo na pesquisa; o padrão exato deve ser consistente.
- Excluir um item deve remover ou agendar a remoção de conteúdo derivado, arquivos, embeddings e índices associados.
- Operações repetidas de captura/importação devem tratar duplicatas de maneira previsível.
- O sistema deve manter o original quando falhar a extração.
- Reprocessar um item não deve duplicar tags, arquivos ou registros derivados.
- Respostas de IA não podem usar fontes que o usuário não tem permissão para ler.
- Dados de um workspace nunca podem aparecer nas respostas ou pesquisas de outro workspace.
- A exportação deve indicar falhas ou itens não incluídos; não pode anunciar sucesso completo se houve perda.
- Logs não devem armazenar conteúdo integral, credenciais ou tokens por padrão.
- Alterações de esquema precisam de migrações revisáveis e caminho de recuperação.
