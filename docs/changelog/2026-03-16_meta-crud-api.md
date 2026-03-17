# 2026-03-16: Admin Meta CRUD API

## Summary

New admin-only API endpoints at `/api/admin/meta/*` for managing MetaObjects (document, list, view, access, pivot, hook, namespace).

## Motivation

AI agents and admin tools need programmatic access to read, create, update, and delete metadata without direct MongoDB access. All operations are restricted to admin users (`user.admin === true`).

## What changed

- `src/server/routes/api/admin/meta/index.ts` — new Fastify plugin with:
  - `GET /` — list all document-level metas
  - `GET /:document` — list all metas for a document
  - `GET /:document/:type` — canonical get for `document`/`composite`
  - `GET /:document/:type/:name` — get named meta types (`list`, `view`, `access`, `pivot`, `card`, `namespace`)
  - `GET /:document/hook/:hookName` — get hook code/JSON
  - `PUT /:document/:type` — canonical upsert for `document`/`composite`
  - `PUT /:document/:type/:name` — upsert named meta types
  - `PUT /:document/hook/:hookName` — upsert a hook
  - `POST /hook/validate` — dry-run hook validation (no persistence)
  - `DELETE /:document/:type` — canonical delete for `document`/`composite`
  - `DELETE /:document/:type/:name` — delete named meta types
  - `DELETE /:document/hook/:hookName` — delete a hook
  - `GET /:metaId/history` — list previous versions for a meta
  - `GET /:metaId/history/:version` — read a specific historical version
  - `POST /:metaId/rollback` — restore a meta from history
  - `POST /doctor` — run integrity and schema checks on metas
  - `POST /reload` — reload metadata cache
- `src/imports/meta/loadMetaObjects.ts` — per-meta resilience while loading (`try/catch` + schema validation) to skip invalid metas instead of crashing the server
- `src/server/routes/api/admin/index.ts` — registered the meta plugin
- `docs/adr/0006-meta-crud-api.md` — ADR (EN)
- `docs/pt-BR/adr/0012-api-admin-meta-crud.md` — ADR (PT-BR)
- `docs/en/api.md` — section 7 Admin Meta API
- `docs/pt-BR/api.md` — section 7 API Admin de Metadados
- `docs/postman/Konecty-API.postman_collection.json` — folder "Admin Meta API" with 9 requests

## Technical impact

- All endpoints enforce `user.admin === true` via a `preHandler` hook
- Uses `MetaObject.MetaObject` collection (the unified MetaObjects collection)
- All writes (`PUT` metas and hooks) run `MetaObjectSchema.safeParse` before persistence
- Hook upserts merge code into the parent document meta and revalidate full meta schema
- Hook validation is now centralized (DRY) and reused by both apply endpoints and doctor:
  - no comments in JS hook source
  - forbidden API patterns (`require`, `import`, `process`, `global/globalThis`, `eval`, `Function`, `fs/net/dgram/child_process`)
  - JavaScript syntax check
  - required explicit `return` for `scriptBeforeValidation` and `validationScript`
- Added dry-run endpoint for preflight validation so clients can validate hook payloads before attempting writes
- Introduced `MetaObjects.History` collection with per-meta versioning before update/delete/rollback
- Reload triggers `loadMetaObjects()` to refresh in-memory cache
- `loadMetaObjects` now skips invalid metas and logs errors instead of failing full startup
- Backward compatibility preserved: `/:document/:type/:name` still works as alias for `document`/`composite`

## External impact

- Enables KonectySkills meta-* skills to manage metadata
- No impact on existing non-admin API routes

## How to validate

1. Deploy with the feature branch
2. Authenticate as admin user
3. `GET /api/admin/meta/` should return list of documents
4. `POST /api/admin/meta/doctor` should return summary/issues
5. `GET /api/admin/meta/:metaId/history` should return versions after updates/deletes
6. `POST /api/admin/meta/:metaId/rollback` should restore a prior version
7. Non-admin users should receive 401

## Files affected

```
src/server/routes/api/admin/meta/index.ts (new)
src/imports/meta/loadMetaObjects.ts (modified)
src/server/routes/api/admin/index.ts (modified)
docs/adr/0006-meta-crud-api.md (new)
docs/pt-BR/adr/0012-api-admin-meta-crud.md (new)
docs/pt-BR/adr/README.md (updated)
docs/en/api.md (section 7)
docs/pt-BR/api.md (section 7)
docs/postman/Konecty-API.postman_collection.json (Admin Meta API folder)
```

## Is there a migration?

No.
