# 2026-03-16: Admin Meta CRUD API

## Summary

New admin-only API endpoints at `/api/admin/meta/*` for managing MetaObjects (document, list, view, access, pivot, hook, namespace).

## Motivation

AI agents and admin tools need programmatic access to read, create, update, and delete metadata without direct MongoDB access. All operations are restricted to admin users (`user.admin === true`).

## What changed

- `src/server/routes/api/admin/meta/index.ts` — new Fastify plugin with:
  - `GET /` — list all document-level metas
  - `GET /:document` — list all metas for a document
  - `GET /:document/:type/:name` — get a specific meta
  - `GET /:document/hook/:name/code` — get raw hook code
  - `PUT /:document/:type/:name` — upsert a meta
  - `PUT /:document/hook/:name` — upsert a hook
  - `DELETE /:document/:type/:name` — delete a meta
  - `DELETE /:document/hook/:name` — delete a hook
  - `POST /reload` — reload metadata cache
- `src/server/routes/api/admin/index.ts` — registered the meta plugin
- `docs/adr/0006-meta-crud-api.md` — ADR for this decision

## Technical impact

- All endpoints enforce `user.admin === true` via a `preHandler` hook
- Uses `MetaObject.MetaObject` collection (the unified MetaObjects collection)
- Hook upserts merge code into the parent document meta
- Reload triggers `loadMetaObjects()` to refresh in-memory cache

## External impact

- Enables KonectySkills meta-* skills to manage metadata
- No impact on existing non-admin API routes

## How to validate

1. Deploy with the feature branch
2. Authenticate as admin user
3. `GET /api/admin/meta/` should return list of documents
4. Non-admin users should receive 401

## Files affected

```
src/server/routes/api/admin/meta/index.ts (new)
src/server/routes/api/admin/index.ts (modified)
docs/adr/0006-meta-crud-api.md (new)
```

## Is there a migration?

No.
