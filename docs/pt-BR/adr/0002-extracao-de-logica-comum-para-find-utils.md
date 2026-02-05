# ADR-0002: Extração de Lógica Comum para findUtils

## Status
Aceito

## Contexto
As funções `find()` e `findStream()` compartilhavam grande parte da lógica:
- Construção de query MongoDB
- Aplicação de filtros e permissões
- Cálculo de condições de acesso
- Construção do pipeline de agregação

Duplicação de código violava o princípio DRY (Don't Repeat Yourself).

## Decisão
Extrair toda a lógica comum para `findUtils.ts` com a função `buildFindQuery()`, que retorna:
- Query MongoDB construída
- Pipeline de agregação
- Condições de acesso
- Chaves de condições
- Opções de query (sort, limit, skip, projection)
- Metadados necessários (metaObject, user, access, collection)

## Detalhes da Implementação

### Funções Helper Extraídas
1. **`buildSortOptions()`**: Constrói opções de ordenação considerando tipos especiais (money, personName, $textScore)
2. **`buildAccessConditionsForField()`**: Calcula condições de acesso para um campo específico
3. **`buildAccessConditionsMap()`**: Constrói mapa de condições de acesso para todos os campos
4. **`calculateConditionsKeys()`**: Calcula chaves de condições baseado na projeção

### Consistência com find.ts Original
- Replicado comportamento da linha 129 do `find.ts` para garantir compatibilidade
- Mesma lógica de construção de query e aplicação de filtros
- Garante que ambos endpoints retornem exatamente os mesmos dados

## Consequências

### Positivas
- **DRY**: Elimina duplicação de código
- **Manutenibilidade**: Mudanças na lógica de query em um único lugar
- **Testabilidade**: Lógica comum pode ser testada isoladamente
- **Consistência**: Garante que ambos endpoints usem exatamente a mesma lógica

### Negativas
- Arquivo adicional para manter
- Dependência entre `find.ts`, `findStream.ts` e `findUtils.ts`

### Riscos Mitigados
- **Breaking changes**: Teste de confiança valida que comportamento não mudou
- **Complexidade**: Funções helper bem nomeadas e documentadas

## Alternativas Consideradas

1. **Manter duplicação**: Violaria DRY e dificultaria manutenção
2. **Refatorar find.ts original**: Risco de quebrar funcionalidade existente
3. **Classe compartilhada**: Overhead desnecessário para operações funcionais

## Referências
- Implementação: `src/imports/data/api/findUtils.ts`
- Uso em find: `src/imports/data/api/find.ts` (não modificado)
- Uso em findStream: `src/imports/data/api/findStream.ts`

