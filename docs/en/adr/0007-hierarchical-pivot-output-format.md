# ADR-0007: Hierarchical Pivot Output Format

## Status
Accepted

## Context
The initial pivot table endpoint returned a flat array structure with technical field names and raw values. This made it difficult for frontend applications to:
- Render hierarchical pivot tables with expandable/collapsible rows
- Display user-friendly labels instead of technical field names
- Show subtotals at each hierarchy level
- Format lookup values according to their `descriptionFields`
- Handle nested lookup fields with proper label concatenation

## Decision
We will implement a hierarchical JSON response format that includes:
1. **Enriched metadata**: Labels, types, and field information extracted from `MetaObject.Meta`
2. **Hierarchical data structure**: Nested `children` arrays for multi-level row hierarchies
3. **Subtotals per level**: Each hierarchy level includes its own `totals`
4. **Grand totals**: Root-level aggregates for all data
5. **Lookup formatting**: Automatic formatting of lookup values using `formatPattern` based on `descriptionFields`
6. **Nested field labels**: Concatenated labels for nested fields (e.g., "Group > Name" for `_user.group.name`)

## Structure

### Response Format
```json
{
  "success": true,
  "metadata": {
    "rows": [
      {
        "field": "_user.director.nickname",
        "label": "Diretor > Apelido",
        "type": "text",
        "level": 0
      }
    ],
    "columns": [...],
    "values": [...]
  },
  "data": [
    {
      "key": "ANTONIOBRUM",
      "label": "ANTONIOBRUM",
      "level": 0,
      "cells": {...},
      "totals": {...},
      "children": [...]
    }
  ],
  "grandTotals": {
    "cells": {...},
    "totals": {...}
  }
}
```

### Lookup Formatting Rules
- When a lookup field is used without a sub-field (e.g., `_user`), format using `descriptionFields`:
  - Separate simple fields from nested fields
  - Use first simple field as main value
  - Add other simple fields in parentheses, separated by `-`
  - Example: `descriptionFields: ["name", "active"]` → `"Fulano (Sim)"`

- For nested fields, concatenate parent labels:
  - `_user.group.name` → `"Grupo > Nome"`

## Consequences

### Positive
- Frontend can render hierarchical tables directly without additional processing
- User-friendly labels improve UX
- Subtotals and grand totals calculated server-side reduce client computation
- Consistent formatting of lookup values across the application
- Metadata included in response reduces need for additional API calls

### Negative
- Breaking change: Response format changed from flat array to hierarchical structure
- Slightly larger response payload due to metadata inclusion
- More complex Python processing logic required

### Mitigation
- The hierarchical structure is more intuitive and easier to work with
- Metadata can be cached by frontend to reduce subsequent requests
- Python processing is efficient using Polars library

## Implementation Details

### Metadata Enrichment
- `enrichPivotConfig()` extracts metadata from `MetaObject.Meta[document]`
- Recursively navigates lookup fields to resolve nested field metadata
- Concatenates parent labels for nested fields
- Extracts picklist options with translated labels

### Python Processing
- Receives enriched config with metadata
- Applies `formatPattern` to lookup values
- Builds hierarchical structure with `children` arrays
- Calculates subtotals at each level
- Calculates grand totals

### Multilingual Support
- Extracts `Accept-Language` header from request
- Defaults to `pt_BR` if not provided
- Uses language to select appropriate labels from metadata

## References
- ADR-0006: Python Integration for Pivot Tables
- ADR-0001: HTTP Streaming for Data Retrieval

