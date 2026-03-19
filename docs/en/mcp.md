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
   - `session_request_otp_phone` for phone/WhatsApp
3. Verify OTP with matching channel-specific tool:
   - `session_verify_otp_email`
   - `session_verify_otp_phone`
4. Read `authId` from the response.
5. Store `authId` in the client.
6. Send that value as `authTokenId` argument on every authenticated User MCP tool.

### Query strategy for agents
- For single-module reads and pagination, use `records_find` with `document` from `modules_list.modules[].document`.
- For cross-module retrievals, default to `query_json`.
- Use `query_sql` only when SQL is explicitly requested by the user.
- Never use module label/display name as document identifier; always use technical `_id`.

### User MCP tool classification
Public tools:
- `session_login_options`
- `session_request_otp_email`
- `session_request_otp_phone`
- `session_verify_otp_email`
- `session_verify_otp_phone`

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

## Konecty Filter Format

Konecty uses its own structured filter format — **not** MongoDB query syntax.

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

`{ "status": "Ativo" }` is **silently ignored** — it has no `conditions` array so `parseFilterObject` returns `{}` (empty query, no filtering applied).

## Tool I/O Reference
### User MCP
- `session_login_options`: input none; output `options`, `nextSteps`, `requestOtpExamples`, `verifyOtpExamples`.
- `session_request_otp_email`: input `email`; output `otpRequest`, `channel`, `nextStep` plus OTP image content block.
- `session_request_otp_phone`: input `phoneNumber`; output `otpRequest`, `channel`, `nextStep`.
- `session_verify_otp_email`, `session_verify_otp_phone`: input channel identifier plus `otpCode`; output `authId`, `user`, `logged`, `instructions`.
- `session_logout`: input `authTokenId`; output `logout`.
- `modules_list`: input `authTokenId`; output `modules`, `usageHint`, `queryStrategyHint`, `moduleIdentifiers`.
- `modules_fields`: input `document`, `authTokenId`; output `module` (including document normalization info when applicable). Fields of type "picklist" have embedded options — use `field_picklist_options`. Fields of type "lookup" have a related module — use `field_lookup_search`.
- `field_picklist_options`: input `document`, `fieldName`, `authTokenId`; output `document`, `fieldName`, `fieldLabel`, `options` (array of `{ key, sort?, pt_BR?, en? }`). Returns valid option keys for picklist fields — use before filtering.
- `field_lookup_search`: input `document`, `fieldName`, `search`, optional `limit`, `authTokenId`; output `document`, `fieldName`, `relatedDocument`, `descriptionFields`, `records`, `total`. Searches related records to resolve lookup _id before filtering.
- `records_find`: input `document`, optional filter/sort/fields/paging, `authTokenId`; output `records`, `total`. Filter uses Konecty structured format: `{ "match": "and"|"or", "conditions": [{ "term": "<field>", "operator": "<op>", "value": "<val>" }] }`. DO NOT use Mongo-style `{ "field": "value" }`. Before filtering by picklist use `field_picklist_options`; before filtering by lookup use `field_lookup_search`.
- `records_find_by_id`: input `document`, `recordId`, optional `fields` and `withDetailFields`, `authTokenId`; output `record`.
- `records_create`: input `document`, `data`, `authTokenId`; output `records`.
- `records_update`: input `document`, `ids` with `_id` and `_updatedAt`, `data`, `authTokenId`; output `records`.
- `records_delete_preview`: input `document`, `recordId`, optional `fields`, `authTokenId`; output `preview`.
- `records_delete`: input `document`, `confirm`, `ids`, `authTokenId`; output `deleted`.
- `query_json`: input `query`, optional `includeMeta`, `authTokenId`; output `records`, `meta`, `total`.
- `query_sql`: input `sql`, optional `includeMeta` and `includeTotal`, `authTokenId`; output `records`, `meta`, `total`.
- `query_pivot`: input `document`, `pivotConfig`, optional filter/sort/fields/limit, `authTokenId`; output `pivot`.
- `query_graph`: input `document`, `graphConfig`, optional filter/sort/fields/limit, `authTokenId`; output `graph`.
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
- `authenticate`
- `find_records`
- `filter_by_picklist`
- `filter_by_lookup`
- `create_record`
- `update_record`
- `delete_record`
- `cross_module_query`
- `build_pivot`
- `build_graph`
- `upload_file`

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
