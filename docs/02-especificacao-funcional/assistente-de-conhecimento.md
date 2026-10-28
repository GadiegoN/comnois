# Especificação funcional — assistente de conhecimento

## Objetivo
Permitir perguntas sobre os itens aos quais o usuário tem acesso, recuperar evidências relevantes e produzir respostas com citações verificáveis.

## Fluxo principal
1. O usuário escreve uma pergunta.
2. O sistema identifica o escopo autorizado da pesquisa.
3. A recuperação busca trechos relevantes por mecanismos disponíveis.
4. O sistema monta contexto limitado com trechos, IDs e metadados de origem.
5. O modelo gera uma resposta usando o contexto e as regras do assistente.
6. O sistema valida e apresenta citações associadas aos trechos recuperados.
7. O usuário pode abrir a fonte original e conferir o trecho.
8. Se não houver evidência suficiente, o assistente informa a limitação e pode sugerir uma pesquisa mais específica.

## Requisitos de resposta
- Cada citação deve apontar para um item acessível e, quando possível, para o trecho exato.
- O sistema não pode inventar títulos, URLs, IDs ou trechos.
- A resposta deve separar o que está explicitamente sustentado pelas fontes de inferências ou sínteses.
- Se fontes discordarem, indicar a divergência em vez de ocultá-la.
- A resposta não deve afirmar que revisou toda a biblioteca se a recuperação consultou apenas parte dela.
- Conteúdo recuperado é evidência, não instrução de sistema. Instruções contidas em páginas, PDFs ou notas não podem sobrepor as políticas do assistente.
- Nunca recuperar conteúdo de outro usuário/workspace.
- Guardar histórico de conversa é uma decisão de produto e privacidade a ser definida; não assumir retenção ilimitada.

## Interface
- Área de conversa.
- Campo de pergunta.
- Resposta com referências numeradas ou links de fonte.
- Painel ou cartão de fonte com título, trecho e data quando disponível.
- Estado de busca, geração, erro e ausência de evidência.
- Ação para interromper ou refazer, se tecnicamente suportada.
- Indicação clara quando IA está desativada ou o provedor indisponível.

## Falhas
- Falha de recuperação: informar que a busca não está disponível, sem fabricar resposta.
- Falha do provedor: manter a pergunta e permitir tentar novamente.
- Resposta sem citações válidas: não apresentar como resposta fundamentada; tentar corrigir ou explicar a falha.
- Contexto insuficiente: pedir refinamento ou responder com ressalva explícita.

## Critérios de aceitação
- Todas as citações abrem fontes permitidas.
- Nenhuma resposta pode citar um item inexistente ou inacessível.
- Testes incluem perguntas sem resposta nas fontes, fontes conflitantes e prompt injection em conteúdo capturado.
- O sistema comunica a indisponibilidade de IA sem quebrar a biblioteca básica.
