# ADR-0016: User and Admin MCP Endpoint Separation

## Status
Accepted

## Date
2026-03-18

## Context
Konecty has two distinct operational domains:
- User operations with OTP session and business record CRUD.
- Administrative metadata operations requiring elevated permissions.

These domains have different risk profiles and access controls.

## Decision
Expose separate MCP endpoints and tool registries:
- `/mcp` for user scope tools.
- `/admin-mcp` for administrative metadata tools.

Enforce admin checks on all admin tools and keep separate request guards.

## Alternatives considered
- Single endpoint with mixed tool inventory.
- Single endpoint with dynamic tool filtering only.

## Consequences
Positive:
- Stronger security boundary and clearer least-privilege model.
- Better observability and operational controls per surface.
- Easier policy evolution by endpoint.

Negative:
- Additional routing and configuration surfaces to maintain.

## Implementation plan
- Implement two MCP server modules under `src/mcp/user` and `src/mcp/admin`.
- Register tools independently per endpoint.
- Apply endpoint-specific guards, rate limits, and permission checks.

## References
- `src/mcp/user/server.ts`
- `src/mcp/admin/server.ts`
