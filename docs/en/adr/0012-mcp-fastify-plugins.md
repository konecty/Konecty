# ADR-0012: MCP Servers as Fastify Plugins

## Status
Accepted

## Date
2026-03-18

## Context
Konecty needs two MCP endpoints with different security boundaries and responsibilities. The backend already uses Fastify plugins as the standard architectural pattern for route composition and lifecycle control.

## Decision
Implement two MCP servers as Fastify plugins:
- User MCP at `/mcp`
- Admin MCP at `/admin-mcp`

Both plugins are registered at startup and use request-time guards to enforce enablement and authorization.

## Alternatives considered
- Separate standalone MCP process outside Fastify.
- A single MCP endpoint with role-based tool filtering only.

## Consequences
Positive:
- Reuses existing server architecture and middleware behavior.
- Clear separation between user and admin tool surfaces.
- Lower operational complexity than an additional process.

Negative:
- Shared runtime requires careful isolation of auth and rate limiting per endpoint.

## Implementation plan
- Add user and admin MCP plugin modules under `src/mcp`.
- Register both plugins in `src/server/routes/index.ts`.
- Add endpoint-specific preHandlers for feature flag and permission checks.
- Wrap plugins with `fastify-plugin` using `encapsulate: true` so each prefixed instance (`/mcp`, `/admin-mcp`) owns its own routes; the default non-encapsulated `fp` would register duplicate `POST /` on the parent.

## References
- `src/server/routes/index.ts`
- `docs/en/adr/0016-user-admin-mcp-separation.md`
