# Changelog: Graph axis limits (xAxisLimit / yAxisLimit)

## Resumo

Adicionado suporte a limites Top-N nos eixos X e Y dos gráficos gerados pelo backend Python.

## Motivação

Dashboards com muitas categorias (ex: estados, cidades) geram gráficos ilegíveis. O usuário precisa poder limitar o número de categorias (eixo X) e séries (eixo Y) exibidas, mostrando apenas as N mais relevantes.

## O que mudou

- Adicionados campos `xAxisLimit`, `yAxisLimit` e `limitOrder` na interface `GraphConfig` (TypeScript)
- Adicionado tipo `LimitOrder` (`'desc' | 'asc'`)
- Implementado bloco "7.5 Apply Top-N limits" no `graph_generator.py`:
  - `xAxisLimit`: filtra as Top N categorias no eixo X, ordenadas pela coluna de agregação
  - `yAxisLimit`: quando há múltiplas séries, mantém apenas as N séries com maior soma
  - `limitOrder`: controla se o limite seleciona os maiores (`desc`, padrão) ou menores (`asc`) valores
- Adicionado `LinearLocator` para ajustar ticks do eixo Y quando `yAxisLimit` é definido

## Impacto técnico

- O filtro Top-N é aplicado após a agregação e antes da geração do SVG, sem impacto em performance
- A cache key do backend já inclui o `graphConfig` completo, então limites diferentes geram cache keys diferentes

## Impacto externo

Usuários de dashboards podem configurar `xAxisLimit` e `yAxisLimit` via formulário ou API para obter gráficos mais legíveis.

## Como validar

1. Acessar endpoint `/rest/data/:document/graph` com `xAxisLimit` no `graphConfig`
2. Verificar que o SVG retornado mostra apenas N categorias
3. Verificar nos logs que `Python graph generation completed` aparece (não confundir com `Python aggregation completed` do pivot)

## Arquivos afetados

- `src/imports/types/graph.ts`
- `src/scripts/python/graph_generator.py`

## Existe migração?

Não.
