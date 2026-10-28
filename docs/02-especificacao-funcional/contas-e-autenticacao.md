# Especificação funcional — contas e autenticação

## Objetivo
Garantir que cada usuário acesse apenas seus dados e consiga entrar, sair e recuperar acesso com segurança.

## Telas
- Cadastro.
- Login.
- Solicitação de redefinição de senha, se autenticação por senha for escolhida.
- Redefinição de senha.
- Configurações de conta e sessões, se suportadas pela biblioteca selecionada.

## Requisitos
- Cadastro valida formato de e-mail, requisitos de senha e duplicidade.
- Mensagens não devem revelar dados excessivos sobre a existência de contas.
- Senhas, se usadas, são armazenadas somente com hash seguro por biblioteca consolidada; nunca em texto puro.
- Sessões usam cookies seguros, HttpOnly e SameSite apropriado; Secure em HTTPS.
- Operações sensíveis exigem validação no servidor.
- Logout invalida a sessão.
- Tokens de recuperação têm uso único, expiração e armazenamento seguro.
- Limitação de tentativas reduz abuso de login e recuperação.
- O sistema não permite consultar recursos de outro usuário alterando IDs na URL ou no corpo da requisição.

## Estados e erros
- Carregando, sucesso, erro de validação, credenciais inválidas, sessão expirada e indisponibilidade temporária.
- Falhas não podem expor stack trace, segredo ou informação interna ao usuário.

## Critérios de aceitação
- Um usuário A não lê nem altera dados do usuário B.
- Sessão expirada não permite operações autenticadas.
- Logout invalida o acesso protegido.
- Redefinição de senha não pode reutilizar o mesmo token.
- Testes automatizados cobrem acesso autorizado e não autorizado.

## Pendências
- Escolher provedor/biblioteca de autenticação.
- Decidir se haverá login social.
- Definir política de senha, verificação de e-mail e duração de sessão.
