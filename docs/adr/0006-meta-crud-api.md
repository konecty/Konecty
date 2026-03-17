# 0006 — Admin Meta CRUD API

## Status

Accepted

## Date

2026-03-16

## Context

AI agents and tooling need programmatic access to read, create, update, and delete Konecty metadata (documents, lists, views, access profiles, pivots, hooks, namespace). The existing `/api/document` endpoints allow basic meta operations but use `checkMetaOperation` which is tied to the `user.access.meta` permission system designed for UI-driven editing.

The new meta skills project requires dedicated admin-only endpoints that provide comprehensive CRUD over all metadata types in the `MetaObjects` collection, including hooks and the Namespace singleton.

## Decision

Create a new set of API endpoints under `/api/admin/meta/*` with the following characteristics:

1. **All endpoints require `user.admin === true`** — enforced via a Fastify `preHandler` hook shared across all routes
2. **Direct MongoDB operations** — read/write to `MetaObjects` collection via `MetaObject.MetaObject`
3. **Support for all meta types**: document, composite, list, view, access, pivot, card, namespace
4. **Dedicated hook sub-routes** — separate GET/PUT/DELETE for hook fields on document metas
5. **Reload endpoint** — `POST /api/admin/meta/reload` to trigger `loadMetaObjects()` after changes

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/meta` | List all document/composite metas |
| GET | `/api/admin/meta/:document` | List all metas for a document |
| GET | `/api/admin/meta/:document/:type/:name` | Get specific meta |
| GET | `/api/admin/meta/:document/hook/:hookName` | Get hook code/JSON |
| PUT | `/api/admin/meta/:document/:type/:name` | Upsert meta |
| DELETE | `/api/admin/meta/:document/:type/:name` | Delete meta |
| PUT | `/api/admin/meta/:document/hook/:hookName` | Update hook |
| DELETE | `/api/admin/meta/:document/hook/:hookName` | Remove hook |
| POST | `/api/admin/meta/reload` | Reload all metadata |

## Alternatives considered

1. **Extend existing `/api/document` endpoints** — rejected because those endpoints use a different auth model (`checkMetaOperation`) and mixing admin-only operations would complicate access control
2. **Direct MongoDB access from skills** — rejected because it bypasses all server-side logic and requires exposing database credentials to agents
3. **GraphQL meta API** — rejected per YAGNI; REST is simpler and sufficient

## Consequences

- Admin users gain full CRUD control over metadata via HTTP API
- Non-admin users cannot access these endpoints at all
- After modifying metadata, a reload (`POST /reload`) may be needed for changes to take effect in the running server
- Skills can depend on these endpoints for all metadata operations

## Implementation plan

1. Create `src/server/routes/api/admin/meta/index.ts`
2. Register as plugin under `/api/admin/meta` in the existing admin route
3. Add tests
4. Open draft PR against `develop`

## References

- MetaObject model: `src/imports/model/MetaObject.ts`
- Existing document API: `src/server/routes/api/document/index.ts`
- Existing admin API: `src/server/routes/api/admin/index.ts`
