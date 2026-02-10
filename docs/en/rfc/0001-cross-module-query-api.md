# RFC-0001: Cross-Module Query API (Konecty Advanced Query Language)

> A new API for cross-module queries with joins, aggregations, and a SQL interface -- API-only, no UI.

---

## Metadata

| Field         | Value                                          |
| ------------- | ---------------------------------------------- |
| **Status**    | DRAFT                                          |
| **Authors**   | Konecty Team                                   |
| **Created**   | 2026-02-10                                     |
| **Updated**   | 2026-02-10                                     |
| **Reviewers** | TBD                                            |
| **Related**   | ADR-0001 through ADR-0010, especially ADR-0005 (secondary reads), ADR-0006 (Python integration), ADR-0008 (Polars/Pandas), ADR-0010 (code patterns) |

---

## 1. Problem Statement

### Current Limitations

The Konecty `find` API (`/rest/data/:document/find` and `/rest/stream/:document/findStream`) only allows querying **a single module** at a time, with no support for:

- **Cross-module joins**: Cannot query Product and its related ProductsPerOpportunities in a single request.
- **Cross-module aggregations**: Cannot count opportunities per contact, or sum sales per campaign.
- **Arbitrary multi-module projections**: `withDetailFields` only brings lookup `descriptionFields`/`detailFields`, not arbitrary cross-module queries with custom projections.

### Impact

Clients must make **N+1 API calls** for related data and perform joins client-side, leading to:

- High latency for analytics and reporting use cases
- Excessive memory usage on clients
- Duplicated security logic when clients try to merge data
- Inability to perform server-side aggregations across modules

### Goal

Provide a secure, streaming, cross-module query API accessible via REST that:

1. Supports 1-to-N module joins (INNER, LEFT, RIGHT, CROSS)
2. Supports aggregations (COUNT, SUM, AVG, MIN, MAX, COLLECT)
3. Offers both a structured JSON interface and an ANSI SQL subset interface
4. **Never bypasses** the existing 6-layer security model
5. Uses streaming and secondary reads for performance
6. Leverages the existing Python bridge (Polars) for join processing

---

## 2. Proposed Solution: Two New Endpoints

### Endpoint 1 -- JSON Query

```
POST /rest/query/json
Content-Type: application/json
Authorization: <auth token>
```

Accepts a structured JSON body defining documents, joins, projections, filters, and aggregations.

### Endpoint 2 -- SQL Query

```
POST /rest/query/sql
Content-Type: application/json
Authorization: <auth token>

{
  "sql": "SELECT Product.code, COUNT(ProductsPerOpportunities._id) AS offers FROM Product INNER JOIN ProductsPerOpportunities ON Product._id = ProductsPerOpportunities.product._id WHERE Product._id = 'fFaJkGaWAdDhvcPH6' GROUP BY Product.code"
}
```

Accepts an ANSI SQL subset string that gets parsed to the same Internal Query Representation (IQR).

### Response Format

Both endpoints return **NDJSON** streaming responses:

```
Content-Type: application/x-ndjson
X-Total-Count: 42  (optional, if requested)
```

First line (optional metadata):

```json
{"_meta":{"modules":["Product","ProductsPerOpportunities"],"warnings":[],"executionTimeMs":234}}
```

Subsequent lines (data records):

```json
{"code":123,"offers":[{"_id":"xyz","status":"Ofertado"},{"_id":"zxy","status":"Visitado"}]}
{"code":456,"offers":[{"_id":"abc","status":"Nova"}]}
```

---

## 3. Security Architecture (Critical -- 6 Security Layers)

Every module referenced in a query **independently** goes through ALL 6 security layers from `find.ts`, `findUtils.ts`, `data.js`, and `accessUtils.ts`. **No layer may be bypassed.**

### Layer 1 -- User Authentication

**Function**: `getUserSafe(authTokenId, contextUser)`

- Validates `authTokenId` or `contextUser`
- Returns authenticated `User` object with `user.access` map
- If invalid, returns error immediately
- Called **once** per request, shared across all modules in the query

### Layer 2 -- Document-Level Access

**Function**: `getAccessFor(document, user)` in `accessUtils.ts:80-134`

- Resolves user's access profile for each module: `user.access[documentName]` -> `MetaObject.Access[name]`
- Checks `access.isReadable === true`
- Returns `MetaAccess` object or `false` (deny)
- **Each module** in the query must independently pass this check
- If ANY module fails, the entire query is rejected with a clear error

### Layer 3 -- Document-Level Read Filter (Row-Level Security)

**Source**: `access.readFilter` (a KonFilter object)

- Each `MetaAccess` may define a `readFilter`
- This filter is **always merged** with the user's filter via `$and`
- Restricts which **records** the user can see
- Example: a broker can only see opportunities assigned to them
- Applied in `find.ts:114-116`: `if (isObject(access.readFilter)) queryFilter.filters.push(access.readFilter)`
- **Critical**: In cross-module queries, each module's readFilter is applied to its own collection query independently

### Layer 4 -- Field-Level Permissions

**Function**: `getFieldPermissions(metaAccess, fieldName)` in `accessUtils.ts:32-78`

- For each field in the module metadata, checks if `access.fields[fieldName].READ.allow === true`
- Falls back to `metaAccess.fieldDefaults.isReadable`
- If a field is NOT readable: it is **removed from the MongoDB projection** (never fetched from DB)
- Applied in `find.ts:179-210` and `findUtils.ts:314-316`

### Layer 5 -- Field-Level Conditional Access

**Functions**: `getFieldConditions(metaAccess, fieldName)` + `filterConditionToFn()` in `accessUtils.ts:11-28`

- Some fields have READ conditions: `access.fields[fieldName].READ.condition`
- Converted to runtime functions via `filterConditionToFn()`
- After MongoDB returns data, each record is evaluated against these conditions
- If condition returns `false` for a record, the field is **stripped from that specific record**
- In `findStream.ts`: handled by `ApplyFieldPermissionsTransform` stream transform
- In `find.ts:284-297`: `conditionsKeys.reduce(... if (accessConditions[key](record) === false) delete acc[key])`

### Layer 6 -- `removeUnauthorizedDataForRead()`

**Function**: `removeUnauthorizedDataForRead()` in `accessUtils.ts:136-162`

- Final safety net (defense-in-depth)
- Iterates all fields in result data
- Re-checks `getFieldPermissions()` and `getFieldConditions()` for each field
- Only copies authorized fields to a new object (whitelist approach)

### Security Invariant for Cross-Module Query

The cross-module query engine MUST decompose the query into per-module operations where each module independently goes through Layers 1-5:

1. Call `buildFindQuery()` (or equivalent) for **EACH** module involved
2. Never allow a join to expose records filtered by `readFilter` of another module
3. Never allow a projection to include fields the user cannot read
4. Apply field conditions (Layer 5) via Transform streams on each module's data **BEFORE** joining
5. Log security-relevant decisions for audit purposes

---

## 4. JSON Query Format (with Zod-style Schema)

### Complete Schema

```typescript
import { z } from 'zod';

// --- Enums ---
const JoinTypeEnum = z.enum(['inner', 'left', 'right', 'cross']);
const AggregateEnum = z.enum(['count', 'sum', 'avg', 'min', 'max', 'collect']);
const DirectionEnum = z.enum(['asc', 'desc']);
const OperatorEnum = z.enum([
  'equals', 'not_equals', 'contains', 'starts_with', 'end_with',
  'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals',
  'greater_or_equals', 'between', 'exists', 'current_user',
]);

// --- Join Condition ---
const JoinConditionSchema = z.object({
  left: z.string().describe('Module-qualified field: "Product._id"'),
  operator: OperatorEnum,
  right: z.string().describe('Module-qualified field: "ProductsPerOpportunities.product._id"'),
});

// --- Join ---
const JoinSchema = z.object({
  document: z.string().describe('Target module name, e.g. "ProductsPerOpportunities"'),
  type: JoinTypeEnum.default('inner'),
  on: JoinConditionSchema,
});

// --- Select Field ---
const SelectFieldSchema = z.object({
  field: z.string().describe('Module-qualified field or wildcard: "Product.code" or "ProductsPerOpportunities.*"'),
  alias: z.string().describe('Output field name in the result'),
  aggregate: AggregateEnum.optional().describe('Aggregation function to apply'),
});

// --- Where Condition (reuses KonFilter structure) ---
const WhereConditionSchema = z.object({
  term: z.string().describe('Module-qualified field: "Product._id"'),
  operator: OperatorEnum,
  value: z.any(),
});

const WhereSchema: z.ZodType<any> = z.object({
  match: z.enum(['and', 'or']).default('and'),
  conditions: z.array(WhereConditionSchema).optional(),
  filters: z.lazy(() => z.array(WhereSchema)).optional(),
  textSearch: z.string().optional(),
});

// --- Sort ---
const SortSchema = z.object({
  field: z.string().describe('Module-qualified field: "Product.code"'),
  direction: DirectionEnum.default('asc'),
});

// --- Main Query Schema ---
const CrossModuleQuerySchema = z.object({
  from: z.string().describe('Primary/driving module name'),
  join: z.array(JoinSchema).min(1).max(10).describe('Join definitions, 1-N modules'),
  select: z.array(SelectFieldSchema).min(1).describe('Fields to return with optional aggregations'),
  where: WhereSchema.optional().describe('Filter conditions using module-qualified fields'),
  sort: z.array(SortSchema).optional(),
  limit: z.number().int().min(1).max(100_000).default(1000),
  start: z.number().int().min(0).default(0),
  includeTotal: z.boolean().default(false),
  includeMeta: z.boolean().default(true).describe('Include _meta first line in NDJSON response'),
});
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| `from` as primary module | Clear driving table for query planner |
| Module-qualified field names (`Product.code`) | Unambiguous when multiple modules have same field names |
| `collect` aggregate | Groups related records into arrays (e.g., all offers for a product) |
| Reuse `KonFilter` structure for `where` | Consistency with existing API, reuse `parseFilterObject()` |
| Max 10 joins | Prevent unbounded complexity; can be raised later |
| Max 100,000 limit | Matches existing `PIVOT_MAX_RECORDS` pattern |

---

## 5. SQL Interface (ANSI SQL Subset)

### Supported Grammar

```
query := SELECT select_list FROM table_ref join_clause* where_clause? group_clause? having_clause? order_clause? limit_clause?

select_list := select_item (',' select_item)*
select_item := aggregate_fn '(' field_ref ')' (AS alias)?
             | field_ref (AS alias)?
             | '*'

aggregate_fn := COUNT | SUM | AVG | MIN | MAX | COLLECT

field_ref := module_name '.' field_path
           | field_path
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
- **TypeScript alternative**: `@guanmingchiu/sqlparser-ts` for full typed AST
- **Translation**: AST is traversed to produce the Internal Query Representation (IQR), identical to the JSON query format
- **Whitelist validation**: `parser.whiteListCheck()` ensures only allowed tables (Konecty modules) are referenced
- **Security**: Only SELECT statements are accepted; any DDL/DML triggers an immediate error

### Module and Field Mapping

| SQL | Konecty |
|-----|---------|
| Table name | Module name (case-sensitive): `Product`, `ProductsPerOpportunities` |
| Column name | Field path with dot notation: `Product.code`, `Product.sale.value` |
| Table alias | Short name for module: `p` for `Product` |
| `*` | All readable fields for that module |

**Implementation reference**: Use Context7 for `node-sql-parser` documentation: `resolve-library-id("node-sql-parser")` then `query-docs("How to parse SQL SELECT with JOIN into AST")`.

---

## 6. Execution Strategy

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
                    |  Security Check   |
                    |  (per module)     |
                    |  Layers 1-4       |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v--------+          +---------v--------+
    | findStream()     |          | findStream()     |
    | Module A         |          | Module B         |
    | (with readFilter,|          | (with readFilter,|
    |  field perms,    |          |  field perms,    |
    |  secondary read) |          |  secondary read) |
    +---------+--------+          +---------+--------+
              |                             |
    +---------v--------+          +---------v--------+
    | Layer 5:         |          | Layer 5:         |
    | Field Conditions |          | Field Conditions |
    | Transform        |          | Transform        |
    +---------+--------+          +---------+--------+
              |                             |
              | Tag: _dataset="A"           | Tag: _dataset="B"
              +--------------+--------------+
                             |
                    +--------v---------+
                    | Python Process   |
                    | (Polars join +   |
                    |  aggregation)    |
                    +--------+---------+
                             |
                    +--------v---------+
                    | Stream NDJSON    |
                    | Response         |
                    +------------------+
```

### Join Strategy: Python/Polars (Recommended)

Following the established pattern from `pivotStream.ts`, `graphStream.ts`, and `kpiStream.ts`:

1. For EACH module: call `buildFindQuery()` (enforces all 6 security layers)
2. For EACH module: call `findStream()` to get a secure, permission-filtered stream
3. Collect NDJSON data from each stream, tag records with `_dataset` field
4. Populate lookup fields (batch `$in` fetch, same as `pivotStream.ts`)
5. Spawn Python process with `cross_module_join.py`
6. Send config + all datasets via JSON-RPC stdin protocol
7. Read NDJSON results from stdout
8. Stream to HTTP response

### Alternative Strategy: MongoDB `$lookup` (Future Optimization)

For Phase 4, a direct `$lookup` pipeline strategy could be considered:

- Build a single aggregation pipeline with `$lookup` stages
- More efficient (single database round-trip)
- BUT: harder to enforce per-module field permissions and readFilter independently
- Would require post-processing to apply security layers on joined data

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

### Existing Code References

**Node.js bridge** (`src/imports/data/api/pythonStreamBridge.ts`):

- `createPythonProcess(scriptPath)` -- spawns `uv run --script <path>`, stdio: pipe
- `sendRPCRequest(process, method, params)` -- writes JSON-RPC first line to stdin
- `streamToPython(nodeStream, process)` -- pipes NDJSON to stdin
- `collectResultFromPython(process)` -- reads JSON-RPC response + result from stdout

**JSON-RPC Protocol** (shared by all Python scripts):

```
stdin line 1:  {"jsonrpc":"2.0","method":"<method>","params":{"config":{...}}}
stdin line 2+: {"_id":"abc","field1":"value",...}\n  (NDJSON data)
stdin EOF:     (close stdin)

stdout line 1: {"jsonrpc":"2.0","result":"ok"}  (or {"jsonrpc":"2.0","error":{...}})
stdout line 2+: result data (JSON or NDJSON)
```

### Proposed: `cross_module_join.py`

A new script at `src/scripts/python/cross_module_join.py` using Polars for:

- **Receiving multiple datasets**: Each module's data arrives tagged with `_dataset` field
- **Performing joins**: Polars `join()` with support for inner, left, right, cross
- **Applying aggregations**: GROUP BY, COUNT, SUM, AVG, MIN, MAX, COLLECT
- **Returning results**: NDJSON streamed back to Node.js

### Proposed Protocol

```
stdin line 1:  {"jsonrpc":"2.0","method":"join","params":{"config":{
  "from": "Product",
  "joins": [
    {"document":"ProductsPerOpportunities","type":"inner","leftKey":"_id","rightKey":"product._id"}
  ],
  "select": [
    {"field":"Product.code","alias":"code"},
    {"field":"ProductsPerOpportunities.*","alias":"offers","aggregate":"collect"}
  ],
  "groupBy": ["Product.code"]
}}}

stdin line 2:  {"_dataset":"Product","_id":"abc","code":123,"type":"Apartamento"}\n
stdin line 3:  {"_dataset":"Product","_id":"def","code":456,"type":"Casa"}\n
stdin line 4:  {"_dataset":"ProductsPerOpportunities","_id":"x1","product":{"_id":"abc"},"status":"Ofertado"}\n
stdin line 5:  {"_dataset":"ProductsPerOpportunities","_id":"x2","product":{"_id":"abc"},"status":"Visitado"}\n
stdin EOF

stdout line 1: {"jsonrpc":"2.0","result":"ok"}
stdout line 2: {"code":123,"offers":[{"_id":"x1","status":"Ofertado"},{"_id":"x2","status":"Visitado"}]}\n
stdout line 3: {"code":456,"offers":[]}\n
```

### Key Design Decisions for Python Script

| Decision | Rationale |
|----------|-----------|
| `_dataset` tag per record | Separates data from multiple modules in a single NDJSON stream |
| Polars `join()` | 3-10x faster than pure JS for large datasets (ADR-0008) |
| NDJSON output (not single JSON) | Allows streaming back to Node.js; memory-efficient |
| `COLLECT` via Polars `list()` | Groups related records into arrays efficiently |
| PEP 723 inline metadata | No separate pyproject.toml needed (ADR-0006) |

### Node.js Orchestration (`crossModuleQuery.ts`)

```typescript
// Pseudocode following pivotStream.ts pattern
export default async function crossModuleQuery(params: CrossModuleQueryParams) {
  // 1. Parse & validate (JSON or SQL -> IQR)
  const iqr = params.sql
    ? parseSqlToIQR(params.sql)
    : validateJsonQuery(params.query);

  // 2. Security check & data collection for EACH module
  const allModules = [iqr.from, ...iqr.join.map(j => j.document)];
  const datasets: TaggedRecord[] = [];

  for (const moduleName of allModules) {
    // 2a. buildFindQuery enforces Layers 1-4
    const moduleFilter = extractModuleFilter(iqr.where, moduleName);
    const streamResult = await findStream({
      authTokenId: params.authTokenId,
      document: moduleName,
      filter: moduleFilter,
      fields: extractModuleFields(iqr.select, moduleName),
      limit: CROSS_QUERY_MAX_RECORDS,
      transformDatesToString: true,
    });

    // 2b. Collect and tag with _dataset
    const records = await collectDataFromStream(streamResult.data);
    const tagged = records.map(r => ({ ...r, _dataset: moduleName }));
    datasets.push(...tagged);
  }

  // 3. Spawn Python and send data
  const pythonProcess = createPythonProcess(CROSS_MODULE_JOIN_SCRIPT);
  await sendRPCRequest(pythonProcess, 'join', { config: iqr });

  // 4. Send all tagged datasets
  await sendDataToPython(pythonProcess, datasets);

  // 5. Collect NDJSON results
  const results = await collectNDJSONFromPython(pythonProcess);

  // 6. Stream to HTTP response
  return { success: true, data: results };
}
```

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
| Per-module streaming | Each module streamed via `findStream()` with `batchSize: 1000` |
| Configurable limits | `CROSS_QUERY_MAX_RECORDS` env variable (default: 100,000) |
| Python memory | Polars uses Apache Arrow columnar format (memory-efficient) |
| Cleanup | Kill Python process on error (same pattern as `pivotStream.ts`) |

### Warnings

The `_meta` first line should include warnings for:

- `CROSS_JOIN_WARNING`: Cross joins can produce cartesian products
- `LIMIT_REACHED`: Result was truncated due to `CROSS_QUERY_MAX_RECORDS`
- `MISSING_INDEX`: Join key field lacks an index (query may be slow)
- `LARGE_DATASET`: One or more modules returned > 50,000 records

---

## 9. Implementation Files

### New Files

| File | Purpose |
|------|---------|
| `src/imports/data/api/crossModuleQuery.ts` | Main query engine orchestrator |
| `src/imports/data/api/crossModuleQueryValidator.ts` | Zod schema validation for JSON queries |
| `src/imports/data/api/sqlParser.ts` | SQL-to-IQR translator using `node-sql-parser` |
| `src/imports/data/api/crossModuleJoinTransforms.ts` | Transform streams for join post-processing |
| `src/imports/types/crossModuleQuery.ts` | TypeScript types for IQR and query format |
| `src/server/routes/rest/query/queryApi.ts` | Fastify route definitions |
| `src/scripts/python/cross_module_join.py` | Polars-based join + aggregation script |

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

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `node-sql-parser` | latest | SQL parsing to AST |
| `zod` | (already in project) | Query validation |

---

## 10. Rich Real-World Examples

All examples use actual metadata from `src/private/metadata` and `foxter-metas/MetaObjects/ProductsPerOpportunities`.

### Example 1: Product + ProductsPerOpportunities (INNER JOIN, COLLECT)

**Use case**: "Get Product fFaJkGaWAdDhvcPH6 and all its related offers"

**Metadata basis**:
- `ProductsPerOpportunities.product` is a lookup to `Product` with `descriptionFields: ["code", "type", "sale", "address"]`
- `ProductsPerOpportunities` has fields: `status`, `situation`, `rating`, `contact`, `opportunity`

**JSON Query**:

```json
{
  "from": "Product",
  "join": [
    {
      "document": "ProductsPerOpportunities",
      "type": "inner",
      "on": {
        "left": "Product._id",
        "operator": "equals",
        "right": "ProductsPerOpportunities.product._id"
      }
    }
  ],
  "select": [
    { "field": "Product.code", "alias": "code" },
    { "field": "Product.type", "alias": "productType" },
    { "field": "ProductsPerOpportunities.*", "alias": "offers", "aggregate": "collect" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Product._id", "operator": "equals", "value": "fFaJkGaWAdDhvcPH6" }
    ]
  },
  "limit": 100
}
```

**SQL Equivalent**:

```sql
SELECT p.code AS code,
       p.type AS productType,
       COLLECT(ppo.*) AS offers
  FROM Product p
 INNER JOIN ProductsPerOpportunities ppo
    ON p._id = ppo.product._id
 WHERE p._id = 'fFaJkGaWAdDhvcPH6'
 GROUP BY p.code, p.type
 LIMIT 100
```

**Expected Response** (NDJSON):

```json
{"code":123,"productType":"Apartamento","offers":[{"_id":"x1","status":"Ofertado","situation":"Visita","rating":4,"contact":{"_id":"c1","name":{"full":"John Doe"}}},{"_id":"x2","status":"Visitado","situation":"Proposta","rating":5,"contact":{"_id":"c2","name":{"full":"Jane Doe"}}}]}
```

---

### Example 2: Contact + Opportunity (INNER JOIN, COUNT)

**Use case**: "How many active opportunities does each contact have?"

**Metadata basis**:
- `Opportunity.contact` is a lookup to `Contact` with `descriptionFields: ["code", "name.full"]`
- `Opportunity.status` is a picklist: new, in-progress, done, canceled
- Contact metadata defines this as a `relations` aggregator (`activeOpportunities: count`)

**JSON Query**:

```json
{
  "from": "Contact",
  "join": [
    {
      "document": "Opportunity",
      "type": "inner",
      "on": {
        "left": "Contact._id",
        "operator": "equals",
        "right": "Opportunity.contact._id"
      }
    }
  ],
  "select": [
    { "field": "Contact.code", "alias": "contactCode" },
    { "field": "Contact.name.full", "alias": "contactName" },
    { "field": "Opportunity._id", "alias": "activeOpportunities", "aggregate": "count" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Opportunity.status", "operator": "in", "value": ["Nova", "Ofertando Imveis", "Em Visitacao"] }
    ]
  },
  "sort": [{ "field": "Contact.name.full", "direction": "asc" }],
  "limit": 1000
}
```

**SQL Equivalent**:

```sql
SELECT ct.code AS contactCode,
       ct.name.full AS contactName,
       COUNT(o._id) AS activeOpportunities
  FROM Contact ct
 INNER JOIN Opportunity o
    ON ct._id = o.contact._id
 WHERE o.status IN ('Nova', 'Ofertando Imveis', 'Em Visitacao')
 GROUP BY ct.code, ct.name.full
 ORDER BY ct.name.full ASC
 LIMIT 1000
```

**Expected Response**:

```json
{"contactCode":1001,"contactName":"Alice Santos","activeOpportunities":3}
{"contactCode":1002,"contactName":"Bruno Silva","activeOpportunities":1}
```

---

### Example 3: Campaign + Opportunity + Contact (3-way JOIN)

**Use case**: "Which contacts came from Campaign X and their opportunity status?"

**Metadata basis**:
- `Opportunity.campaign` is a lookup to `Campaign` with `descriptionFields: ["code", "name", "type"]`
- `Opportunity.contact` is a lookup to `Contact` with `descriptionFields: ["code", "name.full"]`, `detailFields: ["email", "phone"]`

**JSON Query**:

```json
{
  "from": "Campaign",
  "join": [
    {
      "document": "Opportunity",
      "type": "inner",
      "on": {
        "left": "Campaign._id",
        "operator": "equals",
        "right": "Opportunity.campaign._id"
      }
    },
    {
      "document": "Contact",
      "type": "inner",
      "on": {
        "left": "Opportunity.contact._id",
        "operator": "equals",
        "right": "Contact._id"
      }
    }
  ],
  "select": [
    { "field": "Campaign.name", "alias": "campaignName" },
    { "field": "Opportunity.code", "alias": "opportunityCode" },
    { "field": "Opportunity.status", "alias": "opportunityStatus" },
    { "field": "Contact.name.full", "alias": "contactName" },
    { "field": "Contact.email", "alias": "contactEmail" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Campaign._id", "operator": "equals", "value": "campXYZ123" }
    ]
  },
  "limit": 500
}
```

**SQL Equivalent**:

```sql
SELECT c.name AS campaignName,
       o.code AS opportunityCode,
       o.status AS opportunityStatus,
       ct.name.full AS contactName,
       ct.email AS contactEmail
  FROM Campaign c
 INNER JOIN Opportunity o ON c._id = o.campaign._id
 INNER JOIN Contact ct ON o.contact._id = ct._id
 WHERE c._id = 'campXYZ123'
 LIMIT 500
```

**Expected Response**:

```json
{"campaignName":"Summer 2026","opportunityCode":5001,"opportunityStatus":"Nova","contactName":"Carlos Mendes","contactEmail":[{"address":"carlos@example.com"}]}
{"campaignName":"Summer 2026","opportunityCode":5002,"opportunityStatus":"Em Visitacao","contactName":"Diana Lima","contactEmail":[{"address":"diana@example.com"}]}
```

---

### Example 4: Activity + Product (LEFT JOIN with nulls)

**Use case**: "List all activities, including those without a linked product"

**Metadata basis**:
- `Activity.product` is a lookup to `Product` with `descriptionFields: ["code", "type", "sale", "_user"]`
- Not all activities have a product linked

**JSON Query**:

```json
{
  "from": "Activity",
  "join": [
    {
      "document": "Product",
      "type": "left",
      "on": {
        "left": "Activity.product._id",
        "operator": "equals",
        "right": "Product._id"
      }
    }
  ],
  "select": [
    { "field": "Activity.code", "alias": "activityCode" },
    { "field": "Activity.subject", "alias": "subject" },
    { "field": "Activity.status", "alias": "activityStatus" },
    { "field": "Product.code", "alias": "productCode" },
    { "field": "Product.sale", "alias": "productSale" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Activity.status", "operator": "in", "value": ["new", "in-progress"] }
    ]
  },
  "sort": [{ "field": "Activity._createdAt", "direction": "desc" }],
  "limit": 200
}
```

**SQL Equivalent**:

```sql
SELECT a.code AS activityCode,
       a.subject AS subject,
       a.status AS activityStatus,
       p.code AS productCode,
       p.sale AS productSale
  FROM Activity a
  LEFT JOIN Product p ON a.product._id = p._id
 WHERE a.status IN ('new', 'in-progress')
 ORDER BY a._createdAt DESC
 LIMIT 200
```

**Expected Response**:

```json
{"activityCode":8001,"subject":"Call about apartment","activityStatus":"in-progress","productCode":123,"productSale":{"value":450000,"currency":"BRL"}}
{"activityCode":8002,"subject":"Follow-up email","activityStatus":"new","productCode":null,"productSale":null}
```

---

### Example 5: ProductsPerOpportunities Aggregations (GROUP BY, AVG)

**Use case**: "Average rating and count per status"

**Metadata basis**:
- `ProductsPerOpportunities.status` is a picklist: Nova, Ofertado, Visitado, Interessado, etc.
- `ProductsPerOpportunities.rating` is a number (0-5)

**JSON Query**:

```json
{
  "from": "ProductsPerOpportunities",
  "join": [],
  "select": [
    { "field": "ProductsPerOpportunities.status", "alias": "status" },
    { "field": "ProductsPerOpportunities._id", "alias": "count", "aggregate": "count" },
    { "field": "ProductsPerOpportunities.rating", "alias": "avgRating", "aggregate": "avg" }
  ],
  "limit": 100
}
```

**SQL Equivalent**:

```sql
SELECT ppo.status AS status,
       COUNT(ppo._id) AS count,
       AVG(ppo.rating) AS avgRating
  FROM ProductsPerOpportunities ppo
 GROUP BY ppo.status
 LIMIT 100
```

**Expected Response**:

```json
{"status":"Nova","count":1234,"avgRating":0}
{"status":"Ofertado","count":5678,"avgRating":3.2}
{"status":"Visitado","count":890,"avgRating":4.1}
{"status":"Interessado","count":234,"avgRating":4.7}
```

Note: When aggregation functions are used without explicit `GROUP BY` in JSON, the engine infers grouping from non-aggregated select fields.

---

### Example 6: Contact + Message (LEFT JOIN, MAX aggregation)

**Use case**: "Last email sent to each contact"

**Metadata basis**:
- `Message.contact` is a lookup to `Contact` with `descriptionFields: ["code", "name.full"]`
- `Message.type` is a picklist, `Message.status` is a picklist
- Contact metadata defines `lastTouch` as `MAX(Message._createdAt)` in relations

**JSON Query**:

```json
{
  "from": "Contact",
  "join": [
    {
      "document": "Message",
      "type": "left",
      "on": {
        "left": "Contact._id",
        "operator": "equals",
        "right": "Message.contact._id"
      }
    }
  ],
  "select": [
    { "field": "Contact.code", "alias": "contactCode" },
    { "field": "Contact.name.full", "alias": "contactName" },
    { "field": "Message._createdAt", "alias": "lastEmailSent", "aggregate": "max" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Message.type", "operator": "equals", "value": "Email" },
      { "term": "Message.status", "operator": "equals", "value": "Enviada" }
    ]
  },
  "sort": [{ "field": "Contact.name.full", "direction": "asc" }],
  "limit": 1000
}
```

**SQL Equivalent**:

```sql
SELECT ct.code AS contactCode,
       ct.name.full AS contactName,
       MAX(m._createdAt) AS lastEmailSent
  FROM Contact ct
  LEFT JOIN Message m ON ct._id = m.contact._id
 WHERE m.type = 'Email'
   AND m.status = 'Enviada'
 GROUP BY ct.code, ct.name.full
 ORDER BY ct.name.full ASC
 LIMIT 1000
```

**Expected Response**:

```json
{"contactCode":1001,"contactName":"Alice Santos","lastEmailSent":"2026-02-09T14:30:00.000Z"}
{"contactCode":1002,"contactName":"Bruno Silva","lastEmailSent":"2026-01-15T09:00:00.000Z"}
{"contactCode":1003,"contactName":"Carlos Mendes","lastEmailSent":null}
```

---

### Example 7: Security-Aware Example

**Use case**: "A broker queries opportunities -- readFilter restricts to their own"

**Scenario**:
- User is a broker with access profile "Corretor"
- `Opportunity:access:Corretor` defines `readFilter: { conditions: [{ term: "_user._id", operator: "equals", value: "$user" }] }`
- `Product:access:Corretor` defines field condition: `sale` field only readable when `status = 'active'`

**JSON Query** (same as Example 1 but from broker's perspective):

```json
{
  "from": "Opportunity",
  "join": [
    {
      "document": "Product",
      "type": "left",
      "on": {
        "left": "Opportunity.product._id",
        "operator": "equals",
        "right": "Product._id"
      }
    }
  ],
  "select": [
    { "field": "Opportunity.code", "alias": "opportunityCode" },
    { "field": "Opportunity.status", "alias": "status" },
    { "field": "Product.code", "alias": "productCode" },
    { "field": "Product.sale", "alias": "productSale" }
  ],
  "limit": 100
}
```

**What happens internally**:

1. **Layer 2**: `getAccessFor('Opportunity', user)` returns "Corretor" access; `getAccessFor('Product', user)` returns "Corretor" access
2. **Layer 3**: Opportunity's `readFilter` is merged: the broker only sees their own opportunities (`_user._id = $user`)
3. **Layer 4**: All fields are checked for readability on both modules
4. **Layer 5**: Product's `sale` field has a condition: only readable if `Product.status = 'active'`. Applied via `ApplyFieldPermissionsTransform` BEFORE joining.
5. **Result**: Broker only sees their opportunities, and `productSale` is `null` for inactive products even though the data exists in MongoDB

**Expected Response** (broker sees only their data):

```json
{"opportunityCode":5001,"status":"Nova","productCode":123,"productSale":{"value":450000,"currency":"BRL"}}
{"opportunityCode":5002,"status":"Em Visitacao","productCode":456,"productSale":null}
```

In the second record, `productSale` is `null` because the product's status is not "active" -- the field condition stripped it.

---

## 11. Implementation Phases

### Phase 1 (MVP)

- JSON query endpoint (`POST /rest/query/json`)
- INNER JOIN only
- Max 2 modules (1 from + 1 join)
- Basic aggregations: `count`, `sum`, `avg`, `collect`
- Full security enforcement (all 6 layers)
- Python bridge with `cross_module_join.py`
- NDJSON streaming response
- Zod validation for query input

### Phase 2

- SQL query endpoint (`POST /rest/query/sql`)
- `node-sql-parser` integration
- LEFT and RIGHT joins
- Up to N modules (configurable, default 5)
- GROUP BY / HAVING support
- `min`, `max` aggregations

### Phase 3

- CROSS JOIN with mandatory warnings
- Subqueries (in WHERE clause)
- UNION support
- Python bridge for complex aggregations (statistical functions)
- Query timeout and cancellation

### Phase 4

- Query plan caching
- Query optimizer (join order optimization)
- Index suggestion warnings
- MongoDB `$lookup` strategy as alternative to Python joins
- Performance dashboard / query analytics

---

## 12. Testing Strategy

Per ADR-0003 (Testing Strategy with Jest and Supertest):

### Unit Tests

- **SQL parser**: AST translation for each SQL feature (SELECT, JOIN, WHERE, GROUP BY, etc.)
- **JSON query validator**: Zod schema validation for valid/invalid queries
- **IQR builder**: Correct Internal Query Representation from both JSON and SQL inputs
- **Module filter extraction**: Correct per-module filter splitting from cross-module WHERE clause

### Integration Tests (with MongoDB Memory Server)

- **Full query execution**: End-to-end with actual MongoDB collections
- **Security tests**: Verify unauthorized fields are stripped, readFilters applied per module
- **Join correctness**: INNER, LEFT, RIGHT joins produce correct results
- **Aggregation correctness**: COUNT, SUM, AVG, COLLECT produce correct values

### Python Tests

- **`cross_module_join.py`**: Unit tests with pytest
- **Join operations**: Verify Polars join behavior matches expected SQL semantics
- **Edge cases**: Empty datasets, null join keys, single-module queries

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
5. "Polars Python DataFrame join inner left right cross performance large datasets"
6. "NDJSON streaming API design best practices HTTP backpressure"

---

## 14. Open Questions

1. **Max modules per query**: Should we allow more than 10 joins? What's a reasonable limit for Phase 1?
2. **Query timeout**: Should the cross-module query have a different `maxTimeMS` than findStream (currently 5 min)?
3. **Audit logging**: Should we log the full IQR for audit purposes, or just the modules and user?
4. **Rate limiting**: Should the query endpoints have stricter rate limits than regular find?
5. **Caching**: Should we cache Python process instances for repeated queries with the same structure?

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
- [node-sql-parser (npm)](https://www.npmjs.com/package/node-sql-parser)
- [Polars Documentation](https://pola.rs/)
- [Fastify Streaming](https://fastify.dev/docs/latest/Reference/Reply/#streams)

---

_Authors: Konecty Team_
_Date: 2026-02-10_
