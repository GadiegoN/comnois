# Especificação funcional — importação e exportação

## Objetivo
Permitir entrada e saída de dados sem exigir que o usuário permaneça preso à plataforma.

## Importação
- Começar por um formato simples e documentado (por exemplo, JSON/CSV com anexos em arquivo compactado), depois adicionar importadores específicos conforme demanda.
- Validar tamanho, estrutura, encoding e conteúdo.
- Mostrar prévia ou resumo antes de importar quando possível.
- Apresentar contagem de novos itens, duplicatas, itens ignorados e falhas.
- A importação deve ser idempotente quando o mesmo arquivo for enviado novamente, conforme a regra de duplicidade documentada.
- Não executar scripts ou HTML importado.
- Limitar frequência e tamanho para reduzir abuso.

## Exportação
- Exportar metadados, notas, etiquetas, coleções e conteúdo disponível em formato documentado.
- Oferecer arquivos originais quando armazenados e legalmente/tecnicamente exportáveis.
- Incluir versão do formato e manifesto.
- Informar itens omitidos e o motivo.
- Exportações grandes devem ser assíncronas, com link temporário e protegido.
- Links temporários expiram e não podem ser previsíveis.
- A exportação de workspace exige permissão explícita adequada.

## Critérios de aceitação
- Exportar e reimportar preserva relações suportadas.
- A interface não declara sucesso completo se itens falharam.
- Arquivos exportados não ficam publicamente acessíveis.
- A documentação descreve o formato e sua compatibilidade.
