# Konecty API Documentation

Konecty provides a RESTful API for interacting with its platform. This documentation presents the main authentication methods and a representative set of endpoints to help you get started.

## Authentication

All requests that require authentication must include:

- An `Authorization` header with a valid token:
  ```http
  Authorization: <token>
  ```
- Or a cookie named `_authTokenId` with the session token:
  ```http
  Cookie: _authTokenId=<token>
  ```

Some endpoints (such as login) do not require authentication.

---

## Endpoints Overview

Below is a selection of key endpoints. For each, we show the HTTP method, URL, parameters, and example responses.

### 1. Authentication

#### Login
- **POST** `/rest/auth/login`
- **Body:**
  ```json
  {
    "user": "user@example.com",
    "password": "yourPassword"
  }
  ```
- **Success Response:**
  ```json
  {
    "success": true,
    "authId": "<token>",
    "user": { /* user info */ },
    "cookieMaxAge": 2592000
  }
  ```
- **Failure Response:**
  ```json
  {
    "success": false,
    "errors": [
      { "message": "Invalid credentials" }
    ]
  }
  ```

#### Logout
- **GET** `/rest/auth/logout`
- **Headers:** Requires authentication
- **Success Response:**
  ```json
  { "success": true }
  ```

#### Session Info
- **GET** `/rest/auth/info`
- **Headers:** Requires authentication
- **Success Response:**
  ```json
  { "success": true, "user": { /* user info */ } }
  ```

#### Request OTP
- **POST** `/api/auth/request-otp`
- **Body:** (exactly one of `phoneNumber` or `email` must be provided)
  ```json
  {
    "phoneNumber": "+5511999999999",
    "geolocation": {
      "longitude": -46.633309,
      "latitude": -23.550520
    },
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "source": "mobile-app",
    "fingerprint": "device-fingerprint-hash"
  }
  ```
  or
  ```json
  {
    "email": "user@example.com",
    "geolocation": {
      "longitude": -46.633309,
      "latitude": -23.550520
    },
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "source": "web",
    "fingerprint": "device-fingerprint-hash"
  }
  ```
  **Optional Fields** (same as traditional login):
  - `geolocation`: Object with `longitude` and `latitude` numbers, or JSON string
  - `resolution`: Object with `width` and `height` numbers, or JSON string
  - `source`: String (e.g., 'mobile-app', 'web')
  - `fingerprint`: String (device fingerprint hash)
  
  These fields are recorded in AccessFailedLog for audit and security purposes.
- **Success Response:**
  ```json
  {
    "success": true,
    "message": "OTP sent via whatsapp"
  }
  ```
- **Failure Response:**
  ```json
  {
    "success": false,
    "errors": [
      { "message": "User not found for this phone number" }
    ]
  }
  ```
- **Rate Limit:** 429 Too Many Requests if more than 5 requests per minute per phone/email

#### Verify OTP
- **POST** `/api/auth/verify-otp`
- **Body:** (exactly one of `phoneNumber` or `email` must be provided)
  ```json
  {
    "phoneNumber": "+5511999999999",
    "otpCode": "123456",
    "geolocation": {
      "longitude": -46.633309,
      "latitude": -23.550520
    },
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "source": "mobile-app",
    "fingerprint": "device-fingerprint-hash"
  }
  ```
  or
  ```json
  {
    "email": "user@example.com",
    "otpCode": "123456",
    "geolocation": {
      "longitude": -46.633309,
      "latitude": -23.550520
    },
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "source": "web",
    "fingerprint": "device-fingerprint-hash"
  }
  ```
  **Optional Fields** (same as traditional login):
  - `geolocation`: Object with `longitude` and `latitude` numbers, or JSON string
  - `resolution`: Object with `width` and `height` numbers, or JSON string
  - `source`: String (e.g., 'mobile-app', 'web')
  - `fingerprint`: String (device fingerprint hash)
  
  These fields are recorded in AccessLog for audit and security purposes.
- **Success Response:**
  ```json
  {
    "success": true,
    "logged": true,
    "authId": "<token>",
    "user": { /* user info */ }
  }
  ```
- **Failure Response:**
  ```json
  {
    "success": false,
    "errors": [
      { "message": "Invalid OTP code" }
    ]
  }
  ```
- **Notes:**
  - OTP code is 6 digits
  - OTP expires after configurable time (default: 5 minutes)
  - Maximum 3 verification attempts before OTP is invalidated
  - Delivery method: 
    - If requested by phone: WhatsApp → RabbitMQ (no email fallback)
    - If requested by email: Email only (skips WhatsApp)

---

### 2. Data (CRUD)

#### Get Record by ID
- **GET** `/rest/data/:document/:dataId`
- **Parameters:**
  - `:document` — Module name (e.g., `Contact`)
  - `:dataId` — Record ID
- **Headers:** Requires authentication
- **Success Response:**
  ```json
  { "success": true, "data": { /* record fields */ } }
  ```
- **Failure Response:**
  ```json
  { "success": false, "errors": [ { "message": "Not found" } ] }
  ```

#### Find Records (find)
- **GET** `/rest/data/:document/find`
- **Parameters:**
  - `:document` — Module name (e.g., `Contact`)

- **Query String:**
  - `filter` — Filter in JSON format, example: `{ "match": "and", "conditions": [] }`
  - `start` — Start index of results (default: 0)
  - `limit` — Maximum number of records to return (default: 25)
  - `sort` — Sorting in JSON format, example: `[ { "property": "code", "direction": "DESC" } ]`

- **Usage Example:**
  ```http
  GET /rest/data/Contact/find?filter={"match":"and","conditions":[]}&start=0&limit=25&sort=[{"property":"code","direction":"DESC"}]
  ```

- **Headers:** Requires authentication
- **Success Response:**
  ```json
  { "success": true, "data": [{ /* record fields */ }, { /* record fields */  }, ...] }
  ```
- **Failure Response:**
  ```json
  { "success": false, "errors": [ { "message": "Not found" } ] }
  ```

#### Find Records with Streaming (findStream)

- **GET** `/rest/stream/:document/findStream`

- **Parameters:**
  - `:document` — Module name (e.g., `Opportunity`, `Contact`)

- **Query String:**
  - `filter` — Filter in JSON format, example: `{ "status": { "$in": ["New", "In Visit"] } }`
  - `start` — Start index of results (default: 0)
  - `limit` — Maximum number of records to return (default: 50)
  - `sort` — Sorting in JSON format, example: `[ { "property": "code", "direction": "ASC" } ]`
  - `fields` — Fields to return, comma-separated (optional)
  - `displayName` — Display name to use (optional)
  - `displayType` — Display type to use (optional)
  - `withDetailFields` — Whether to include detail fields (optional)

- **Usage Example:**
  ```http
  GET /rest/stream/Opportunity/findStream?filter={"status":{"$in":["New","In Visit"]}}&limit=100&sort=[{"property":"_id","direction":"ASC"}]
  ```

- **Headers:** Requires authentication

- **Success Response:**

  The endpoint returns an HTTP stream with data in **newline-delimited JSON** (NDJSON) format. Each line is a complete JSON record.

  ```
  {"_id":"001","name":"Record 1","status":"New","createdAt":"2024-01-01T00:00:00.000Z"}
  {"_id":"002","name":"Record 2","status":"In Visit","createdAt":"2024-01-02T00:00:00.000Z"}
  {"_id":"003","name":"Record 3","status":"New","createdAt":"2024-01-03T00:00:00.000Z"}
  ```

  **Stream Characteristics:**

  - **Content-Type**: `application/json`
  - **Transfer-Encoding**: `chunked`
  - **Format**: Newline-delimited JSON (one record per line)
  - **Processing**: Records are sent incrementally, without accumulating in memory

- **Failure Response:**
  ```json
  { "success": false, "errors": [ { "message": "Error processing request" } ] }
  ```

- **Advantages over `/rest/data/:document/find`:**

  - **Memory**: 68% reduction in server memory usage
  - **TTFB**: 99.3% faster (client receives data immediately)
  - **Throughput**: 81.8% better (more records processed per second)
  - **Scalability**: Supports much larger volumes (50k+ records) without memory impact

- **When to use:**

  - Large data volumes (1000+ records)
  - When client needs to process data incrementally
  - When low TTFB is critical
  - When there are server memory limitations

- **Client-side processing example (JavaScript):**

  ```javascript
  const response = await fetch('/rest/stream/Opportunity/findStream?filter={...}&limit=1000', {
    headers: { Cookie: `_authTokenId=${token}` },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        const record = JSON.parse(line);
        // Process individual record
        console.log('Record received:', record);
      }
    }
  }
  ```

- **Important notes:**

  - Default sorting: If not specified, applies `{ _id: 1 }` to ensure consistency
  - Permissions: Applied record by record, maintaining security
  - Dates: Automatically converted to ISO 8601 strings

#### Generate Pivot Table

- **GET** `/rest/data/:document/pivot`

- **Parameters:**

  - `:document` — Module name (e.g., `Opportunity`, `Contact`)

- **Query String:**

  - All parameters from the `find` endpoint (filter, sort, limit, start, fields, displayName, displayType, withDetailFields)
  - `pivotConfig` — Pivot table configuration in JSON format (required)

- **`pivotConfig` Format:**

  ```typescript
  {
    columns?: Array<{
      field: string;
      order?: 'ASC' | 'DESC';
      format?: string;
      aggregator?: 'D' | 'W' | 'M' | 'Q' | 'Y'; // Date bucketing (D=day, W=week, M=month, Q=quarter, Y=year)
    }>;
    rows: Array<{
      field: string;
      order?: 'ASC' | 'DESC';
      showSubtotal?: boolean;
    }>;
    values: Array<{
      field: string;
      aggregator: 'count' | 'sum' | 'avg' | 'min' | 'max';
      format?: string; // Display format (e.g., 'currency', 'percentage')
    }>;
    options?: {
      showRowGrandTotals?: boolean;
      showColGrandTotals?: boolean;
      showSubtotals?: boolean;
    };
  }
  ```

- **Usage Example:**

  ```http
  GET /rest/data/Opportunity/pivot?filter={"status":{"$in":["New","In Visit"]}}&pivotConfig={"rows":[{"field":"status"}],"columns":[{"field":"type"}],"values":[{"field":"value","aggregator":"sum"}]}
  ```

- **Headers:** Requires authentication

- **Success Response:**

  The endpoint returns a synchronous JSON response with hierarchical pivot table data, enriched metadata, and calculated totals.

  ```json
  {
    "success": true,
    "metadata": {
      "rows": [
        {
          "field": "status",
          "label": "Status",
          "type": "picklist",
          "level": 0
        }
      ],
      "columns": [
        {
          "field": "type",
          "label": "Type",
          "type": "picklist",
          "values": [
            { "key": "Residential", "label": "Residential" },
            { "key": "Commercial", "label": "Commercial" }
          ]
        }
      ],
      "values": [
        {
          "field": "value",
          "aggregator": "sum",
          "label": "Value",
          "type": "money",
          "format": "currency"
        }
      ]
    },
    "data": [
      {
        "key": "New",
        "label": "New",
        "level": 0,
        "cells": {
          "Residential": { "value": 150000 },
          "Commercial": { "value": 200000 }
        },
        "totals": { "value": 350000 },
        "children": []
      },
      {
        "key": "In Visit",
        "label": "In Visit",
        "level": 0,
        "cells": {
          "Residential": { "value": 300000 },
          "Commercial": { "value": 250000 }
        },
        "totals": { "value": 550000 },
        "children": []
      }
    ],
    "grandTotals": {
      "cells": {
        "Residential": { "value": 450000 },
        "Commercial": { "value": 450000 }
      },
      "totals": { "value": 900000 }
    },
    "columnHeaders": [
      {
        "key": "Residential",
        "value": "Residential",
        "label": "Residential",
        "level": 0
      },
      {
        "key": "Commercial",
        "value": "Commercial",
        "label": "Commercial",
        "level": 0
      }
    ],
    "total": 2
  }
  ```

  **Response Structure:**
  - `metadata`: Enriched configuration with labels, types, and field information
  - `data`: Hierarchical array of pivot rows with nested `children` for multi-level hierarchies
  - `grandTotals`: Aggregated totals across all data
  - `columnHeaders`: Hierarchical array of column header nodes (similar to ExtJS mz-pivot axisTop structure)
  - Each row contains:
    - `key`: Unique identifier for the row
    - `label`: Formatted display label (may include lookup formatting like "Name (Active)")
    - `level`: Hierarchy depth (0 = root level)
    - `cells`: Object mapping column keys to aggregated values
    - `totals`: Row-level subtotals
    - `children`: Nested rows for hierarchical structures
  - Each column header contains:
    - `key`: Full key path (e.g., "27" or "27|Cancelada" for multi-level columns)
    - `value`: Value at this level (e.g., "27" or "Cancelada")
    - `label`: Display label (formatted according to field type)
    - `level`: Depth level (0 = first column dimension)
    - `expanded`: Whether children are visible (optional)
    - `children`: Sub-columns for multi-level column hierarchies (optional)

- **Failure Response:**

  ```json
  {
    "success": false,
    "errors": [
      {
        "message": "[Opportunity] pivotConfig.rows is required and must be a non-empty array"
      }
    ]
  }
  ```

- **Characteristics:**

  - **Internal processing**: Uses internal streaming for efficiency, but returns synchronous JSON response
  - **Python processing**: Uses Polars for pivot table generation
  - **Performance**: Optimized for large data volumes
  - **Permissions**: Automatically applied according to user configuration

- **Complete `pivotConfig` Example:**

  ```json
  {
    "rows": [
      { "field": "status" },
      { "field": "priority", "order": "DESC" }
    ],
    "columns": [
      { "field": "type" }
    ],
    "values": [
      { "field": "value", "aggregator": "sum" },
      { "field": "_id", "aggregator": "count" }
    ]
  }
  ```

- **Multi-level Columns Example (Date Buckets with Status):**

  For multi-level columns, the `columnHeaders` will be hierarchical:

  ```json
  {
    "columns": [
      { "field": "createdAt", "aggregator": "M" },
      { "field": "status" }
    ]
  }
  ```

  This creates a hierarchical column structure where:
  - Level 0: Month values (e.g., "2024-01", "2024-02")
  - Level 1: Status values under each month (e.g., "New", "In Progress")
  - Column keys use `|` separator: `"2024-01|New"` for cells lookup

- **Important notes:**

  - `rows` is required and must contain at least one field
  - `values` is required and must contain at least one field
  - `columns` is optional
  - Processing is done internally with streaming, but response is synchronous JSON
  - Requires `uv` installed on server (already included in Docker image)
  - **Hierarchical structure**: Multi-level rows create nested `children` arrays
  - **Lookup formatting**: Lookup fields without sub-fields are formatted using `descriptionFields` (e.g., "Name (Active)")
  - **Nested field labels**: Labels for nested fields are concatenated (e.g., "Group > Name" for `_user.group.name`)
  - **Subtotals**: Each hierarchy level includes `totals` for that level
  - **Grand totals**: Root-level `grandTotals` contains aggregates for all data
  - **Column headers**: Hierarchical structure for multi-level columns (e.g., date buckets with status)
  - **Multilingual**: Labels respect `Accept-Language` header (defaults to `pt_BR`)
  - **Record limit**: Default limit of 100,000 records (configurable via `PIVOT_MAX_RECORDS` env var). If limit is reached, response includes `limitInfo`:
    ```json
    {
      "limitInfo": {
        "limited": true,
        "limit": 100000,
        "total": 150000
      }
    }
    ```

#### Generate Graph

- **GET** `/rest/data/:document/graph`
- **Parameters:**
  - `:document` — Module name (e.g., `Opportunity`)
  - Query parameters (optional): `filter`, `sort`, `limit`, `start`, `fields`, `displayName`, `displayType`, `withDetailFields` (same as `find` endpoint)
  - `graphConfig` (required) — Graph configuration in JSON format
- **Response:**
  - **Success:** `200 OK` with `Content-Type: image/svg+xml` and SVG body
  - **Error:** `400 Bad Request` with JSON error
- **Characteristics:**
  - **Internal processing**: Uses internal streaming for efficiency
  - **Python processing**: Uses Polars for aggregations (performance) and pandas/matplotlib for visualization
  - **Performance**: Polars is 3-10x faster than Pandas for groupby/aggregations
  - **Permissions**: Automatically applied according to user configuration
  - **SVG format**: Returns SVG directly as HTTP response (scalable, no quality loss)
  - **Supported types**: bar, line, pie, scatter, histogram, timeSeries
- **`graphConfig` structure:**
  ```typescript
  {
    type: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'timeSeries';
    xAxis?: {
      field: string;      // Field for X axis
      label?: string;     // Custom label
      format?: string;     // Value format
    };
    yAxis?: {
      field: string;      // Field for Y axis
      label?: string;     // Custom label
      format?: string;     // Value format
    };
    categoryField?: string;  // Field to group by (e.g., status, type)
    aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';  // Aggregation type
    title?: string;       // Chart title
    width?: number;       // Width in pixels (default: 800)
    height?: number;      // Height in pixels (default: 600)
    colors?: string[];    // Custom colors
    showLegend?: boolean; // Show legend (default: true)
    showGrid?: boolean;   // Show grid (default: true)
  }
  ```
- **Usage examples:**
  - **Bar chart by status (count):**
    ```json
    {
      "type": "bar",
      "categoryField": "status",
      "aggregation": "count",
      "xAxis": { "field": "status", "label": "Status" },
      "yAxis": { "field": "code", "label": "Quantity" },
      "title": "Opportunities by Status"
    }
    ```
  - **Bar chart by status (sum of values):**
    ```json
    {
      "type": "bar",
      "categoryField": "status",
      "aggregation": "sum",
      "xAxis": { "field": "status", "label": "Status" },
      "yAxis": { "field": "amount.value", "label": "Total Value" },
      "title": "Total Value by Status"
    }
    ```
  - **Bar chart by director:**
    ```json
    {
      "type": "bar",
      "categoryField": "_user.director.nickname",
      "aggregation": "count",
      "xAxis": { "field": "_user.director.nickname", "label": "Director" },
      "yAxis": { "field": "code", "label": "Quantity" },
      "title": "Opportunities by Director"
    }
    ```
  - **Pie chart:**
    ```json
    {
      "type": "pie",
      "categoryField": "status",
      "aggregation": "count",
      "yAxis": { "field": "code" },
      "title": "Distribution by Status"
    }
    ```
- **Important notes:**
  - `type` is required
  - For `bar`, `line`, `scatter`, `timeSeries` charts: `xAxis.field` and `yAxis.field` are required
  - For `histogram` charts: `yAxis.field` is required
  - For `pie` charts: `categoryField` is required
  - When `categoryField` and `aggregation` are specified, data is grouped and aggregated using Polars (faster)
  - Processing is done internally with streaming, but response is synchronous SVG
  - Requires `uv`, `polars`, `pandas`, `matplotlib`, and `pyarrow` installed (already included in Docker image)
  - Total: Record total can be calculated in parallel (doesn't block stream)

#### Create Record

🚧 Under construction

#### Update Records

🚧 Under construction

#### Delete Records

🚧 Under construction

---

### 3. History

#### List History

🚧 Under construction

---

### 4. Comments

#### List Comments

🚧 Under construction

#### Add Comment

🚧 Under construction

---

### 5. File Upload

#### Upload File

🚧 Under construction

#### Delete File

🚧 Under construction

---

### 6. Address Search

#### Search by ZIP Code

🚧 Under construction

#### Search by State Cities

🚧 Under construction

#### Search by City Neighborhoods

🚧 Under construction

#### Search by Streets

🚧 Under construction

---

### 7. Admin Meta API

All endpoints under `/api/admin/meta/*` require **admin** authentication (`user.admin === true`). Use the same `Authorization` header with a token from an admin user. See [ADR-0006](../adr/0006-meta-crud-api.md).

#### List document/composite metas

- **GET** `/api/admin/meta`
- **Headers:** `Authorization: <token>` (admin user)
- **Success Response:**
  ```json
  {
    "success": true,
    "data": [
      { "_id": "Contact", "name": "Contact", "type": "document", "label": { "en": "Contact" } },
      { "_id": "Namespace", "name": "Namespace", "type": "namespace", "label": {} }
    ]
  }
  ```
- **401:** Non-admin or missing/invalid token.

#### List metas for a document

- **GET** `/api/admin/meta/:document`
- **Params:** `document` — document name (e.g. `Contact`, `Namespace`)
- **Success Response:**
  ```json
  {
    "success": true,
    "data": [
      { "_id": "Contact", "name": "Contact", "type": "document", "document": null },
      { "_id": "Contact:list:Default", "name": "Default", "type": "list", "document": "Contact" }
    ]
  }
  ```
- **404:** Document not found.

#### Get a specific meta

- **GET** `/api/admin/meta/:document/:type` (canonical for `document` and `composite`)
- **GET** `/api/admin/meta/:document/:type/:name` (canonical for named types: list | view | access | pivot | card | namespace)
- **Params:** `document`, `type` (document | composite | list | view | access | pivot | card | namespace), `name` (required only for named types)
- **Examples:** `GET /api/admin/meta/Contact/document`, `GET /api/admin/meta/Contact/list/Default`
- **Compatibility:** `GET /api/admin/meta/Contact/document/Contact` is still accepted as a legacy alias.
- **Success Response:** `{ "success": true, "data": { "_id": "...", "type": "...", ... } }`
- **400:** Invalid type. **404:** Meta not found.

#### Get hook code

- **GET** `/api/admin/meta/:document/hook/:hookName`
- **Params:** `hookName` — one of `scriptBeforeValidation`, `validationScript`, `scriptAfterSave`, `validationData`
- **Success Response:** `{ "success": true, "data": { "hookName": "...", "value": "<code or JSON>" } }` (value is raw string for JS hooks or object for validationData)
- **400:** Invalid hook name. **404:** Document or hook not found.

#### Upsert meta

- **PUT** `/api/admin/meta/:document/:type` (canonical for `document` and `composite`)
- **PUT** `/api/admin/meta/:document/:type/:name` (canonical for named types)
- **Headers:** `Content-Type: application/json`
- **Body:** Full meta object (will be stored with `_id`, `type`, `name`, and `document` set as needed)
- **Validation:** Request is validated with `MetaObjectSchema.safeParse` before write.
- **Success Response:** `{ "success": true, "action": "created" | "updated", "_id": "..." }` (201 for created, 200 for updated)
- **400:** Invalid type/body or schema issues (returns detailed `errors` with invalid paths).

#### Delete meta

- **DELETE** `/api/admin/meta/:document/:type` (canonical for `document` and `composite`)
- **DELETE** `/api/admin/meta/:document/:type/:name` (canonical for named types)
- **Success Response:** `{ "success": true }`
- **404:** Meta not found.

#### Update hook

- **PUT** `/api/admin/meta/:document/hook/:hookName`
- **Body:** Raw string (JS) or JSON object (for `validationData`)
- **Validation:** JS hooks must be string; `validationData` must be object; full meta schema is validated before persisting.
- **Hook rules (enforced in apply + doctor):**
  - Comments are not allowed in JS hook source (`//` and `/* */`)
  - Forbidden APIs: `require`, `import`, `process`, `global`, `globalThis`, `eval`, `Function`, and low-level modules (`fs`, `net`, `dgram`, `child_process`)
  - Syntax must be valid JavaScript
  - `scriptBeforeValidation` and `validationScript` must include explicit `return`
- **Success Response:** `{ "success": true }`
- **400:** Invalid hook name or invalid payload/schema.

#### Validate hook (dry-run)

- **POST** `/api/admin/meta/hook/validate`
- **Body:** `{ "hookName": "...", "code": "return data;", "document": "Contact" }` (`document` optional)
- **Behavior:** validates hook payload without persisting; if `document` is provided, validates the merged document/composite meta contract.
- **Success Response:** `{ "success": true, "valid": true, "errors": [] }`

#### Remove hook

- **DELETE** `/api/admin/meta/:document/hook/:hookName`
- **Success Response:** `{ "success": true }`

#### Meta history

- **GET** `/api/admin/meta/:metaId/history`
- **Query:** `limit` (default `10`, max `100`), `offset` (default `0`)
- **Success Response:** `{ "success": true, "data": [{ "version": 3, "operation": "update", "changedBy": "...", "changedAt": "..." }] }`

- **GET** `/api/admin/meta/:metaId/history/:version`
- **Success Response:** `{ "success": true, "data": { "metaId": "Contact", "version": 2, "snapshot": { ... } } }`

#### Rollback meta

- **POST** `/api/admin/meta/:metaId/rollback`
- **Body:** `{ "version": 2 }` (optional; if omitted, latest history version is used)
- **Success Response:** `{ "success": true, "action": "rolled-back", "version": 2, "data": { ...restoredMeta } }`
- **400:** Invalid `version` or invalid historical snapshot.
- **404:** History version not found.

#### Meta doctor

- **POST** `/api/admin/meta/doctor`
- **Body:** `{ "document": "Contact" }` (optional)
- **Checks:** schema validation, orphan metas, lookup targets, access/profile coherence, queue resource consistency with `Namespace.QueueConfig.resources`, and hook static checks (comments, forbidden APIs, syntax, required return)
- **Success Response:** `{ "success": true, "summary": { "total": 42, "valid": 40, "warnings": 1, "errors": 1 }, "issues": [...] }`

#### Reload metadata

- **POST** `/api/admin/meta/reload`
- **Body:** none
- **Success Response:** `{ "success": true }`
- Triggers in-memory metadata reload; call after modifying metas so the server picks up changes.

---

## Error Handling

All endpoints return a boolean `success`. If `success` is `false`, an `errors` array is provided with error messages.

---

## Postman Collection

A Postman collection is available for testing the Konecty API endpoints, including OTP authentication.

### Importing the Collection

1. **Download the collection:**
   - Collection file: [`docs/postman/Konecty-API.postman_collection.json`](../postman/Konecty-API.postman_collection.json)
   - Environment file: [`docs/postman/Konecty-API.postman_environment.json`](../postman/Konecty-API.postman_environment.json)

2. **Import into Postman:**
   - Open Postman
   - Click **Import** button
   - Select both files (collection and environment)
   - Or drag and drop the files into Postman

3. **Configure Environment:**
   - Select the imported environment "Konecty Local Development"
   - Update `baseUrl` if your server is running on a different host/port
   - Set `authToken` after successful authentication (for authenticated endpoints)

### Collection Structure

The collection includes:

- **Authentication**
  - Login (traditional username/password)
  - **OTP Authentication**
- **Admin Meta API** (admin token required)
  - List documents, list metas by document, get meta, get hook, upsert/delete meta, upsert/delete hook, history, rollback, doctor, reload
    - Request OTP - Phone (with examples for WhatsApp, Email fallback, errors)
    - Request OTP - Email
    - Verify OTP - Phone (with examples for success, invalid code, expired, max attempts)
    - Verify OTP - Email

### Using the Collection

#### Testing OTP Authentication Flow

1. **Request OTP:**
   - Use "Request OTP - Phone" or "Request OTP - Email"
   - Update the `phoneNumber` or `email` in the request body
   - Send the request
   - Check the response for delivery method (whatsapp, email, etc.)

2. **Verify OTP:**
   - Check your phone/email for the 6-digit OTP code
   - Use "Verify OTP - Phone" or "Verify OTP - Email"
   - Enter the received OTP code in the `otpCode` field
   - Send the request
   - On success, save the `authId` token to the environment variable `authToken`

3. **Use Authenticated Endpoints:**
   - The `authToken` can be used in subsequent requests
   - Add it as an `Authorization` header: `Authorization: {{authToken}}`

### Examples

#### Example 1: OTP Authentication via Phone

```http
POST /api/auth/request-otp
Content-Type: application/json

{
  "phoneNumber": "+5511999999999"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent via whatsapp"
}
```

Then verify:
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+5511999999999",
  "otpCode": "123456"
}
```

#### Example 2: OTP Authentication via Email

```http
POST /api/auth/request-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent via email"
}
```

Then verify:
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otpCode": "123456"
}
```

### Collection Variables

- `baseUrl`: Base URL for API requests (default: `http://localhost:3000`)
- `authToken`: Authentication token (set after successful login/OTP verification)

### Response Examples

The collection includes multiple response examples for each endpoint:
- Success scenarios
- Error scenarios (user not found, invalid format, rate limit, expired OTP, etc.)
- Different delivery methods (WhatsApp, RabbitMQ, Email)

These examples help understand expected responses and error handling.

---


