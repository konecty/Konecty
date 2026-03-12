# ADR-0005: Data Explorer Backend Architecture

## Status
Accepted

## Date
2026-03-11

## Context
The Data Explorer feature requires backend API endpoints for module metadata discovery, saved query CRUD, and data export. The previous implementation had an inconsistent response format (missing `{ success, data }` envelope) and TypeScript errors with MongoDB ObjectId handling.

## Decision
1. **Response envelope**: All explorer endpoints return `{ success: true, data: ... }` for consistency with the frontend client expectations.
2. **SavedQuery model**: Zod schema defines `_id` as `string`. Repository layer introduces `SavedQueryDoc = Omit<SavedQuery, '_id'> & { _id: ObjectId }` for MongoDB operations, with `toResponse()` converting back to string `_id`.
3. **Module metadata**: `getExplorerModules()` iterates `MetaObject.Meta`, filters by queryable types (`document`, `composite`) and user access permissions, returns fields with labels and reverse lookups.
4. **CrossModuleQuerySchema**: Relaxed `relations` from `.min(1)` to `.default([])` to support single-module queries without breaking existing cross-module functionality.
5. **Export**: `queryExportApi` converts `crossModuleQuery` result records into a `Readable` stream for CSV/XLSX/JSON export, with audit logging via `accessLogExport`.

## Alternatives Considered
- **Separate endpoint for single-module queries**: Rejected in favor of relaxing the schema constraint, which is simpler and avoids endpoint proliferation.
- **Storing query in separate collection per user**: Rejected; single `savedQueries` collection with access control filtering is sufficient.

## Consequences
- All explorer API responses follow the `{ success, data }` convention
- Single-module queries are valid at the schema level
- Saved queries support owner-based access control with sharing

## Implementation
- Model: `src/imports/model/SavedQuery.ts`
- Repository: `src/imports/query/savedQueriesRepo.ts`
- Module metadata: `src/imports/data/api/explorerModules.ts`
- Routes: `src/server/routes/rest/query/explorerMetaApi.ts`, `savedQueryApi.ts`, `queryExportApi.ts`

## References
- CrossModuleQuerySchema: `src/imports/types/crossModuleQuery.ts`
