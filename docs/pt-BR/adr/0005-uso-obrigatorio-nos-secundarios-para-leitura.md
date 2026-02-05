# ADR-0005: Uso Obrigatório de Nós Secundários para Leitura no findStream

## Status
Aceito

## Contexto
O endpoint `findStream` foi projetado para processar grandes volumes de dados (50k+ registros) com streaming HTTP. Para maximizar a performance de leitura sem degradar o banco de dados principal, é necessário:

- **Isolar carga de leitura**: Operações de leitura pesadas não devem impactar o nó primário, que é responsável por todas as operações de escrita
- **Distribuir carga**: Nós secundários são dedicados a leitura e podem processar queries pesadas sem afetar a disponibilidade do sistema
- **Garantir performance**: Leitura obrigatória em secundários garante que queries longas não bloqueiem o primário
- **Maximizar throughput**: Configurações específicas de performance para operações de leitura em streaming

## Decisão
Priorizar o uso de nós secundários do MongoDB (`readPreference: 'secondary'`) no endpoint `findStream` quando disponíveis, com fallback automático para `secondaryPreferred` quando não houver secundários. Além disso, aplicar outras configurações de performance específicas para maximizar a leitura sem degradar o banco geral.

## Detalhes da Implementação

### Configurações Aplicadas

1. **`readPreference: 'secondary'` ou `'secondaryPreferred'`** (inteligente com fallback)
   - Verifica se há nós secundários disponíveis usando `replSetGetStatus()`
   - Se houver secundários: usa `'secondary'` (obrigatório, máximo isolamento)
   - Se não houver secundários: usa `'secondaryPreferred'` (fallback, não retorna erro)
   - Garante isolamento da carga de leitura quando possível, mas funciona em todos os ambientes

2. **`allowDiskUse: true`**
   - Permite que agregações usem disco quando necessário
   - Essencial para queries complexas com grandes volumes de dados
   - Evita erros de memória em operações grandes

3. **`batchSize`** (configurável)
   - Otimiza o tamanho do batch para streaming
   - Reduz latência inicial e melhora throughput
   - Padrão: 1000 documentos por batch

4. **`maxTimeMS`** (configurável)
   - Limite de tempo máximo para execução da query
   - Protege contra queries que podem travar o sistema
   - Padrão: 5 minutos (300000ms)

5. **`countDocuments` com `readPreference: 'secondary'`**
   - Cálculo de total também usa nós secundários
   - Mantém consistência e não impacta primário

### Verificação de Secundários Disponíveis

A implementação verifica dinamicamente se há secundários disponíveis:
- Usa `db.admin().replSetGetStatus()` para obter status do replica set
- Verifica se há membros com `stateStr: 'SECONDARY'`
- Cache pode ser implementado no futuro para otimizar performance

### Diferença entre `secondary` e `secondaryPreferred`

- **`secondaryPreferred`**: Tenta usar secundários, mas usa primário se secundários não estiverem disponíveis
- **`secondary`**: Obrigatório usar secundários, retorna erro se nenhum secundário estiver disponível

### Comportamento em Falhas

Se nenhum nó secundário estiver disponível:
- Sistema detecta automaticamente e usa `secondaryPreferred` como fallback
- Operação continua normalmente usando primário se necessário
- Não retorna erro ao cliente, garantindo funcionamento em todos os ambientes
- Em ambientes de produção com secundários, mantém isolamento total

## Consequências

### Positivas
- **Isolamento de carga**: Nó primário totalmente protegido de queries pesadas de leitura
- **Performance**: Nós secundários podem ser otimizados especificamente para leitura
- **Escalabilidade**: Permite adicionar mais nós secundários para distribuir carga
- **Disponibilidade**: Primário mantém alta disponibilidade mesmo com queries longas
- **Throughput**: Configurações otimizadas aumentam capacidade de processamento

### Negativas
- **Verificação adicional**: Requer chamada a `replSetGetStatus()` para verificar secundários (overhead mínimo)
- **Latência potencial**: Pode haver pequeno aumento de latência se secundários estiverem atrás do primário em replicação
- **Complexidade operacional**: Requer monitoramento adequado dos nós secundários em produção

### Riscos Mitigados
- **Falha de secundários**: Sistema detecta automaticamente e faz fallback para `secondaryPreferred`, não retorna erro
- **Ambientes sem secundários**: Funciona perfeitamente em desenvolvimento e ambientes menores
- **Replicação lag**: Ordenação padrão por `_id` garante consistência mesmo com lag mínimo
- **Queries infinitas**: `maxTimeMS` protege contra queries que podem travar o sistema
- **Uso excessivo de memória**: `allowDiskUse` permite operações grandes sem esgotar memória

## Alternativas Consideradas

1. **`secondaryPreferred`**: Permite fallback para primário, mas não garante isolamento total
2. **`primary`**: Usaria nó primário, mas degradaria performance geral do sistema
3. **`nearest`**: Escolhe nó mais próximo, mas pode escolher primário em alguns casos
4. **Sem configurações específicas**: Não maximizaria performance de leitura

## Referências
- Implementação: `src/imports/data/api/findStream.ts`
- Verificação de secundários: `src/imports/utils/mongo.ts` (função `hasSecondaryNodes()`)
- MongoDB Read Preference: https://www.mongodb.com/docs/manual/core/read-preference/
- MongoDB Aggregation Options: https://www.mongodb.com/docs/manual/reference/method/db.collection.aggregate/
- MongoDB Replica Set Status: https://www.mongodb.com/docs/manual/reference/command/replSetGetStatus/

