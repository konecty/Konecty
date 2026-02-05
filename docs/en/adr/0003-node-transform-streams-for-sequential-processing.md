# ADR-0003: Node.js Transform Streams for Sequential Processing

## Status
Accepted

## Context
To process data record by record without accumulating in memory, we need to apply sequential transformations:
1. Apply field permissions (remove non-allowed fields)
2. Convert Date objects to strings
3. Convert objects to JSON strings for HTTP streaming

## Decision
Use Node.js Transform Streams in a sequential pipeline, where each transformation processes one record at a time.

## Implementation Details

### Transform Streams Created

1. **`ApplyFieldPermissionsTransform`**
   - Input: DataDocument object
   - Output: DataDocument object with filtered fields
   - Mode: `objectMode: true` (both input and output)

2. **`ApplyDateToStringTransform`**
   - Input: DataDocument object
   - Output: DataDocument object with Dates converted
   - Mode: `objectMode: true`

3. **`ObjectToJsonTransform`**
   - Input: DataDocument object (objectMode)
   - Output: JSON string + newline (buffer mode)
   - Mode: `readableObjectMode: false, writableObjectMode: true`
   - Converts from objectMode to string/buffer for HTTP streaming

### Transformation Pipeline
```
MongoDB Stream (objectMode)
  → ApplyFieldPermissionsTransform (objectMode)
  → ApplyDateToStringTransform (objectMode)
  → ObjectToJsonTransform (objectMode → string)
  → HTTP Response (chunked transfer)
```

## Consequences

### Positive
- **Constant memory**: Only one record in memory at a time
- **Incremental processing**: Client receives data immediately
- **Reusable**: Transform streams can be composed in different pipelines
- **Testable**: Each transform can be tested in isolation

### Negative
- Additional complexity (3 Transform classes)
- Requires understanding of Node.js streams
- More complex debugging (asynchronous streams)

### Mitigated Risks
- **Transform errors**: Error callback propagates correctly
- **Backpressure**: Node.js streams manage automatically
- **Type safety**: TypeScript ensures correct types at each stage

## Alternatives Considered

1. **Process everything in memory**: Returns to original high memory usage problem
2. **Use generators**: Doesn't integrate well with Fastify HTTP streaming
3. **Process in batches**: Still accumulates data in memory

## References
- Implementation: `src/imports/data/api/streamTransforms.ts`
- Usage: `src/imports/data/api/findStream.ts` (`buildStreamPipeline` function)

