# ADR-0009: Centralized Error Messages Structure in Backend

> Decision on how to structure user-friendly and reusable error messages in the backend

---

## Status

**Accepted**

Date: 2026-01-08

---

## Context

Error messages in the backend were hardcoded and scattered throughout the code, resulting in:

- **Inconsistency** in tone and format between different endpoints
- **Too technical messages** for end users (e.g., "HTTP error! status: 400")
- **Maintenance difficulty** and lack of standardization
- **Missing error codes** standardized for technical support
- **Duplication** of similar messages in different parts of the code

When implementing the graph functionality, we identified the need to standardize error messages to improve user experience and facilitate maintenance.

---

## Decision

Create a centralized error message structure in `/src/imports/utils/graphErrors.ts` with:

- `getGraphErrorMessage()` function to obtain user-friendly and standardized messages
- Standardized error codes for technical support (e.g., `GRAPH_CONFIG_MISSING`)
- Messages in English (backend standard)
- Structure prepared for possible future extension with multiple languages
- TypeScript interface to ensure correct typing

**Usage pattern**:

```typescript
import { getGraphErrorMessage } from '/imports/utils/graphErrors';

const error = getGraphErrorMessage('GRAPH_CONFIG_MISSING', { document: 'Activity' });
return errorReturn([{ 
  message: error.message,  // User-friendly message in English
  code: error.code,         // Technical code for support
  details: error.details    // Optional technical details
}]);
```

---

## Alternatives Considered

### Alternative 1: Keep hardcoded messages

**Pros:**
- No import overhead
- Messages close to the code that uses them

**Cons:**
- Inconsistency between different parts of the code
- Difficult maintenance and updates
- No standard for error codes
- Messages too technical for users

### Alternative 2: Implement full i18n in backend

**Pros:**
- Backend could return already translated messages

**Cons:**
- Unnecessary complexity (frontend already does translation via react-i18next)
- Duplication of translation effort
- Backend does not have i18n infrastructure for error messages
- Would violate single responsibility principle (frontend already handles i18n)

### Alternative 3: Centralized structure with multi-language support from the start

**Pros:**
- Prepared for future

**Cons:**
- Unnecessary complexity at the moment (YAGNI)
- Backend doesn't need to translate (frontend does it)
- Implementation overhead without immediate need

**Decision**: Implement simple structure in English, but prepared for future extension (code comments indicate how to add multiple languages if needed).

---

## Consequences

### Positive

- **Reusability**: Structure can be used in other parts of the code beyond graphs
- **Consistency**: All messages follow the same pattern and tone
- **Easy maintenance**: Messages centralized in a single file
- **Standardized codes**: Facilitates technical support and debugging
- **Typing**: TypeScript interface ensures correct structure
- **Prepared for future**: Structure can be extended for multiple languages if needed
- **Separation of concerns**: Backend provides user-friendly messages in English, frontend translates

### Negative

- **Requires import**: Need to import utility (minimal impact)
- **Initially English only**: But frontend translates, so not a real problem

### Neutral

- Structure can be generalized for other error types beyond graphs in the future
- If needed, can be extended to support multiple languages without breaking existing code

---

## Implementation Details

### File Structure

```typescript
// graphErrors.ts
export interface GraphErrorResponse {
  message: string;
  code: string;
  details?: string;
}

export function getGraphErrorMessage(
  errorCode: string,
  details?: Record<string, string>
): GraphErrorResponse {
  // Implementation with placeholder replacement
}

const ERROR_MESSAGES: Record<string, string> = {
  GRAPH_CONFIG_MISSING: "Graph configuration not found...",
  // ... other messages
};
```

### Defined Error Codes

- `GRAPH_CONFIG_MISSING`: Graph configuration not found
- `GRAPH_CONFIG_INVALID`: Incomplete configuration
- `GRAPH_CONFIG_TYPE_MISSING`: Graph type not specified
- `GRAPH_CONFIG_AXIS_MISSING`: Axes not configured
- `GRAPH_CONFIG_AXIS_X_MISSING`: X axis not configured
- `GRAPH_CONFIG_AXIS_Y_MISSING`: Y axis not configured
- `GRAPH_CONFIG_CATEGORY_MISSING`: Category field not configured
- `GRAPH_FILTER_INVALID`: Invalid filters
- `GRAPH_PROCESSING_ERROR`: Generic processing error
- `GRAPH_TIMEOUT`: Generation timeout
- `GRAPH_DATA_ERROR`: Error loading data

### Usage Examples

**Basic usage**:
```typescript
const error = getGraphErrorMessage('GRAPH_CONFIG_MISSING');
return errorReturn([{ message: error.message, code: error.code }]);
```

**With details (placeholders)**:
```typescript
const error = getGraphErrorMessage('GRAPH_CONFIG_AXIS_X_MISSING', { type: 'bar' });
// Message: "X axis not configured. Please configure the X axis for bar charts."
return errorReturn([{ 
  message: error.message, 
  code: error.code, 
  details: error.details 
}]);
```

---

## References

- [Code: graphErrors.ts](../../src/imports/utils/graphErrors.ts)
- [Endpoint: dataApi.ts](../../src/server/routes/rest/data/dataApi.ts)
- [Stream: graphStream.ts](../../src/imports/data/api/graphStream.ts)
- [ADR-0008: Graph Endpoint with Polars and Pandas](./0008-graph-endpoint-with-polars-pandas.md)

---

## Implementation Notes

- This structure was initially created for graph error messages, but can be reused for other error types in the future
- The frontend maps error codes to translation keys (e.g., `GRAPH_CONFIG_MISSING` → `graph.error.graph-config-missing`)
- Messages are always in English in the backend; the frontend is responsible for translation using react-i18next
- The structure is prepared for future extension with multiple languages, but this is not necessary at the moment (YAGNI)
