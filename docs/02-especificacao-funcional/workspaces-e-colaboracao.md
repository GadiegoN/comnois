# Especificação funcional — workspaces e colaboração

**Estado:** fase posterior; não implementar antes de existir um fluxo individual confiável.

## Conceito
Um workspace é um espaço de conteúdo com membros e regras de acesso próprias. A conta de uma pessoa e o workspace são conceitos separados.

## Capacidades futuras
- Criar workspace.
- Convidar membro por e-mail com convite expirável.
- Remover membro.
- Papéis mínimos: proprietário, administrador e membro.
- Compartilhar coleções ou itens de forma explícita, se a granularidade for necessária.
- Sair de workspace sem perder dados pessoais.
- Transferência de propriedade com confirmação e auditoria.

## Regras obrigatórias
- Toda consulta aplica o workspace e as permissões no servidor.
- Não basta esconder itens no frontend.
- Convites são de uso controlado, expiram e não podem conceder permissões maiores que as do convidador.
- Remover membro revoga acesso futuro.
- Exclusão de workspace deve ter confirmação, política de retenção e tratamento de propriedade.
- O assistente de IA usa somente fontes acessíveis ao membro atual.
- Logs de auditoria não devem registrar segredos nem conteúdo desnecessário.

## Critérios de aceitação
- Testes cobrem membro removido, convite expirado e tentativa de acessar IDs de outro workspace.
- O assistente não recupera conteúdo de workspaces sem permissão.
- A transferência de propriedade não deixa o workspace sem responsável.
