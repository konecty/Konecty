# ADR-0001: HTTP Streaming para Busca de Dados

## Status
Aceito

## Contexto
O endpoint `/rest/data/:document/find` atual acumula todos os registros em memória no servidor antes de enviar ao cliente. Para grandes volumes de dados (50k+ registros), isso causa:
- Alto uso de memória no servidor
- Time To First Byte (TTFB) alto (cliente espera todo o processamento)
- Possível timeout em conexões lentas
- Limitações de escalabilidade

## Decisão
Implementar um novo endpoint `/rest/stream/:document/findStream` que processa e envia dados registro por registro usando HTTP streaming, sem acumular dados em memória.

## Detalhes da Implementação

### Arquitetura de Streaming
- **MongoDB Cursor Stream**: Utiliza `cursor.stream()` do MongoDB para obter dados incrementalmente
- **Node.js Transform Streams**: Pipeline de transformações aplicadas registro por registro:
  1. `ApplyFieldPermissionsTransform`: Aplica permissões de campo
  2. `ApplyDateToStringTransform`: Converte objetos Date para strings
  3. `ObjectToJsonTransform`: Converte objetos para JSON strings (newline-delimited)
- **HTTP Streaming**: Fastify envia o stream `Readable` diretamente como resposta HTTP

### Extração de Lógica Comum (DRY)
- Criado `findUtils.ts` com função `buildFindQuery()` compartilhada
- Lógica de construção de query, filtros, permissões e pipeline de agregação extraída
- Ambos `find.ts` e `findStream.ts` podem usar a mesma lógica base

### Ordenação Padrão
- Quando não especificado, aplica `{ _id: 1 }` como ordenação padrão
- Garante consistência entre execuções, especialmente com `readPreference: 'secondaryPreferred'`
- Evita resultados não-determinísticos

## Consequências

### Positivas
- **Memória**: Redução de 68% no uso de memória (162MB vs 509MB para 55k registros)
- **TTFB**: 99.3% mais rápido (176ms vs 24.204ms)
- **Throughput**: 81.8% melhor (3.493 vs 1.921 records/sec)
- **Escalabilidade**: Suporta volumes muito maiores sem impacto na memória do servidor
- **Experiência do usuário**: Cliente recebe dados imediatamente, sem esperar processamento completo

### Negativas
- Complexidade adicional no código (Transform streams)
- Requer testes específicos para validar streaming
- Cliente precisa processar stream incrementalmente

### Riscos Mitigados
- **Consistência de dados**: Teste de confiança garante que retorna exatamente os mesmos dados do endpoint original
- **Permissões**: Aplicadas registro por registro, mantendo segurança
- **Erros**: Tratamento de erro robusto em cada etapa do pipeline

## Alternativas Consideradas

1. **Paginação tradicional**: Mantém alto uso de memória e TTFB alto
2. **Cursor do MongoDB direto**: Não aplica permissões e transformações necessárias
3. **WebSockets**: Complexidade adicional desnecessária para operação read-only

## Referências
- Implementação: `src/imports/data/api/findStream.ts`
- Transform Streams: `src/imports/data/api/streamTransforms.ts`
- Endpoint: `src/server/routes/rest/stream/streamApi.ts`
- Testes: `__test__/data/api/runFindStreamTests.ts`, `runFindStreamBenchmark.ts`, `runFindStreamConfidenceTest.ts`

