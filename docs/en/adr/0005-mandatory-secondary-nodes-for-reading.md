# ADR-0005: Mandatory Secondary Nodes for Reading in findStream

## Status
Accepted

## Context
The `findStream` endpoint was designed to process large data volumes (50k+ records) with HTTP streaming. To maximize read performance without degrading the primary database, it's necessary to:

- **Isolate read load**: Heavy read operations should not impact the primary node, which is responsible for all write operations
- **Distribute load**: Secondary nodes are dedicated to reading and can process heavy queries without affecting system availability
- **Ensure performance**: Mandatory reading from secondaries ensures long queries don't block the primary
- **Maximize throughput**: Specific performance configurations for streaming read operations

## Decision
Prioritize use of MongoDB secondary nodes (`readPreference: 'secondary'`) in the `findStream` endpoint when available, with automatic fallback to `secondaryPreferred` when no secondaries are available. In addition, apply other performance-specific configurations to maximize reading without degrading the general database.

## Implementation Details

### Applied Configurations

1. **`readPreference: 'secondary'` or `'secondaryPreferred'`** (smart with fallback)
   - Checks if secondary nodes are available using `replSetGetStatus()`
   - If secondaries available: uses `'secondary'` (mandatory, maximum isolation)
   - If no secondaries: uses `'secondaryPreferred'` (fallback, doesn't return error)
   - Ensures read load isolation when possible, but works in all environments

2. **`allowDiskUse: true`**
   - Allows aggregations to use disk when necessary
   - Essential for complex queries with large data volumes
   - Prevents memory errors in large operations

3. **`batchSize`** (configurable)
   - Optimizes batch size for streaming
   - Reduces initial latency and improves throughput
   - Default: 1000 documents per batch

4. **`maxTimeMS`** (configurable)
   - Maximum time limit for query execution
   - Protects against queries that could hang the system
   - Default: 5 minutes (300000ms)

5. **`countDocuments` with `readPreference: 'secondary'`**
   - Total count calculation also uses secondary nodes
   - Maintains consistency and doesn't impact primary

### Checking for Available Secondaries

The implementation dynamically checks if secondaries are available:
- Uses `db.admin().replSetGetStatus()` to get replica set status
- Checks if there are members with `stateStr: 'SECONDARY'`
- Cache can be implemented in the future to optimize performance

### Difference between `secondary` and `secondaryPreferred`

- **`secondaryPreferred`**: Tries to use secondaries, but uses primary if secondaries are unavailable
- **`secondary`**: Mandatory use of secondaries, returns error if no secondary is available

### Behavior on Failures

If no secondary node is available:
- System automatically detects and uses `secondaryPreferred` as fallback
- Operation continues normally using primary if necessary
- Doesn't return error to client, ensuring functionality in all environments
- In production environments with secondaries, maintains complete isolation

## Consequences

### Positive
- **Load isolation**: Primary node completely protected from heavy read queries
- **Performance**: Secondary nodes can be optimized specifically for reading
- **Scalability**: Allows adding more secondary nodes to distribute load
- **Availability**: Primary maintains high availability even with long queries
- **Throughput**: Optimized configurations increase processing capacity

### Negative
- **Additional check**: Requires call to `replSetGetStatus()` to check for secondaries (minimal overhead)
- **Potential latency**: May have slight latency increase if secondaries are behind primary in replication
- **Operational complexity**: Requires adequate monitoring of secondary nodes in production

### Mitigated Risks
- **Secondary failures**: System automatically detects and falls back to `secondaryPreferred`, doesn't return error
- **Environments without secondaries**: Works perfectly in development and smaller environments
- **Replication lag**: Default sorting by `_id` ensures consistency even with minimal lag
- **Infinite queries**: `maxTimeMS` protects against queries that could hang the system
- **Excessive memory usage**: `allowDiskUse` allows large operations without exhausting memory

## Alternatives Considered

1. **`secondaryPreferred`**: Allows fallback to primary, but doesn't guarantee complete isolation
2. **`primary`**: Would use primary node, but would degrade overall system performance
3. **`nearest`**: Chooses closest node, but may choose primary in some cases
4. **No specific configurations**: Wouldn't maximize read performance

## References
- Implementation: `src/imports/data/api/findStream.ts`
- Secondary check: `src/imports/utils/mongo.ts` (`hasSecondaryNodes()` function)
- MongoDB Read Preference: https://www.mongodb.com/docs/manual/core/read-preference/
- MongoDB Aggregation Options: https://www.mongodb.com/docs/manual/reference/method/db.collection.aggregate/
- MongoDB Replica Set Status: https://www.mongodb.com/docs/manual/reference/command/replSetGetStatus/

