# Changelog: Documentation for exists operator and empty arrays

## Resumo

Documentação adicionada explicando o comportamento do operador `exists` em filtros Konecty em relação a campos ausentes, `null` e arrays vazios, com alternativas e limitações.

## Motivação

Usuários podem assumir incorretamente que `exists: false` retorna documentos onde o campo está vazio (`[]` ou `null`). O operador mapeia diretamente para o MongoDB `$exists`, que diferencia entre campo ausente e campo presente com valor vazio.

## O que mudou

- Nova subseção "Operator exists and Empty Arrays" / "Operador exists e Arrays Vazios" em três documentos:
  - `docs/en/filters.md`
  - `docs/pt-BR/filters.md`
  - `docs/en/internal/filter.md`
- Tabela explicando quais combinações de valor de documento vs. `exists: true/false` retornam resultados
- Workaround para campos que suportam `equals`: uso de filtro OR com `exists: false` e `equals: []`
- Esclarecimento da limitação em campos do tipo `file` (apenas `exists`, sem workaround)

## Impacto técnico

Nenhum. Apenas documentação.

## Impacto externo

Usuários e integradores da API passam a ter referência clara do comportamento esperado ao usar `exists: false` em campos que podem ser arrays vazios.

## Como validar

Revisar os arquivos de documentação em `docs/` e confirmar que o conteúdo está coerente com o código em `src/imports/data/filterUtils.js` (parseFilterCondition, operatoresByType).

## Arquivos afetados

- `docs/en/filters.md`
- `docs/pt-BR/filters.md`
- `docs/en/internal/filter.md`
- `docs/changelog/2025-03-02_exists-operator-empty-array-documentation.md`
- `docs/changelog/README.md`

## Existe migração?

Não.
