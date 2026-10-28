# Segurança e privacidade

## Modelo de ameaças
- Acesso horizontal: usuário acessa itens de outro usuário.
- Acesso entre workspaces.
- Upload malicioso ou arquivo excessivamente grande.
- SSRF por URLs capturadas.
- XSS por HTML extraído ou metadados.
- Prompt injection em conteúdo importado.
- Roubo de tokens ou credenciais de provedores.
- Abuso de API, automações ou custos de IA.
- Vazamento em logs, exportações ou backups.
- Dependência vulnerável ou atualização maliciosa.

## Controles obrigatórios
- Autorização no servidor em cada operação.
- Sessões e cookies seguros conforme a biblioteca escolhida.
- Segredos apenas em variáveis/secret manager, nunca no repositório.
- Upload com limites, verificação de tipo e armazenamento privado.
- Sanitização de HTML e saída contextual para evitar XSS.
- SSRF protections para captura de URLs e downloads.
- Rate limiting e limites de consumo em operações custosas.
- CORS e CSRF conforme arquitetura e autenticação.
- Dependências atualizadas e auditoria de vulnerabilidades.
- Logs sem senhas, tokens ou conteúdo completo por padrão.
- Backups protegidos e teste de restauração.
- Exclusão que abrange conteúdo derivado, índices e arquivos conforme política de retenção.
- Política de privacidade clara sobre provedores externos e envio de dados.

## IA e conteúdo não confiável
- Páginas, PDFs, notas importadas e resultados de ferramentas são dados, não instruções privilegiadas.
- Separar instruções do sistema do conteúdo recuperado.
- Enviar ao provedor somente os trechos necessários.
- Não compartilhar dados de outros usuários para melhorar respostas.
- Permitir desativar IA quando possível.
- Não registrar prompts e respostas sensíveis sem finalidade definida e retenção documentada.

## Privacidade por padrão
- Biblioteca privada.
- Compartilhamento sempre explícito.
- Sem indexação pública de conteúdo privado.
- Informar quais dados são enviados a serviços externos.
- Definir retenção de histórico do assistente e logs antes de lançar.
- Exportação e exclusão acessíveis ao titular, respeitando requisitos legais aplicáveis.

## Revisão antes do lançamento
Revisar autenticação, autorização, upload, SSRF, XSS, dependências, custos, backups, recuperação de conta e exclusão de dados. Testes funcionais não substituem revisão de segurança.
