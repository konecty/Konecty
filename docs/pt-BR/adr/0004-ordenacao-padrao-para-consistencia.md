# ADR-0004: Ordenação Padrão para Consistência

## Status
Aceito

## Contexto
Quando nenhuma ordenação é especificada pelo cliente, o MongoDB pode retornar resultados em ordem não-determinística, especialmente com `readPreference: 'secondaryPreferred'`. Isso causa:
- Resultados diferentes entre execuções
- Impossibilidade de comparar resultados entre endpoints
- Problemas em testes de confiança

## Decisão
Aplicar ordenação padrão `{ _id: 1 }` quando nenhuma ordenação é especificada pelo cliente.

## Detalhes da Implementação

### Regras de Ordenação
1. Se `sort` é fornecido pelo cliente: usa a ordenação especificada
2. Se `sort` não é fornecido: aplica `{ _id: 1 }` como padrão
3. Se `limit > 1000`: força `{ _id: 1 }` (mesmo comportamento do find.ts original)

### Localização
- Implementado em `findUtils.ts` na função `buildFindQuery()`
- Aplicado antes da construção do pipeline de agregação
- Garante que `aggregateStages` sempre tenha `$sort` quando necessário

## Consequências

### Positivas
- **Consistência**: Resultados sempre na mesma ordem entre execuções
- **Testabilidade**: Testes de confiança podem comparar resultados exatamente
- **Previsibilidade**: Comportamento determinístico facilita debugging
- **Performance**: Ordenação por `_id` é eficiente (índice primário)

### Negativas
- Overhead mínimo de ordenação (aceitável dado o benefício)
- Pode não ser a ordenação desejada pelo cliente (mas cliente pode especificar)

### Riscos Mitigados
- **Performance**: `_id` é indexado, ordenação é rápida
- **Compatibilidade**: Comportamento alinhado com find.ts quando `limit > 1000`

## Alternativas Consideradas

1. **Sem ordenação padrão**: Resultados não-determinísticos, problemas em testes
2. **Ordenação por data de criação**: Requer campo adicional, pode não existir
3. **Ordenação aleatória**: Não atende necessidade de consistência

## Referências
- Implementação: `src/imports/data/api/findUtils.ts` (linhas 270-278)
- Teste de confiança: `__test__/data/api/runFindStreamConfidenceTest.ts`

