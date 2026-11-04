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

## Sincronização Ponta a Ponta e Checklist Pré-Commit (Regra Obrigatória)
- **Contratos UI ↔ API ↔ Servidor alinhados:** todo formulário, filtro ou seletor na UI (`src/components/**`) envia exatamente os campos esperados pela rota (`src/app/api/**`) e lê exatamente as propriedades retornadas pelo serviço (`src/server/**`).
- **Escopos de Segurança verificados:** todas as rotas `GET` aplicam `requireCurrentUser("read")` e todas as rotas `POST`/`PATCH`/`PUT`/`DELETE` aplicam `requireCurrentUser("write")`.
- **Sincronização de Versão e Superfícies Públicas:** nenhuma release ou feature é commitada sem varredura global (`Select-String` / `grep`) atualizando `package.json`, `LandingPage.tsx`, `LandingShowcaseClient.tsx`, `WorkspaceHeader.tsx`, `src/server/mcp.ts`, `README.md`, `CHANGELOG.md` e `docs/STATUS-IMPLEMENTACAO.md`.
- **Verificação antes do `git commit`:** `pnpm typecheck` (0 erros) e `pnpm test` (100% aprovados) executados após todas as alterações.

## Evidência
A entrega deve listar os comandos executados e seus resultados. Se um comando não foi executado, declarar isso explicitamente.
