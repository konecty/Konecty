# RFC-0001: Cross-Module Query API (Konecty Advanced Query Language)

> A new API for cross-module queries with recursive relations, aggregations, and a SQL interface -- API-only, no UI.

---

## Metadata

| Field         | Value                                          |
| ------------- | ---------------------------------------------- |
| **Status**    | DRAFT                                          |
| **Authors**   | Konecty Team                                   |
| **Created**   | 2026-02-10                                     |
| **Updated**   | 2026-02-13                                     |
| **Reviewers** | TBD                                            |
| **Related**   | ADR-0001 through ADR-0010, especially ADR-0005 (secondary reads), ADR-0006 (Python integration), ADR-0008 (Polars/Pandas), ADR-0010 (code patterns) |

---

## 1. Problem Statement

### Current Limitations

The Konecty `find` API (`/rest/data/:document/find` and `/rest/stream/:document/findStream`) only allows querying **a single module** at a time, with no support for:

- **Cross-module relations**: Cannot query Contact and its related Opportunities in a single request.
- **Cross-module aggregations**: Cannot count opportunities per contact, or sum sales per campaign.
- **Arbitrary multi-module projections**: `withDetailFields` only brings lookup `descriptionFields`/`detailFields`, not arbitrary cross-module queries with custom projections and aggregations.

### Impact

Clients must make **N+1 API calls** for related data and perform joins client-side, leading to:

- High latency for analytics and reporting use cases
- Excessive memory usage on clients
- Duplicated security logic when clients try to merge data
- Inability to perform server-side aggregations across modules

### Goal

Provide a secure, streaming, cross-module query API accessible via REST that:

1. Extends the existing `find` API with recursive nested **relations** (mirroring the MetaObject `relations` pattern)
2. Infers join conditions from **lookup** fields already defined in metadata
3. Supports aggregations (`count`, `sum`, `avg`, `min`, `max`, `first`, `last`, `push`, `addToSet`)
4. Offers both a structured JSON interface (find-compatible) and an ANSI SQL subset interface
5. Uses the same `filter`/`fields`/`sort`/`limit`/`start` naming as the current find API
6. Applies security per module with **graceful degradation** for unauthorized relations
7. Uses streaming and secondary reads for performance
8. Leverages the existing Python bridge (Polars) for join and aggregation processing

---

## 2. Proposed Solution: Two New Endpoints

### Endpoint 1 -- JSON Query (Relations-Based)

```
POST /rest/query/json
Content-Type: application/json
Authorization: <auth token>
```

Accepts a structured JSON body that is a **standard find call with an added `relations` array**. Uses the exact same parameter names as the current find API (`filter`, `fields`, `sort`, `limit`, `start`).

Example body:

```json
{
  "document": "Contact",
  "filter": {
    "match": "and",
    "conditions": [{ "term": "status", "operator": "equals", "value": "active" }]
  },
  "fields": "code,name",
  "sort": [{ "property": "name.full", "direction": "ASC" }],
  "limit": 100,
  "start": 0,
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "contact",
      "filter": {
        "match": "and",
        "conditions": [{ "term": "status", "operator": "in", "value": ["Nova", "Em Visitacao"] }]
      },
      "fields": "code,status",
      "sort": [{ "property": "_createdAt", "direction": "DESC" }],
      "limit": 50,
      "aggregators": {
        "activeOpportunities": { "aggregator": "count" },
        "opportunities": { "aggregator": "push" }
      }
    }
  ]
}
```

### Endpoint 2 -- SQL Query

```
POST /rest/query/sql
Content-Type: application/json
Authorization: <auth token>

{
  "sql": "SELECT c.code, c.name, COUNT(o._id) AS activeOpportunities FROM Contact c INNER JOIN Opportunity o ON c._id = o.contact._id WHERE o.status IN ('Nova', 'Em Visitacao') GROUP BY c.code, c.name ORDER BY c.name ASC LIMIT 100"
}
```

Accepts an ANSI SQL subset string that gets parsed and translated to the same Internal Query Representation (IQR) -- the recursive relations format.

### Response Format

Both endpoints return **NDJSON** streaming responses:

```
Content-Type: application/x-ndjson
X-Total-Count: 42  (optional, if requested via includeTotal)
```

First line (optional metadata):

```json
{"_meta":{"document":"Contact","relations":["Opportunity"],"warnings":[],"executionTimeMs":234}}
```

Subsequent lines (data records with aggregator results merged in):

```json
{"code":1001,"name":{"full":"Alice Santos"},"activeOpportunities":3,"opportunities":[{"code":5001,"status":"Nova"},{"code":5002,"status":"Em Visitacao"}]}
{"code":1002,"name":{"full":"Bruno Silva"},"activeOpportunities":1,"opportunities":[{"code":5003,"status":"Nova"}]}
```

---

## 3. Security Architecture (6 Layers with Graceful Degradation)

The security model applies **all 6 existing layers** but with a key difference from the original find: **only the primary document must be fully authorized; unauthorized relations degrade gracefully to empty/null values instead of rejecting the entire query**.

### Layer 1 -- User Authentication

**Function**: `getUserSafe(authTokenId, contextUser)`

- Validates `authTokenId` or `contextUser`
- Returns authenticated `User` object with `user.access` map
- If invalid, returns error immediately
- Called **once** per request, shared across all modules in the query

### Layer 2 -- Document-Level Access (Soft for Relations)

**Function**: `getAccessFor(document, user)` in `accessUtils.ts:80-134`

- Resolves user's access profile: `user.access[documentName]` -> `MetaObject.Access[name]`
- Checks `access.isReadable === true`
- Returns `MetaAccess` object or `false` (deny)

**Behavior difference for cross-module queries**:

- **Primary document** (`document` field): MUST pass this check. If it fails, the **entire query is rejected**.
- **Relation documents**: If a relation's document fails this check, the relation's **aggregator result fields are set to `null`**. The query continues. A warning is added to `_meta.warnings`: `{ "type": "RELATION_ACCESS_DENIED", "document": "Product", "message": "User lacks read access" }`.

**Benefit**: The same endpoint serves more users. A user without access to Product still gets their Contact + Opportunity data; the product-related aggregators simply return null.

### Layer 3 -- Document-Level Read Filter (Row-Level Security)

**Source**: `access.readFilter` (a KonFilter object)

- Each `MetaAccess` may define a `readFilter`
- This filter is **always merged** with the relation's filter via `$and`
- Restricts which **records** the user can see
- Example: a broker can only see opportunities assigned to them
- Applied in `find.ts:114-116`: `if (isObject(access.readFilter)) queryFilter.filters.push(access.readFilter)`
- **Critical**: Each module's readFilter is applied to its own sub-query independently

### Layer 4 -- Field-Level Permissions

**Function**: `getFieldPermissions(metaAccess, fieldName)` in `accessUtils.ts:32-78`

- For each field in the module metadata, checks if `access.fields[fieldName].READ.allow === true`
- Falls back to `metaAccess.fieldDefaults.isReadable`
- If a field is NOT readable: it is **removed from the MongoDB projection** (never fetched from DB)
- Applied per-module: relation fields are checked against the relation module's access profile

### Layer 5 -- Field-Level Conditional Access

**Functions**: `getFieldConditions(metaAccess, fieldName)` + `filterConditionToFn()` in `accessUtils.ts:11-28`

- Some fields have READ conditions: `access.fields[fieldName].READ.condition`
- Converted to runtime functions via `filterConditionToFn()`
- After MongoDB returns data, each record is evaluated against these conditions
- If condition returns `false` for a record, the field is **stripped from that specific record**
- Applied via `ApplyFieldPermissionsTransform` on each relation's data **BEFORE** aggregation

### Layer 6 -- `removeUnauthorizedDataForRead()`

**Function**: `removeUnauthorizedDataForRead()` in `accessUtils.ts:136-162`

- Final safety net (defense-in-depth)
- Re-checks all field permissions as whitelist
- Applied as last step before aggregator processing

### Security Invariant

The cross-module query engine MUST:

1. Call `buildFindQuery()` (or equivalent) for each authorized module
2. Never allow a relation to expose records filtered by another module's `readFilter`
3. Never allow a projection to include fields the user cannot read
4. Apply field conditions (Layer 5) on each module's data BEFORE aggregation
5. Set all aggregator fields to `null` for unauthorized relations (not expose partial data)
6. Log security-relevant decisions for audit purposes

---

## 4. JSON Query Format (Recursive Relations with Zod Schema)

### Design Principle

The JSON query is a **standard find call** with an added `relations` array. Each relation is also a find-like sub-query with its own `filter`, `fields`, `sort`, `limit`, and `aggregators`. Relations can be **recursively nested** to follow chains of lookups.

**Join conditions are inferred from lookup metadata.** The `lookup` field in a relation specifies which lookup field in the related document points to the parent. For example, if `Opportunity` has a field `contact` of type `lookup` pointing to `Contact`, then `"lookup": "contact"` tells the engine that `Opportunity.contact._id = Contact._id`. No explicit `on` clause is needed, though one can optionally be provided.

### Complete Zod Schema

```typescript
import { z } from 'zod';
import { KonFilter } from '../model/Filter';

// --- Aggregator ---
const AggregatorEnum = z.enum([
  'count', 'sum', 'avg', 'min', 'max',
  'first', 'last', 'push', 'addToSet',
]);

const AggregatorSchema = z.object({
  aggregator: AggregatorEnum,
  field: z.string().optional()
    .describe('Source field for non-count aggregators. For push/first/last, omit to use full record.'),
});

// --- Optional explicit join condition (normally inferred from lookup) ---
const ExplicitJoinCondition = z.object({
  left: z.string().describe('Field path in parent module, e.g. "_id"'),
  right: z.string().describe('Field path in relation module, e.g. "contact._id"'),
}).optional().describe('Override automatic lookup-based join. Normally not needed.');

// --- Relation (recursive) ---
const RelationSchema: z.ZodType<any> = z.object({
  document: z.string().describe('Related module name, e.g. "Opportunity"'),
  lookup: z.string().describe('Lookup field in the related document that points to parent, e.g. "contact"'),
  on: ExplicitJoinCondition,

  // Sub-find parameters (same names as find API)
  filter: KonFilter.optional().describe('KonFilter for this relation (exact same syntax as find)'),
  fields: z.string().optional().describe('Comma-separated field names, same as find'),
  sort: z.union([
    z.string(),
    z.array(z.object({
      property: z.string(),
      direction: z.enum(['ASC', 'DESC']).default('ASC'),
    })),
  ]).optional(),
  limit: z.number().int().min(1).max(100_000).optional()
    .describe('Max records for this relation. Default: 1000'),
  start: z.number().int().min(0).optional(),

  // Aggregators
  aggregators: z.record(z.string(), AggregatorSchema).min(1)
    .describe('Map of output field name -> aggregator config'),

  // Recursive nesting
  relations: z.lazy(() => z.array(RelationSchema)).optional()
    .describe('Nested sub-relations for recursive lookup chains'),
});

// --- Main Query Schema ---
const CrossModuleQuerySchema = z.object({
  // Primary document (same names as find API)
  document: z.string().describe('Primary module name, e.g. "Contact"'),
  filter: KonFilter.optional().describe('KonFilter for primary document (exact same syntax as find)'),
  fields: z.string().optional().describe('Comma-separated field names for primary document'),
  sort: z.union([
    z.string(),
    z.array(z.object({
      property: z.string(),
      direction: z.enum(['ASC', 'DESC']).default('ASC'),
    })),
  ]).optional(),
  limit: z.number().int().min(1).max(100_000).default(1000),
  start: z.number().int().min(0).default(0),

  // Relations
  relations: z.array(RelationSchema).min(1).max(10)
    .describe('Cross-module relations with aggregators'),

  // Response options
  includeTotal: z.boolean().default(false),
  includeMeta: z.boolean().default(true),
});
```

### How Lookup Resolution Works

When the engine receives `"lookup": "contact"` in a relation with `"document": "Opportunity"`:

1. Read `Opportunity` metadata from `MetaObject.Meta`
2. Find field `contact` -- it has `type: "lookup"`, `document: "Contact"`
3. The join condition is: `Opportunity.contact._id = <parent record>._id`
4. For each batch of parent records, build: `{ "contact._id": { "$in": [parentId1, parentId2, ...] } }`
5. Merge with relation's `filter` and `readFilter` via `$and`

This is the same join pattern that already exists in the MetaObject `relations` definition (see `Contact.json` relations, `relationReference.ts`).

### Aggregator Semantics

| Aggregator | Input | Output | Description |
|-----------|-------|--------|-------------|
| `count` | -- | `number` | Count of matching records |
| `sum` | `field` | `number` | Sum of numeric field |
| `avg` | `field` | `number` | Average of numeric field |
| `min` | `field` | `any` | Minimum value of field |
| `max` | `field` | `any` | Maximum value of field |
| `first` | `field` (optional) | `object` or `any` | First record (per `sort`); if `field` given, returns that field only |
| `last` | `field` (optional) | `object` or `any` | Last record (per `sort`); if `field` given, returns that field only |
| `push` | `field` (optional) | `array` | All records (or field values) as array. Respects `limit`. |
| `addToSet` | `field` | `array` | Unique values of field |

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| `document` (not `from`) | Consistent with find API |
| `filter` (not `where`) | Exact same KonFilter syntax as find |
| `fields` (not `select`) | Same name as find API |
| `lookup` infers join condition | Metadata already defines relationships; DRY |
| Optional `on` clause | Flexibility for non-standard joins |
| `push` (not `collect`) | Matches MongoDB `$push` naming convention |
| Recursive `relations` | Enables chains: Contact -> Opportunity -> PPO -> Product |
| Per-relation `limit` | Each relation has independent result size control |
| Per-relation `sort` | Critical for `first`/`last` aggregators |

---

## 5. SQL Interface (ANSI SQL Subset)

### Supported Grammar

```
query := SELECT select_list FROM table_ref join_clause* where_clause? group_clause? having_clause? order_clause? limit_clause?

select_list := select_item (',' select_item)*
select_item := aggregate_fn '(' field_ref ')' (AS alias)?
             | field_ref (AS alias)?
             | '*'

aggregate_fn := COUNT | SUM | AVG | MIN | MAX | FIRST | LAST | PUSH | ADDTOSET

field_ref := module_name '.' field_path | field_path
module_name := identifier
field_path := identifier ('.' identifier)*

table_ref := module_name (AS? alias)?

join_clause := join_type JOIN module_name (AS? alias)? ON join_condition
join_type := INNER | LEFT (OUTER)? | RIGHT (OUTER)? | CROSS

join_condition := field_ref '=' field_ref

where_clause := WHERE condition
condition := field_ref operator value
           | condition AND condition
           | condition OR condition
           | '(' condition ')'

operator := '=' | '!=' | '<>' | '<' | '>' | '<=' | '>='
          | LIKE | IN | NOT IN | IS NULL | IS NOT NULL | BETWEEN

group_clause := GROUP BY field_ref (',' field_ref)*
having_clause := HAVING condition

order_clause := ORDER BY order_item (',' order_item)*
order_item := field_ref (ASC | DESC)?

limit_clause := LIMIT number (OFFSET number)?
```

### SQL to Relations Translation

The SQL parser (`node-sql-parser`) produces an AST that is translated to the recursive relations IQR:

1. `FROM` clause -> `document` (primary module)
2. Each `JOIN` clause -> entry in `relations` array:
   - `JOIN ... ON a._id = b.contact._id` -> engine finds the lookup field `contact` in module `b` that points to `a`, sets `lookup: "contact"`
   - `WHERE` conditions referencing a relation module -> moved to that relation's `filter`
   - `WHERE` conditions referencing the primary module -> stays in root `filter`
3. Aggregate functions in `SELECT` -> `aggregators` in the appropriate relation
4. Non-aggregate fields in `SELECT` -> `fields` at root or relation level
5. `ORDER BY` -> `sort` at root level
6. `LIMIT` / `OFFSET` -> `limit` / `start` at root level
7. Nested JOINs (A JOIN B ON ... JOIN C ON B.x = C.y) -> nested `relations` (B has C as sub-relation)

### NOT Supported (Phase 1)

| Feature | Reason |
|---------|--------|
| Subqueries | Complexity; planned for Phase 3 |
| UNION / INTERSECT | Complexity; planned for Phase 3 |
| DDL (CREATE, ALTER, DROP) | Security: read-only API |
| DML (INSERT, UPDATE, DELETE) | Security: read-only API |
| Window functions | Complexity; may be added in Phase 4 |
| CTEs (WITH clause) | Complexity; planned for Phase 3 |

### Parser: `node-sql-parser`

- **Library**: `node-sql-parser` (npm) -- parses SQL into AST
- **Translation**: AST is traversed to produce the Internal Query Representation (IQR), which is the recursive relations format
- **Whitelist validation**: `parser.whiteListCheck()` ensures only allowed tables (Konecty modules) are referenced
- **Security**: Only SELECT statements are accepted; any DDL/DML triggers an immediate error
- **Lookup inference**: The translator uses module metadata to find the `lookup` field that connects two modules, rather than requiring the user to know the internal join path

**Implementation reference**: Use Context7 for `node-sql-parser` documentation: `resolve-library-id("node-sql-parser")` then `query-docs("How to parse SQL SELECT with JOIN into AST")`.

---

## 6. Execution Strategy (Recursive)

### Execution Flow

```
                    +------------------+
                    |  JSON or SQL     |
                    |  Input           |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Parse & Validate |
                    |  -> IQR           |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Auth (Layer 1)   |
                    |  getUserSafe()    |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Primary find()   |
                    |  Layers 2-5       |
                    |  (MUST authorize) |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Batch primary    |
                    |  records          |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
    +---------v------+ +----v-------+ +----v-------+
    | Relation A     | | Relation B | | Relation C |
    | getAccessFor() | | (denied)   | | (ok)       |
    | -> find()      | | -> null    | | -> find()  |
    | -> aggregate   | |            | | -> recurse |
    +----------------+ +------------+ +----+-------+
                                           |
                                    +------v-------+
                                    | Sub-relation |
                                    | C1: find()   |
                                    | -> aggregate |
                                    +--------------+
                             |
                    +--------v---------+
                    | Merge aggregator |
                    | results into     |
                    | primary records  |
                    +--------+---------+
                             |
                    +--------v---------+
                    | Stream NDJSON    |
                    | Response         |
                    +------------------+
```

### Detailed Steps

1. **Parse & validate** the query (JSON directly or SQL -> AST -> IQR)
2. **Authenticate** the user (Layer 1, once)
3. **Primary document find**: call `buildFindQuery()` with full security (Layers 2-5), execute `findStream()` with secondary read preference
4. **Batch processing**: collect primary records in batches of `STREAM_BATCH_SIZE` (1000)
5. **For each relation** in the current level:
   - a. Call `getAccessFor(relation.document, user)`. If **denied**: set all aggregator fields to `null` for this batch, log warning, **skip** this relation.
   - b. Extract join keys from parent batch (e.g., all `_id` values)
   - c. Build sub-query: `{ "contact._id": { "$in": [key1, key2, ...] } }` merged with relation's `filter` and the user's `readFilter` via `$and`
   - d. Execute `findStream()` on relation document with its own `fields`, `sort`, `limit`
   - e. Apply field permissions + conditions (Layers 4-5) via Transform streams
   - f. If relation has **nested `relations`**: recurse (step 5) with current relation's results as the new "parent"
   - g. Apply **aggregators** (`count`/`push`/`first`/etc.) to group results by parent record
   - h. Merge aggregator values into each parent record
6. **Stream** NDJSON response with enriched records

### Batched `$in` Strategy

For large datasets, the engine processes in batches to avoid unbounded memory:

```typescript
const BATCH_SIZE = 1000;

// Collect parent IDs in batches
for (const batch of chunk(primaryRecords, BATCH_SIZE)) {
  const parentIds = batch.map(r => r._id);

  // One $in query per relation per batch
  const relationFilter = {
    match: 'and',
    conditions: [
      { term: `${lookup}._id`, operator: 'in', value: parentIds },
      ...relation.filter?.conditions ?? [],
    ],
  };

  const relationResults = await findStream({
    document: relation.document,
    filter: relationFilter,
    fields: relation.fields,
    sort: relation.sort,
    limit: relation.limit,
    // ... security layers applied inside findStream
  });

  // Group by parent ID and apply aggregators
  const grouped = groupByParentId(relationResults, lookup);
  batch.forEach(record => {
    mergeAggregators(record, grouped[record._id], relation.aggregators);
  });
}
```

This is the same pattern used in `pivotStream.ts` for populating lookup fields.

---

## 7. Python Bridge for Join Processing

### Established Pattern

The Konecty backend has a proven Python bridge architecture documented in ADR-0006, ADR-0007, and ADR-0008, with three existing implementations:

| Implementation | Script | Purpose |
|---------------|--------|---------|
| `pivotStream.ts` | `pivot_table.py` (569 lines) | Pivot tables with Polars |
| `graphStream.ts` | `graph_generator.py` (915 lines) | SVG charts with Polars + Pandas/matplotlib |
| `kpiStream.ts` | `kpi_aggregator.py` (222 lines) | KPI aggregations with Polars |

All follow the same 7-step orchestration:

```
Step 1: findStream() per module (security, field permissions, secondary reads)
Step 2: Collect NDJSON data from stream into array
Step 3: Populate lookup fields (batch fetch by _id)
Step 4: Spawn Python process via uv run --script
Step 5: Send JSON-RPC config as first stdin line
Step 6: Send NDJSON data lines to stdin, then close stdin
Step 7: Read JSON-RPC response + result from stdout
```

### Single Aggregation Engine (YAGNI/DRY Decision)

Per YAGNI and DRY principles, **all aggregation is handled exclusively by Python/Polars**. There is no separate JS aggregation layer. This decision:

- Eliminates maintaining the same 9 aggregators in two languages
- Provides a single code path in the orchestrator (no conditional threshold logic)
- Ensures consistency: the same aggregation engine is used for all dataset sizes
- Follows the established pattern already used by pivot tables, graphs, and KPI widgets

The subprocess overhead for small datasets (~200-500ms) is acceptable given the simplicity gains. If profiling later reveals this is a bottleneck, a JS fast path can be added as an optimization.

### Proposed: `cross_module_join.py`

A new script at `src/scripts/python/cross_module_join.py` using Polars for:

- **Receiving multiple datasets**: Each module's data arrives tagged with `_dataset` field
- **Performing aggregations**: GROUP BY with COUNT, SUM, AVG, MIN, MAX, PUSH (list), ADDTOSET (unique)
- **Returning results**: NDJSON streamed back to Node.js

### Proposed Protocol

```
stdin line 1:  {"jsonrpc":"2.0","method":"aggregate","params":{"config":{
  "parentDataset": "Contact",
  "relations": [
    {
      "dataset": "Opportunity",
      "parentKey": "_id",
      "childKey": "contact._id",
      "aggregators": {
        "activeOpportunities": {"aggregator":"count"},
        "opportunities": {"aggregator":"push"}
      }
    }
  ]
}}}

stdin line 2:  {"_dataset":"Contact","_id":"c1","code":1001,"name":{"full":"Alice"}}\n
stdin line 3:  {"_dataset":"Contact","_id":"c2","code":1002,"name":{"full":"Bruno"}}\n
stdin line 4:  {"_dataset":"Opportunity","_id":"o1","contact":{"_id":"c1"},"status":"Nova","code":5001}\n
stdin line 5:  {"_dataset":"Opportunity","_id":"o2","contact":{"_id":"c1"},"status":"Em Visitacao","code":5002}\n
stdin line 6:  {"_dataset":"Opportunity","_id":"o3","contact":{"_id":"c2"},"status":"Nova","code":5003}\n
stdin EOF

stdout line 1: {"jsonrpc":"2.0","result":"ok"}
stdout line 2: {"code":1001,"name":{"full":"Alice"},"activeOpportunities":2,"opportunities":[{"_id":"o1","status":"Nova","code":5001},{"_id":"o2","status":"Em Visitacao","code":5002}]}\n
stdout line 3: {"code":1002,"name":{"full":"Bruno"},"activeOpportunities":1,"opportunities":[{"_id":"o3","status":"Nova","code":5003}]}\n
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| `_dataset` tag per record | Separates data from multiple modules in a single NDJSON stream |
| Polars for aggregation | 3-10x faster than pure JS for large datasets (ADR-0008) |
| NDJSON output | Allows streaming back to Node.js; memory-efficient |
| `push` via Polars `list()` | Groups related records into arrays efficiently |
| PEP 723 inline metadata | No separate pyproject.toml needed (ADR-0006) |
| Reuses `pythonStreamBridge.ts` | No new bridge code needed |
| Security before Python | Python never touches MongoDB; only pre-filtered data |

---

## 8. Streaming and Performance

### Read Preference

Per ADR-0005, all queries MUST use secondary nodes:

```typescript
const hasSecondaries = await hasSecondaryNodes();
const readPreference = hasSecondaries ? 'secondary' : 'secondaryPreferred';
```

### MongoDB Configuration

Per existing `streamConstants.ts`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `STREAM_BATCH_SIZE` | 1000 | Optimal batch size for cursor streaming |
| `STREAM_MAX_TIME_MS` | 300,000 (5 min) | Maximum query execution time |
| `allowDiskUse` | `true` | Enables disk-based sorting for large result sets |

### Backpressure

- Node.js `pipe()` mechanism handles backpressure automatically between MongoDB cursor stream and Transform streams
- Python process stdin/stdout also respects OS-level pipe buffering
- `highWaterMark` can be tuned on Transform streams if needed

### Memory Management

| Strategy | Implementation |
|----------|---------------|
| Batched processing | Primary records processed in batches of 1000 |
| Per-relation limits | Each relation has its own `limit` (default: 1000) |
| Configurable max | `CROSS_QUERY_MAX_RECORDS` env variable (default: 100,000) |
| Python memory | Polars uses Apache Arrow columnar format (memory-efficient) |
| Cleanup | Kill Python process on error (same pattern as `pivotStream.ts`) |

### Warnings

The `_meta` first line should include warnings for:

- `RELATION_ACCESS_DENIED`: User lacks access to a relation module (fields set to null)
- `LIMIT_REACHED`: Result was truncated due to `limit` or `CROSS_QUERY_MAX_RECORDS`
- `MISSING_INDEX`: Lookup/join key field lacks an index (query may be slow)
- `LARGE_DATASET`: One or more modules returned > 50,000 records

---

## 9. Implementation Files

### New Files

| File | Purpose |
|------|---------|
| `src/imports/data/api/crossModuleQuery.ts` | Main recursive query engine orchestrator |
| `src/imports/data/api/crossModuleQueryValidator.ts` | Zod schema validation for JSON queries |
| `src/imports/data/api/sqlToRelationsParser.ts` | SQL-to-IQR translator using `node-sql-parser` (Phase 2) |
| `src/imports/types/crossModuleQuery.ts` | TypeScript types and Zod schemas for query format |
| `src/server/routes/rest/query/queryApi.ts` | Fastify route definitions |
| `src/scripts/python/cross_module_join.py` | Polars-based aggregation script |

### Reused Existing Code

| File | What is reused |
|------|---------------|
| `src/imports/data/api/findUtils.ts` | `buildFindQuery()` for per-module query building |
| `src/imports/data/api/findStream.ts` | `findStream()` for secure streaming per module |
| `src/imports/data/api/streamTransforms.ts` | `ApplyFieldPermissionsTransform`, `ApplyDateToStringTransform` |
| `src/imports/data/api/pythonStreamBridge.ts` | `createPythonProcess()`, `sendRPCRequest()`, etc. |
| `src/imports/utils/accessUtils.ts` | `getAccessFor()`, `getFieldPermissions()`, `getFieldConditions()` |
| `src/imports/data/filterUtils.js` | `parseFilterObject()`, `filterConditionToFn()` |
| `src/imports/data/api/streamConstants.ts` | `STREAM_BATCH_SIZE`, `STREAM_MAX_TIME_MS` |
| `src/imports/model/Relation.ts` | `RelationSchema` for reference |

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `node-sql-parser` | latest | SQL parsing to AST |
| `zod` | (already in project) | Query validation |

---

## 10. Rich Real-World Examples

All examples use actual metadata from `src/private/metadata` and `foxter-metas/MetaObjects`. Each example shows the JSON query (relations format) and its SQL equivalent.

### Example 1: Product + ProductsPerOpportunities (push aggregator)

**Use case**: "Get Product fFaJkGaWAdDhvcPH6 and all its related offers"

**Metadata basis**: `ProductsPerOpportunities.product` is a lookup to `Product` with `descriptionFields: ["code", "type", "sale", "address"]`.

**JSON Query**:

```json
{
  "document": "Product",
  "filter": {
    "match": "and",
    "conditions": [
      { "term": "_id", "operator": "equals", "value": "fFaJkGaWAdDhvcPH6" }
    ]
  },
  "fields": "code,type",
  "limit": 1,
  "relations": [
    {
      "document": "ProductsPerOpportunities",
      "lookup": "product",
      "fields": "status,situation,rating,contact",
      "sort": [{ "property": "_createdAt", "direction": "DESC" }],
      "limit": 100,
      "aggregators": {
        "offers": { "aggregator": "push" },
        "offerCount": { "aggregator": "count" }
      }
    }
  ]
}
```

**SQL Equivalent**:

```sql
SELECT p.code, p.type,
       PUSH(ppo.*) AS offers,
       COUNT(ppo._id) AS offerCount
  FROM Product p
 INNER JOIN ProductsPerOpportunities ppo ON p._id = ppo.product._id
 WHERE p._id = 'fFaJkGaWAdDhvcPH6'
 GROUP BY p.code, p.type
 LIMIT 1
```

**Expected Response**:

```json
{"code":123,"type":"Apartamento","offers":[{"_id":"x1","status":"Ofertado","situation":"Visita","rating":4,"contact":{"_id":"c1","name":{"full":"John Doe"}}},{"_id":"x2","status":"Visitado","situation":"Proposta","rating":5,"contact":{"_id":"c2","name":{"full":"Jane Doe"}}}],"offerCount":2}
```

---

### Example 2: Contact + Opportunity (count aggregator)

**Use case**: "How many active opportunities does each contact have?"

**Metadata basis**: `Opportunity.contact` is a lookup to `Contact`. Contact metadata already defines this as a `relations` aggregator (`activeOpportunities: count`).

**JSON Query**:

```json
{
  "document": "Contact",
  "fields": "code,name",
  "sort": [{ "property": "name.full", "direction": "ASC" }],
  "limit": 1000,
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "contact",
      "filter": {
        "match": "and",
        "conditions": [
          { "term": "status", "operator": "in", "value": ["Nova", "Ofertando Imveis", "Em Visitacao"] }
        ]
      },
      "aggregators": {
        "activeOpportunities": { "aggregator": "count" }
      }
    }
  ]
}
```

**SQL Equivalent**:

```sql
SELECT ct.code, ct.name,
       COUNT(o._id) AS activeOpportunities
  FROM Contact ct
 INNER JOIN Opportunity o ON ct._id = o.contact._id
 WHERE o.status IN ('Nova', 'Ofertando Imveis', 'Em Visitacao')
 GROUP BY ct.code, ct.name
 ORDER BY ct.name ASC
 LIMIT 1000
```

**Expected Response**:

```json
{"code":1001,"name":{"full":"Alice Santos"},"activeOpportunities":3}
{"code":1002,"name":{"full":"Bruno Silva"},"activeOpportunities":1}
```

---

### Example 3: Contact + Opportunity + ProductsPerOpportunities (recursive relations, 3-level chain)

**Use case**: "For each contact, get their opportunities with product offers -- a 3-level recursive chain"

**Lookup chain**: `Contact <- Opportunity.contact <- ProductsPerOpportunities.opportunity`

**JSON Query**:

```json
{
  "document": "Contact",
  "filter": {
    "match": "and",
    "conditions": [
      { "term": "status", "operator": "equals", "value": "active" }
    ]
  },
  "fields": "code,name",
  "limit": 100,
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "contact",
      "filter": {
        "match": "and",
        "conditions": [
          { "term": "status", "operator": "in", "value": ["Nova", "Em Visitacao"] }
        ]
      },
      "fields": "code,status,label",
      "sort": [{ "property": "_createdAt", "direction": "DESC" }],
      "limit": 20,
      "aggregators": {
        "opportunities": { "aggregator": "push" },
        "opportunityCount": { "aggregator": "count" }
      },
      "relations": [
        {
          "document": "ProductsPerOpportunities",
          "lookup": "opportunity",
          "fields": "status,rating,product",
          "limit": 50,
          "aggregators": {
            "products": { "aggregator": "push" },
            "productCount": { "aggregator": "count" }
          }
        }
      ]
    }
  ]
}
```

**SQL Equivalent**:

```sql
SELECT ct.code, ct.name,
       o.code AS opp_code, o.status AS opp_status, o.label,
       ppo.status AS ppo_status, ppo.rating, ppo.product
  FROM Contact ct
 INNER JOIN Opportunity o ON ct._id = o.contact._id
 INNER JOIN ProductsPerOpportunities ppo ON o._id = ppo.opportunity._id
 WHERE ct.status = 'active'
   AND o.status IN ('Nova', 'Em Visitacao')
 ORDER BY o._createdAt DESC
 LIMIT 100
```

**Expected Response** (nested structure from recursive relations):

```json
{"code":1001,"name":{"full":"Alice Santos"},"opportunityCount":2,"opportunities":[{"code":5001,"status":"Nova","label":"Apt 301","productCount":2,"products":[{"status":"Ofertado","rating":4,"product":{"_id":"p1","code":123}},{"status":"Visitado","rating":5,"product":{"_id":"p2","code":456}}]},{"code":5002,"status":"Em Visitacao","label":"Casa 12","productCount":0,"products":[]}]}
```

---

### Example 4: Activity + Product (with null lookup -- activities without product)

**Use case**: "List all activities, including those without a linked product"

**Metadata basis**: `Activity.product` is a lookup to `Product`. Not all activities have a product linked.

**JSON Query**:

```json
{
  "document": "Activity",
  "filter": {
    "match": "and",
    "conditions": [
      { "term": "status", "operator": "in", "value": ["new", "in-progress"] }
    ]
  },
  "fields": "code,subject,status",
  "sort": [{ "property": "_createdAt", "direction": "DESC" }],
  "limit": 200,
  "relations": [
    {
      "document": "Product",
      "lookup": "product",
      "fields": "code,sale",
      "limit": 1,
      "aggregators": {
        "productCode": { "aggregator": "first", "field": "code" },
        "productSale": { "aggregator": "first", "field": "sale" }
      }
    }
  ]
}
```

**SQL Equivalent**:

```sql
SELECT a.code, a.subject, a.status,
       FIRST(p.code) AS productCode,
       FIRST(p.sale) AS productSale
  FROM Activity a
  LEFT JOIN Product p ON a.product._id = p._id
 WHERE a.status IN ('new', 'in-progress')
 ORDER BY a._createdAt DESC
 LIMIT 200
```

**Expected Response** (activities without product get `null` for product aggregators):

```json
{"code":8001,"subject":"Call about apartment","status":"in-progress","productCode":123,"productSale":{"value":450000,"currency":"BRL"}}
{"code":8002,"subject":"Follow-up email","status":"new","productCode":null,"productSale":null}
```

---

### Example 5: Campaign + Opportunity (count + first aggregators)

**Use case**: "For each campaign, count opportunities and get the most recent one"

**Metadata basis**: `Opportunity.campaign` is a lookup to `Campaign` with `descriptionFields: ["code", "name", "type"]`.

**JSON Query**:

```json
{
  "document": "Campaign",
  "filter": {
    "match": "and",
    "conditions": [
      { "term": "status", "operator": "equals", "value": "Ativo" }
    ]
  },
  "fields": "code,name,type",
  "limit": 50,
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "campaign",
      "sort": [{ "property": "_createdAt", "direction": "DESC" }],
      "aggregators": {
        "totalOpportunities": { "aggregator": "count" },
        "newestOpportunity": { "aggregator": "first" },
        "avgValue": { "aggregator": "avg", "field": "value" }
      }
    }
  ]
}
```

**SQL Equivalent**:

```sql
SELECT c.code, c.name, c.type,
       COUNT(o._id) AS totalOpportunities,
       FIRST(o.*) AS newestOpportunity,
       AVG(o.value) AS avgValue
  FROM Campaign c
 INNER JOIN Opportunity o ON c._id = o.campaign._id
 WHERE c.status = 'Ativo'
 GROUP BY c.code, c.name, c.type
 ORDER BY o._createdAt DESC
 LIMIT 50
```

**Expected Response**:

```json
{"code":301,"name":"Summer 2026","type":"Digital","totalOpportunities":45,"newestOpportunity":{"_id":"o99","code":5099,"status":"Nova","label":"Lead #5099"},"avgValue":250000}
```

---

### Example 6: Contact + Message (max aggregator, mirrors existing relations)

**Use case**: "Last email sent to each contact"

**Metadata basis**: `Message.contact` is a lookup to `Contact`. Contact metadata already defines this as a `relations` aggregator: `lastTouch: { aggregator: "max", field: "_createdAt" }`.

**JSON Query**:

```json
{
  "document": "Contact",
  "fields": "code,name",
  "sort": [{ "property": "name.full", "direction": "ASC" }],
  "limit": 1000,
  "relations": [
    {
      "document": "Message",
      "lookup": "contact",
      "filter": {
        "match": "and",
        "conditions": [
          { "term": "type", "operator": "equals", "value": "Email" },
          { "term": "status", "operator": "equals", "value": "Enviada" }
        ]
      },
      "aggregators": {
        "lastEmailSentAt": { "aggregator": "max", "field": "_createdAt" },
        "totalEmailsSent": { "aggregator": "count" }
      }
    }
  ]
}
```

**SQL Equivalent**:

```sql
SELECT ct.code, ct.name,
       MAX(m._createdAt) AS lastEmailSentAt,
       COUNT(m._id) AS totalEmailsSent
  FROM Contact ct
  LEFT JOIN Message m ON ct._id = m.contact._id
 WHERE m.type = 'Email'
   AND m.status = 'Enviada'
 GROUP BY ct.code, ct.name
 ORDER BY ct.name ASC
 LIMIT 1000
```

**Expected Response**:

```json
{"code":1001,"name":{"full":"Alice Santos"},"lastEmailSentAt":"2026-02-09T14:30:00.000Z","totalEmailsSent":12}
{"code":1002,"name":{"full":"Bruno Silva"},"lastEmailSentAt":"2026-01-15T09:00:00.000Z","totalEmailsSent":3}
{"code":1003,"name":{"full":"Carlos Mendes"},"lastEmailSentAt":null,"totalEmailsSent":0}
```

---

### Example 7: Security-Aware Example (Graceful Degradation)

**Use case**: "A broker queries their opportunities with product data -- but lacks access to Product module"

**Scenario**:
- User is a broker with access profile "Corretor"
- `Opportunity:access:Corretor` defines `readFilter: { conditions: [{ term: "_user._id", operator: "equals", value: "$user" }] }`
- User has **no access** to `Product` module (`getAccessFor('Product', user)` returns `false`)

**JSON Query**:

```json
{
  "document": "Opportunity",
  "fields": "code,status,label",
  "sort": [{ "property": "_createdAt", "direction": "DESC" }],
  "limit": 100,
  "relations": [
    {
      "document": "Product",
      "lookup": "product",
      "fields": "code,sale",
      "aggregators": {
        "productCode": { "aggregator": "first", "field": "code" },
        "productSale": { "aggregator": "first", "field": "sale" }
      }
    }
  ]
}
```

**What happens internally**:

1. **Layer 1**: User authenticated as "Corretor"
2. **Layer 2 (primary)**: `getAccessFor('Opportunity', user)` returns "Corretor" access -- **OK, query proceeds**
3. **Layer 3**: Opportunity's `readFilter` is merged -- broker only sees their own opportunities (`_user._id = $user`)
4. **Layer 2 (relation)**: `getAccessFor('Product', user)` returns `false` -- **relation skipped, aggregators set to null**
5. **Warning**: `_meta.warnings` includes `{ "type": "RELATION_ACCESS_DENIED", "document": "Product" }`

**Expected Response** (broker sees their opportunities; product fields are null):

```json
{"_meta":{"document":"Opportunity","relations":["Product"],"warnings":[{"type":"RELATION_ACCESS_DENIED","document":"Product","message":"User lacks read access to Product"}]}}
{"code":5001,"status":"Nova","label":"Apt 301 - Centro","productCode":null,"productSale":null}
{"code":5002,"status":"Em Visitacao","label":"Casa 12 - Praia","productCode":null,"productSale":null}
```

**Contrast with old behavior**: In the previous RFC design, this query would have been **entirely rejected** because the user lacked access to Product. With graceful degradation, the broker still gets their opportunity data.

---

## 11. Implementation Phases

### Phase 1 (MVP)

- JSON query endpoint (`POST /rest/query/json`)
- Recursive relations with lookup-inferred joins
- Max 2 levels of nesting, max 5 relations total
- All aggregators: `count`, `sum`, `avg`, `min`, `max`, `first`, `last`, `push`, `addToSet`
- Full security with graceful degradation
- Per-relation `filter`, `fields`, `sort`, `limit`
- Python bridge as single aggregation engine (YAGNI/DRY)
- NDJSON streaming response
- Zod validation for query input

### Phase 2

- SQL query endpoint (`POST /rest/query/sql`)
- `node-sql-parser` integration
- SQL-to-relations IQR translation
- Unlimited nesting depth (configurable)
- GROUP BY / HAVING support in SQL interface
- Query plan logging for debugging

### Phase 3

- CROSS JOIN support with mandatory warnings
- Subqueries (in SQL WHERE clause)
- UNION support in SQL
- Python bridge for complex statistical aggregations
- Query timeout and cancellation

### Phase 4

- Query plan caching
- Query optimizer (relation order optimization based on cardinality)
- Index suggestion warnings
- MongoDB `$lookup` pipeline as alternative execution strategy
- Performance dashboard / query analytics

---

## 12. Testing Strategy

Per ADR-0003 (Testing Strategy with Jest and Supertest):

### Unit Tests

- **SQL parser**: AST translation for each SQL feature -> relations IQR
- **JSON query validator**: Zod schema validation for valid/invalid queries
- **Lookup resolution**: Correct join condition inference from metadata
- **Aggregator logic**: Each aggregator produces correct results
- **Filter extraction**: Correct per-module filter splitting

### Integration Tests (with MongoDB Memory Server)

- **Full query execution**: End-to-end with actual MongoDB collections
- **Security tests**: Verify unauthorized relation fields are null (not error), readFilters applied per module
- **Recursive relations**: 2-3 level deep chains produce correct nested results
- **Aggregation correctness**: All 9 aggregators produce correct values
- **Edge cases**: Empty relations, null lookup fields, single-module queries with no relations

### Python Tests

- **`cross_module_join.py`**: Unit tests with pytest
- **Aggregation operations**: Verify Polars aggregation matches expected results
- **Edge cases**: Empty datasets, null group keys

---

## 13. Research References for Implementors

When implementing this RFC, developers should use the following tools:

### Context7

Use Context7 (`resolve-library-id` + `query-docs`) for up-to-date documentation:

1. **`node-sql-parser`**: "How to parse SQL SELECT with JOIN into AST in node-sql-parser"
2. **MongoDB Node.js Driver**: "How to use $lookup in aggregation pipeline with readPreference secondary"
3. **Zod**: "How to create recursive schemas with z.lazy for nested filter conditions"
4. **Fastify**: "How to stream NDJSON responses in Fastify with proper Content-Type"
5. **Polars (Python)**: "How to perform DataFrame join with different join types in Polars"

### Perplexity Searches

Use Perplexity for architectural research:

1. "node-sql-parser SQL to AST translation TypeScript examples 2026"
2. "MongoDB $lookup cross-collection security RBAC streaming best practices 2026"
3. "Node.js Transform stream backpressure cross-collection join patterns"
4. "ANSI SQL subset safe parser whitelist validation security"
5. "Polars Python DataFrame aggregation group_by push list performance 2026"
6. "NDJSON streaming API design best practices HTTP backpressure"

---

## 14. Open Questions

1. **Max nesting depth**: Should we limit recursive relation depth to 3 levels in Phase 1?
2. **Query timeout**: Should the cross-module query have a different `maxTimeMS` than findStream (currently 5 min)?
3. **Audit logging**: Should we log the full IQR for audit purposes, or just the modules and user?
4. **Rate limiting**: Should the query endpoints have stricter rate limits than regular find?
5. ~~**Python threshold**~~: **Resolved** -- Always use Python/Polars (YAGNI/DRY). No JS aggregation layer. See Section 7.
6. **Relation without aggregator**: Should we allow a relation with only nested sub-relations and no aggregators of its own (pass-through)?

---

## References

- [ADR-0001: HTTP Streaming for Data Retrieval](../adr/0001-http-streaming-for-data-retrieval.md)
- [ADR-0002: Common Logic Extraction to findUtils](../adr/0002-common-logic-extraction-to-find-utils.md)
- [ADR-0003: Node Transform Streams for Sequential Processing](../adr/0003-node-transform-streams-for-sequential-processing.md)
- [ADR-0005: Mandatory Secondary Nodes for Reading](../adr/0005-mandatory-secondary-nodes-for-reading.md)
- [ADR-0006: Python Integration for Pivot Tables](../adr/0006-python-integration-for-pivot-tables.md)
- [ADR-0007: Hierarchical Pivot Output Format](../adr/0007-hierarchical-pivot-output-format.md)
- [ADR-0008: Graph Endpoint with Polars and Pandas](../adr/0008-graph-endpoint-with-polars-pandas.md)
- [ADR-0010: Code Patterns](../adr/0010-code-patterns.md)
- [MetaObject Relations Pattern](../../src/private/metadata/Contact.json) (lines 339-403)
- [Relation Schema](../../src/imports/model/Relation.ts)
- [node-sql-parser (npm)](https://www.npmjs.com/package/node-sql-parser)
- [Polars Documentation](https://pola.rs/)
- [Fastify Streaming](https://fastify.dev/docs/latest/Reference/Reply/#streams)

---

_Authors: Konecty Team_
_Date: 2026-02-13_
