# Data Explorer Backend

## Date
2026-03-11

## Summary
Backend API endpoints for the Data Explorer feature: module metadata, saved queries CRUD, and data export.

## Motivation
The Data Explorer frontend requires backend endpoints for discovering queryable modules, persisting user queries, and exporting query results.

## What Changed
- New SavedQuery Zod model with proper ObjectId handling
- Explorer modules metadata API (`getExplorerModules`)
- Saved queries CRUD repository (`savedQueriesRepo`)
- Three new Fastify routes: `explorerMetaApi`, `savedQueryApi`, `queryExportApi`
- CrossModuleQuerySchema relaxed to allow empty relations array

## Technical Impact
- New files in `src/imports/model/`, `src/imports/data/api/`, `src/imports/query/`
- New route files in `src/server/routes/rest/query/`
- Modified: `src/server/routes/index.ts` (route registration), `src/imports/types/crossModuleQuery.ts` (schema relaxation)

## External Impact
- New API endpoints: `GET /rest/query/explorer/modules`, CRUD on `/rest/query/saved/*`, `POST /rest/query/export/:format`
- All responses follow `{ success, data }` envelope

## How to Validate
1. Start the backend server
2. `GET /rest/query/explorer/modules` → should return modules with fields and reverse lookups
3. `POST /rest/query/saved` → should create a saved query
4. `POST /rest/query/export/csv` → should return CSV file

## Affected Files
- `src/imports/model/SavedQuery.ts` (new)
- `src/imports/data/api/explorerModules.ts` (new)
- `src/imports/query/savedQueriesRepo.ts` (new)
- `src/server/routes/rest/query/explorerMetaApi.ts` (new)
- `src/server/routes/rest/query/savedQueryApi.ts` (new)
- `src/server/routes/rest/query/queryExportApi.ts` (new)
- `src/server/routes/index.ts` (modified)
- `src/imports/types/crossModuleQuery.ts` (modified)

## Migration
No migration required. The `savedQueries` MongoDB collection will be created automatically on first insert.
