# MCP Servers Reference

## Overview
Konecty exposes two MCP endpoints:
- User endpoint at `/mcp`
- Admin endpoint at `/admin-mcp`

Both endpoints use Streamable HTTP transport and are registered as Fastify plugins.

## Authentication
### Stateless design
User MCP and Admin MCP are stateless. The server does not persist an MCP conversation auth session for agents. Agents must keep the token on the client side and send it on every protected operation.

### User MCP authentication flow
1. Call `session_login_options` to inspect available OTP methods.
2. Request OTP with channel-specific tool:
   - `session_request_otp_email` for e-mail
   - `session_request_otp_phone` for phone/WhatsApp — `phoneNumber` must be **E.164** (e.g. `+5511999999999`). If the user gives only Brazilian DDD + local number, prepend `+55`. Use the same normalized number for request and verify.
3. Verify OTP with matching channel-specific tool:
   - `session_verify_otp_email`
   - `session_verify_otp_phone`
4. Read `authId` from the response.
5. Store `authId` in the client.
6. Send that value as `authTokenId` argument on every authenticated User MCP tool.

### Query strategy for agents
- For single-module reads and pagination, use `records_find` with `document` from `modules_list.modules[].document`.
- For cross-module retrievals and aggregation, default to `query_json` — it supports relations (joins), `groupBy`, and aggregators (count, sum, avg, min, max, etc.).
- Use `query_sql` only when SQL is explicitly requested by the user.
- Never use module label/display name as document identifier; always use technical `_id`.
- For aggregated summaries across large datasets, prefer `query_json` with `groupBy`/`aggregators` instead of paginating through all records with `records_find`.

### User MCP tool classification
Public tools:
- `session_login_options`
- `session_request_otp_email`
- `session_request_otp_phone`
- `session_verify_otp_email`
- `session_verify_otp_phone`
- `filter_build` (builds a validated Konecty filter JSON; no auth)

Authenticated tools:
- `session_logout`
- `modules_list`
- `modules_fields`
- `records_find`
- `records_find_by_id`
- `records_create`
- `records_update`
- `records_delete_preview`
- `records_delete`
- `query_json`
- `query_sql`
- `query_pivot`
- `query_graph`
- `file_upload`
- `file_download`
- `file_delete`

Render-only tools (no auth token required):
- `render_records_widget`
- `render_record_widget`
- `render_record_card`
- `render_pivot_widget`
- `render_graph_widget`
- `render_file_widget`

### Token transport options
Preferred option for agents:
- Send token in tool argument `authTokenId`

Compatibility fallback:
- `Authorization` header with raw `authTokenId`
- `Authorization` header with `Bearer <authTokenId>`
- Cookies `authTokenId` or `_authTokenId`

### Error recovery
When an authenticated tool returns `UNAUTHORIZED`:
1. Re-run OTP flow until `session_verify_otp_email` or `session_verify_otp_phone` returns `authId`.
2. Confirm the client stored the latest `authId`.
3. Retry the same tool including `authTokenId`.
4. If still failing, request a new OTP and replace the stored token.

### Admin MCP authentication
Admin MCP requires a token from an admin user (`admin=true`) obtained outside MCP OTP flow. Send that token through HTTP Authorization or cookies.

## Response Design
All MCP tools return both channels with semantic equivalence:

- `content.text`: model-oriented output with essential data in readable format plus next-step guidance.
- `structuredContent`: machine-oriented output with full JSON payload for programmatic consumption.

Design goals:
- Agents must continue working even if a client ignores `structuredContent`.
- Programmatic clients must receive complete and stable JSON in `structuredContent`.
- `content.text` is concise and high-signal, not generic summaries like "Record loaded.".

## Control / System Fields

Every Konecty module contains system-managed control fields (prefixed with `_`). These are present in all records and can be used in filters and sorts.

| Field | Type | Filter path | Valid operators | Value format |
|-------|------|-------------|-----------------|--------------|
| `_id` | ObjectId | `_id` | equals, not_equals, in, not_in, exists | String |
| `_createdAt` | dateTime | `_createdAt` | equals, not_equals, greater_than, less_than, greater_or_equals, less_or_equals, between, exists | ISO 8601 (e.g. `"2026-03-18T00:00:00Z"`) |
| `_updatedAt` | dateTime | `_updatedAt` | (same as _createdAt) | ISO 8601 |
| `_user` | lookup (User[]) | `_user._id` | equals, not_equals, in, not_in, exists | User _id string. Also supports `current_user` operator (no value) |
| `_createdBy` | lookup (User) | `_createdBy._id` | equals, not_equals, in, not_in, exists | User _id string |
| `_updatedBy` | lookup (User) | `_updatedBy._id` | equals, not_equals, in, not_in, exists | User _id string |

**Important**: Date/dateTime values MUST always be ISO 8601 with timezone (e.g. `"2026-01-01T00:00:00Z"`). Formats like `"2026-01-01"` or `"01/01/2026"` are not accepted.

The `modules_fields` tool response includes a `controlFields` array with this metadata for programmatic use.

## Pagination (records_find)

`records_find` uses offset-based pagination.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start` | number | 0 | Offset (skip N records) |
| `limit` | number | 50 | Page size |
| `total` | (response) | — | Full count of matching records |

### Pagination strategy

1. First call: `records_find` with desired `limit` (e.g. 50).
2. Check `total` in response and `pagination.hasMore`.
3. If `hasMore` is true, call again with `start = previous start + limit`.
4. Repeat until `start >= total`.

Example: `total=120, limit=50` → page 1: `start=0`, page 2: `start=50`, page 3: `start=100`.

When `limit > 1000`, sort is forced to `{ _id: 1 }` for stable ordering.

For aggregated summaries (counts, sums, averages) across large datasets, prefer `query_json` with `groupBy`/`aggregators` instead of paginating all records.

## Cross-Module Query (query_json) — Aggregation

`query_json` is the primary tool for cross-module retrievals and aggregation. It supports joining child modules via **relations**, grouping via **groupBy**, and aggregation functions at both root and relation level.

### Query structure

```json
{
  "document": "Contact",
  "filter": { "match": "and", "conditions": [...] },
  "fields": "code,name,status",
  "sort": [{ "property": "_createdAt", "direction": "DESC" }],
  "limit": 1000,
  "start": 0,
  "relations": [...],
  "groupBy": ["status"],
  "aggregators": { "total": { "aggregator": "count" } },
  "includeTotal": true,
  "includeMeta": false
}
```

### Relations

Relations join child modules to the parent. Each relation **must** have at least one aggregator.

```json
{
  "document": "Opportunity",
  "lookup": "contact",
  "filter": { "match": "and", "conditions": [{ "term": "status", "operator": "in", "value": ["Nova", "Em Visitacao"] }] },
  "fields": "code,value",
  "aggregators": {
    "activeCount": { "aggregator": "count" },
    "totalValue": { "aggregator": "sum", "field": "value.value" }
  }
}
```

- `lookup`: field in the child module pointing to the parent.
- Max 10 relations, max nesting depth 2.
- `limit` per relation defaults to 1000 (max 100000).

### Supported aggregators

| Aggregator | `field` required? | Description |
|------------|-------------------|-------------|
| `count` | No | Number of records |
| `countDistinct` | Yes | Count of distinct values |
| `sum` | Yes | Sum of numeric values |
| `avg` | Yes | Average |
| `min` | Yes | Minimum |
| `max` | Yes | Maximum |
| `first` | Optional | First record or field value |
| `last` | Optional | Last record or field value |
| `push` | Optional | Array of records or field values |
| `addToSet` | Yes | Unique values |

For numeric aggregations on money fields, use the sub-path `"fieldName.value"` (e.g. `{ "aggregator": "sum", "field": "value.value" }`).

### groupBy

Use root-level `groupBy` with root-level `aggregators` for consolidated results:

```json
{
  "document": "Contact",
  "groupBy": ["status"],
  "aggregators": { "total": { "aggregator": "count" } }
}
```

This returns one record per unique `status` value with the count.

### Example — Contacts with opportunity count and revenue

```json
{
  "document": "Contact",
  "fields": "code,name",
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "contact",
      "aggregators": {
        "totalOpportunities": { "aggregator": "count" },
        "totalRevenue": { "aggregator": "sum", "field": "value.value" }
      }
    }
  ]
}
```

Each returned Contact record will include `totalOpportunities` and `totalRevenue` from its related Opportunities.

## Konecty Filter Format

Konecty uses its own structured filter format — **not** MongoDB query syntax.

**Mandatory:** ALWAYS call `filter_build` with `match`, `conditions` as `{ field, operator, value, fieldType? }` rows (and optional `textSearch`). The tool validates operator compatibility with field type and returns a validated filter to pass to `records_find`, `query_pivot`, and `query_graph`.

User MCP validates filters before those calls: Mongo-style top-level field maps are **rejected** with an actionable error suggesting the equivalent `filter_build` call.

```json
{
  "match": "and",
  "conditions": [
    { "term": "status", "operator": "equals", "value": "Ativo" },
    { "term": "code", "operator": "greater_than", "value": 100 }
  ]
}
```

- `match`: `"and"` or `"or"` — how to combine conditions
- `conditions`: array of `{ term, operator, value }` objects
- `textSearch`: optional full-text search string
- `filters`: nested sub-groups for complex AND/OR: `{ "match": "and", "filters": [{ "match": "or", "conditions": [...] }] }`

### Operators

| Operator | Use for |
|----------|---------|
| `equals` / `not_equals` | Exact match |
| `contains` / `not_contains` | Substring (case-insensitive) |
| `starts_with` / `end_with` | Prefix / suffix |
| `in` / `not_in` | Match/exclude list — value must be array |
| `greater_than` / `less_than` | Numeric/date comparison |
| `greater_or_equals` / `less_or_equals` | Inclusive comparison |
| `between` | Range — value: `{ "greater_or_equals": ..., "less_or_equals": ... }` |
| `exists` | Field presence — value: `true` or `false` |

### Operators by field type

| Field type | Operators |
|------------|-----------|
| picklist | `exists`, `equals`, `not_equals`, `in`, `not_in` |
| lookup | `exists` |
| lookup._id | `exists`, `equals`, `not_equals`, `in`, `not_in` |
| text, url, email.address | `exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with` |
| number, date, dateTime | `exists`, `equals`, `not_equals`, `in`, `not_in`, `greater_than`, `less_than`, `greater_or_equals`, `less_or_equals`, `between` |
| boolean | `exists`, `equals`, `not_equals` |

### Lookup filter example

```json
{ "match": "and", "conditions": [{ "term": "supplier._id", "operator": "equals", "value": "<contact_id>" }] }
```

### NEVER use Mongo-style filters

`{ "status": "Ativo" }` has no `match` / `conditions` / `filters` / `textSearch`. In MCP, `records_find`, `query_pivot`, and `query_graph` **reject** this shape so the agent gets a clear error instead of an unfiltered result.

## Tool I/O Reference
### User MCP
- `session_login_options`: input none; output `options`, `nextSteps`, `requestOtpExamples`, `verifyOtpExamples`.
- `session_request_otp_email`: input `email`; output `otpRequest`, `channel`, `nextStep` plus OTP image content block.
- `session_request_otp_phone`: input `phoneNumber` (E.164, e.g. `+5511999999999`; Brazilian DDD+number normalized with `+55` when applicable); output `otpRequest`, `channel`, `nextStep`, `normalizedPhoneNumber` when normalization occurred.
- `session_verify_otp_email`, `session_verify_otp_phone`: input channel identifier plus `otpCode`; output `authId`, `user`, `logged`, `instructions`.
- `session_logout`: input `authTokenId`; output `logout`.
- `modules_list`: input `authTokenId`; output `modules`, `usageHint`, `queryStrategyHint`, `moduleIdentifiers`.
- `modules_fields`: input `document`, `authTokenId`; output `module` (including document normalization info when applicable), `controlFields` (array of system field metadata with type, filterPath, and validOperators). Fields of type "picklist" have embedded options — use `field_picklist_options`. Fields of type "lookup" have a related module — use `field_lookup_search`.
- `field_picklist_options`: input `document`, `fieldName`, `authTokenId`; output `document`, `fieldName`, `fieldLabel`, `options` (array of `{ key, sort?, pt_BR?, en? }`). Returns valid option keys for picklist fields — use before filtering.
- `field_lookup_search`: input `document`, `fieldName`, `search`, optional `limit`, `authTokenId`; output `document`, `fieldName`, `relatedDocument`, `descriptionFields`, `records`, `total`. Searches related records to resolve lookup _id before filtering.
- `filter_build`: input `match` (`and`|`or`), `conditions` as array of `{ field, operator, value?, fieldType? }`, optional `textSearch`; no `authTokenId`. When `fieldType` is provided (from `modules_fields`), validates operator compatibility. Output `filter`, `filterJson`. Use output as `filter` on `records_find` / `query_pivot` / `query_graph`.
- `records_find`: input `document`, optional filter/sort/fields, `limit` (default 50), `start` (offset, default 0), `withDetailFields`, `authTokenId`; output `records`, `total`, `pagination` (with `start`, `limit`, `returned`, `total`, `hasMore`, `nextStart`). Offset-based pagination: iterate with `start += limit` until `hasMore` is false. Prefer `filter` from `filter_build`. Mongo-style top-level maps are rejected. For aggregated data across large datasets, prefer `query_json` with `groupBy`/`aggregators`.
- `records_find_by_id`: input `document`, `recordId`, optional `fields` and `withDetailFields`, `authTokenId`; output `record`.
- `records_create`: input `document`, `data`, `authTokenId`; output `records`.
- `records_update`: input `document`, `ids` with `_id` and `_updatedAt`, `data`, `authTokenId`; output `records`.
- `records_delete_preview`: input `document`, `recordId`, optional `fields`, `authTokenId`; output `preview`.
- `records_delete`: input `document`, `confirm`, `ids`, `authTokenId`; output `deleted`.
- `query_json`: input `query` object (`document`, optional `filter`/`fields`/`sort`/`limit`/`start`, `relations` with aggregators, `groupBy`, `aggregators`, `includeTotal`, `includeMeta`), `authTokenId`; output `records`, `meta`, `total`. Supports cross-module joins via `relations` (each with required aggregators: count, sum, avg, min, max, first, last, push, addToSet, countDistinct), `groupBy` for GROUP BY, and root-level `aggregators` for consolidated summaries.
- `query_sql`: input `sql`, optional `includeMeta` and `includeTotal`, `authTokenId`; output `records`, `meta`, `total`.
- `query_pivot`: input `document`, `pivotConfig`, optional filter/sort/fields/limit, `authTokenId`; output `pivot`. Same filter rules as `records_find` (use `filter_build` when possible).
- `query_graph`: input `document`, `graphConfig`, optional filter/sort/fields/limit, `authTokenId`; output `graph`. Same filter rules as `records_find` (use `filter_build` when possible).
- `file_upload`: input `document`, `recordId`, `fieldName`, `file`, `authTokenId`; output `file`.
- `file_download`: input `document`, `recordId`, `fieldName`, `fileName`, `authTokenId`; output `fileUrl`, `fileName`.
- `file_delete`: input `document`, `recordId`, `fieldName`, `fileName`, `confirm`, `authTokenId`; output `file`.
- `render_records_widget`: input `document`, `records`; output `records`, `openInKonectyBaseUrl`.
- `render_record_widget`: input `document`, `recordId`, `record`; output `record`, `openInKonectyUrl`.
- `render_record_card`: input `document`, `recordId`, `record`, optional `imageFields` and `highlightFields`; output `record`, `images`, `highlightFields`, `openInKonectyUrl`.
- `render_pivot_widget`: input `rows`; output `rows`.
- `render_graph_widget`: input `svg`; output `svg`.
- `render_file_widget`: input `fileUrl`, optional `fileName`; output `fileUrl`, `fileName`.

### Admin MCP
- `meta_read`: input `name`; output `meta`.
- `meta_document_upsert`: input `id`, `document`; output `result`.
- `meta_list_upsert`: input `id`, `list`; output `result`.
- `meta_view_upsert`: input `id`, `view`; output `result`.
- `meta_access_upsert`: input `id`, `access`; output `result`.
- `meta_hook_validate`: input `script`; output `validation`.
- `meta_hook_upsert`: input `id`, `hook`; output `result`.
- `meta_namespace_update`: input `patch`; output `result`.
- `meta_pivot_upsert`: input `id`, `pivot`; output `result`.
- `meta_doctor_run`: input none; output `issues`, `total`.
- `meta_sync_plan`: input `items`; output `plan`.
- `meta_sync_apply`: input `items`, optional `autoApprove`; output `applied`, `total`.

## Feature Flags
MCP enablement is controlled by namespace metadata:
- `mcpUserEnabled`
- `mcpAdminEnabled`

If a flag is disabled, the endpoint returns service unavailable.

## User MCP Tools
### Session
- `session_login_options`
- `session_request_otp_email`
- `session_request_otp_phone`
- `session_verify_otp_email`
- `session_verify_otp_phone`
- `session_logout`

### Modules
- `modules_list`
- `modules_fields`

### Field Type Helpers
- `field_picklist_options` — returns valid option keys for picklist fields
- `field_lookup_search` — searches related records for lookup fields to resolve _id
- `filter_build` — assembles a validated Konecty filter (no auth)

### Records
- `records_find`
- `records_find_by_id`
- `records_create`
- `records_update`
- `records_delete_preview`
- `records_delete`
- `render_records_widget`
- `render_record_widget`
- `render_record_card`

### Query
- `query_json`
- `query_sql`
- `query_pivot`
- `query_graph`
- `render_pivot_widget`
- `render_graph_widget`

### Files
- `file_upload`
- `file_download`
- `file_delete`
- `render_file_widget`

## Admin MCP Tools
- `meta_read`
- `meta_document_upsert`
- `meta_list_upsert`
- `meta_view_upsert`
- `meta_access_upsert`
- `meta_hook_validate`
- `meta_hook_upsert`
- `meta_namespace_update`
- `meta_pivot_upsert`
- `meta_doctor_run`
- `meta_sync_plan`
- `meta_sync_apply`

## Prompts
### User prompts
- `authenticate` — OTP login flow
- `find_records` — single-module search with pagination guidance
- `filter_by_picklist` — picklist field filter workflow
- `filter_by_lookup` — lookup field filter workflow
- `build_filter` — generic filter construction
- `create_record` — record creation
- `update_record` — record update with optimistic locking
- `delete_record` — safe deletion with preview
- `cross_module_query` — cross-module retrieval with relations, groupBy, and aggregators
- `build_pivot` — pivot table generation
- `build_graph` — graph/chart generation
- `upload_file` — file upload

### Admin prompts
- `add_field_to_document`
- `create_access_profile`
- `write_hook`
- `sync_metadata`
- `diagnose_metadata`
- `configure_namespace`

## Widgets
User MCP exposes six widgets:
- `records-table`
- `pivot`
- `graph`
- `record-detail`
- `record-card`
- `file-preview`

Widgets are registered through MCP app resources and delivered from `src/mcp/widgets/dist`.

## Security Controls
- In-memory rate limiting by endpoint profile
- Request body size limit
- Namespace flag guard
- Admin guard for admin endpoint and tools
- Optimistic locking requirements on update and delete tools
- Delete confirmation requirements on destructive operations
