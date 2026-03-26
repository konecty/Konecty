# findByLookup: aplicar conditionFields do metadata do campo lookup

## Resumo

A função `findByLookup` passa a considerar `field.conditionFields` do metadata do campo lookup e a incluir essas condições no filtro enviado ao MongoDB, antes do `parseFilterObject`.

## Motivação

O metadata já permitia declarar `conditionFields` em campos lookup (por exemplo filtro estático em documentos alvo), mas o endpoint de busca do lookup não aplicava essas regras. Buscas como a do corretor na roleta listavam registros que deveriam ser excluídos por regra de negócio (por exemplo usuários inativos).

## O que mudou

- Em `findByLookup`, após os filtros de acesso e do `extraFilter` da query string, é empilhado um bloco de filtro com `match` em conjunção e `conditions` derivadas de `field.conditionFields`.
- Cada condição usa `term`, `operator` e `value`. Quando existir `valueField`, o valor é resolvido a partir do objeto `filter` da query string (`extraFilter`), com fallback para `value`.

## Impacto técnico

- Deploy do backend Konecty com reinício ou reload conforme processo do ambiente.
- Lookups cujo metadata defina `conditionFields` passam a refletir essas restrições automaticamente na API de lookup.

## Impacto externo

- Comportamento de autocomplete e busca em lookups alinhado ao declarado no metadata.

## Como validar

- Publicar metadata de um campo lookup com `conditionFields` apontando para um campo booleano no documento alvo (por exemplo apenas registros com ativo verdadeiro).
- Chamar o endpoint de lookup correspondente e confirmar que registros que não satisfazem as condições não aparecem nos resultados.
- Verificar que condições apenas estáticas (`value` sem `valueField`) funcionam sem parâmetro `filter` na query string.

## Arquivos afetados

- `src/imports/data/data.js`

## Existe migração?

Não.
