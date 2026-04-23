# ADR-0014: MCP Internal Proxy to Konecty Services

## Status
Accepted

## Date
2026-03-18

## Context
MCP tools must expose existing Konecty capabilities without duplicating business rules. Konecty already has mature domain services for data, query, auth, file, graph, and pivot operations.

## Decision
Implement MCP tools as adapters that call internal Konecty services directly instead of making loopback HTTP calls to Konecty endpoints.

## Alternatives considered
- Call local REST endpoints via HTTP from MCP handlers.
- Reimplement logic specifically for MCP.

## Consequences
Positive:
- Preserves single source of truth for business rules.
- Avoids HTTP loop overhead and duplicated validation.
- Easier to keep behavior aligned with existing APIs and skills.

Negative:
- Tighter compile-time coupling between MCP layer and service modules.

## Implementation plan
- Create `src/mcp/shared/konectyProxy.ts`.
- Map each MCP tool to the corresponding internal service call.
- Normalize return shapes for MCP `structuredContent` and `content`.

## References
- `src/mcp/shared/konectyProxy.ts`
- `src/imports/data/api`
- `src/imports/data/data`
