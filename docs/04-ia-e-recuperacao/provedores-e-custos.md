# Provedores de IA e controle de custos

## Objetivo
Permitir usar modelos externos ou locais sem acoplar a aplicação a um único fornecedor.

## Interface interna
O adaptador de provedor deve declarar capacidades reais, como:
- geração de texto;
- embeddings;
- visão/OCR, se suportado;
- streaming;
- limites e configuração;
- disponibilidade e tratamento de erros.

Não assumir que todo provedor oferece todos os recursos.

## Configuração
- Provedor e modelo selecionados.
- Chave guardada com segurança, nunca devolvida integralmente ao cliente.
- Teste de conexão sem expor segredos.
- Opção para desativar funções de IA.
- Mensagem clara quando o provedor não oferece a capacidade solicitada.

## Custos e abuso
- Estimar tokens/uso quando possível.
- Limitar tamanho de entrada e saída.
- Limitar concorrência e repetição automática.
- Evitar repetir cobranças por retry sem idempotência quando o provedor permitir controle.
- Registrar consumo por operação sem armazenar conteúdo sensível.
- Definir limites por usuário/workspace e comportamento ao atingir o limite.
- Não prometer custo zero para modelos locais: há custo de hardware, energia e operação.

## Privacidade
Explicar quais trechos são enviados a provedores externos. Enviar somente o contexto necessário. Não usar dados de usuários para treinamento por padrão; qualquer exceção exigiria decisão explícita, transparência e análise legal.

## Estratégia inicial
Começar com um único provedor para uma capacidade específica, mas criar uma interface isolada para adicionar alternativas. Validar Ollama/local e provedores comerciais em testes reais antes de anunciar compatibilidade.
