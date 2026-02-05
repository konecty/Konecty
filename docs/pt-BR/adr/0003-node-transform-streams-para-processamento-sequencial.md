# ADR-0003: Node.js Transform Streams para Processamento Sequencial

## Status
Aceito

## Contexto
Para processar dados registro por registro sem acumular em memória, precisamos aplicar transformações sequenciais:
1. Aplicar permissões de campo (remover campos não permitidos)
2. Converter objetos Date para strings
3. Converter objetos para JSON strings para HTTP streaming

## Decisão
Usar Node.js Transform Streams em pipeline sequencial, onde cada transformação processa um registro por vez.

## Detalhes da Implementação

### Transform Streams Criados

1. **`ApplyFieldPermissionsTransform`**
   - Entrada: objeto DataDocument
   - Saída: objeto DataDocument com campos filtrados
   - Modo: `objectMode: true` (ambos entrada e saída)

2. **`ApplyDateToStringTransform`**
   - Entrada: objeto DataDocument
   - Saída: objeto DataDocument com Dates convertidos
   - Modo: `objectMode: true`

3. **`ObjectToJsonTransform`**
   - Entrada: objeto DataDocument (objectMode)
   - Saída: string JSON + newline (buffer mode)
   - Modo: `readableObjectMode: false, writableObjectMode: true`
   - Converte de objectMode para string/buffer para HTTP streaming

### Pipeline de Transformação
```
MongoDB Stream (objectMode)
  → ApplyFieldPermissionsTransform (objectMode)
  → ApplyDateToStringTransform (objectMode)
  → ObjectToJsonTransform (objectMode → string)
  → HTTP Response (chunked transfer)
```

## Consequências

### Positivas
- **Memória constante**: Apenas um registro em memória por vez
- **Processamento incremental**: Cliente recebe dados imediatamente
- **Reutilizável**: Transform streams podem ser compostos em diferentes pipelines
- **Testável**: Cada transform pode ser testado isoladamente

### Negativas
- Complexidade adicional (3 classes Transform)
- Requer entendimento de Node.js streams
- Debugging mais complexo (streams assíncronos)

### Riscos Mitigados
- **Erros em transform**: Callback de erro propaga corretamente
- **Backpressure**: Node.js streams gerenciam automaticamente
- **Type safety**: TypeScript garante tipos corretos em cada etapa

## Alternativas Consideradas

1. **Processar tudo em memória**: Volta ao problema original de alto uso de memória
2. **Usar generators**: Não integra bem com HTTP streaming do Fastify
3. **Processar em batches**: Ainda acumula dados em memória

## Referências
- Implementação: `src/imports/data/api/streamTransforms.ts`
- Uso: `src/imports/data/api/findStream.ts` (função `buildStreamPipeline`)

