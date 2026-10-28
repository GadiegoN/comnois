# Critérios de aceitação e definição de pronto

Uma funcionalidade só está pronta quando todos os critérios aplicáveis forem atendidos.

## Funcionalidade
- O fluxo principal funciona de ponta a ponta.
- Estados de carregamento, vazio, sucesso e erro são tratados.
- Validação ocorre no cliente para experiência e no servidor para segurança.
- Operações destrutivas têm confirmação apropriada.
- A interface não anuncia sucesso antes de a operação ser confirmada.

## Dados
- Esquema e migração estão versionados.
- Restrições e índices necessários foram avaliados.
- Relações e exclusões são consistentes.
- Repetir a operação não cria duplicatas indevidas.
- Nenhum dado de outro usuário pode ser acessado.

## Segurança
- Autorização no servidor.
- Nenhum segredo no código ou logs.
- Entradas externas validadas.
- Uploads e URLs passam pelos controles aplicáveis.
- Erros públicos não expõem detalhes internos.

## Qualidade
- Testes relevantes criados e executados.
- Lint, typecheck e build executados quando disponíveis.
- Acessibilidade e responsividade verificadas para o fluxo alterado.
- Nenhuma dependência ou API foi presumida sem conferir as versões reais.

## Documentação
- README ou documentação funcional atualizada.
- Variáveis de ambiente documentadas sem valores secretos.
- Migrações e operação explicadas.
- Decisões importantes registradas.
- Limitações conhecidas declaradas.

## Evidência
A entrega deve listar os comandos executados e seus resultados. Se um comando não foi executado, declarar isso explicitamente.
