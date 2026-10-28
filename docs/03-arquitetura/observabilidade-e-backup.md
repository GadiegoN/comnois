# Observabilidade, backup e recuperação

## Logs
- Logs estruturados com timestamp, nível, tipo de evento e identificador de correlação.
- Remover tokens, senhas, chaves de API e conteúdo sensível.
- Mensagens ao usuário devem ser seguras; detalhes técnicos ficam em logs protegidos.

## Métricas mínimas
- disponibilidade e latência de endpoints;
- erros por tipo de operação;
- jobs pendentes, duração e falhas;
- consumo e custo estimado por provedor de IA;
- espaço utilizado por arquivos;
- falhas de backup e restauração.

## Backup
- Definir frequência, retenção e criptografia.
- Incluir banco e arquivos, mantendo consistência entre referências e binários.
- Separar credenciais de backup das credenciais da aplicação.
- Documentar RPO (perda de dados aceitável) e RTO (tempo de recuperação aceitável) com base no plano de hospedagem.
- Testar restauração periodicamente; um arquivo de backup não testado não comprova recuperabilidade.

## Incidentes
Documentar procedimento para:
1. detectar e classificar;
2. conter;
3. preservar evidências necessárias sem coletar dados excessivos;
4. recuperar serviço e dados;
5. comunicar conforme obrigação e impacto;
6. corrigir causa raiz e registrar aprendizado.
