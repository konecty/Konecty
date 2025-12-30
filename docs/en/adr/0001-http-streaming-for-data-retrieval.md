# ADR-0001: HTTP Streaming for Data Retrieval

## Status
Accepted

## Context
The current `/rest/data/:document/find` endpoint accumulates all records in server memory before sending to the client. For large data volumes (50k+ records), this causes:
- High server memory usage
- High Time To First Byte (TTFB) (client waits for complete processing)
- Possible timeouts on slow connections
- Scalability limitations

## Decision
Implement a new endpoint `/rest/stream/:document/findStream` that processes and sends data record by record using HTTP streaming, without accumulating data in memory.

## Implementation Details

### Streaming Architecture
- **MongoDB Cursor Stream**: Uses MongoDB's `cursor.stream()` to get data incrementally
- **Node.js Transform Streams**: Pipeline of transformations applied record by record:
  1. `ApplyFieldPermissionsTransform`: Applies field permissions
  2. `ApplyDateToStringTransform`: Converts Date objects to strings
  3. `ObjectToJsonTransform`: Converts objects to JSON strings (newline-delimited)
- **HTTP Streaming**: Fastify sends the `Readable` stream directly as HTTP response

### Common Logic Extraction (DRY)
- Created `findUtils.ts` with shared `buildFindQuery()` function
- Query construction, filters, permissions, and aggregation pipeline logic extracted
- Both `find.ts` and `findStream.ts` can use the same base logic

### Default Sorting
- When not specified, applies `{ _id: 1 }` as default sort
- Ensures consistency between executions, especially with `readPreference: 'secondaryPreferred'`
- Avoids non-deterministic results

## Consequences

### Positive
- **Memory**: 68% reduction in memory usage (162MB vs 509MB for 55k records)
- **TTFB**: 99.3% faster (176ms vs 24.204ms)
- **Throughput**: 81.8% better (3.493 vs 1.921 records/sec)
- **Scalability**: Supports much larger volumes without server memory impact
- **User experience**: Client receives data immediately, without waiting for complete processing

### Negative
- Additional code complexity (Transform streams)
- Requires specific tests to validate streaming
- Client needs to process stream incrementally

### Mitigated Risks
- **Data consistency**: Confidence test ensures it returns exactly the same data as the original endpoint
- **Permissions**: Applied record by record, maintaining security
- **Errors**: Robust error handling at each pipeline stage

## Alternatives Considered

1. **Traditional pagination**: Maintains high memory usage and high TTFB
2. **MongoDB cursor directly**: Doesn't apply necessary permissions and transformations
3. **WebSockets**: Unnecessary additional complexity for read-only operation

## References
- Implementation: `src/imports/data/api/findStream.ts`
- Transform Streams: `src/imports/data/api/streamTransforms.ts`
- Endpoint: `src/server/routes/rest/stream/streamApi.ts`
- Tests: `__test__/data/api/runFindStreamTests.ts`, `runFindStreamBenchmark.ts`, `runFindStreamConfidenceTest.ts`

