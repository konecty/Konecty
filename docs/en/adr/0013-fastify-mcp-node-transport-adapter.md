# ADR-0013: Fastify to MCP Node Transport Adapter

## Status
Accepted

## Date
2026-03-18

## Context
Konecty runs on Fastify, while MCP Streamable HTTP transport relies on Node HTTP request and response primitives. The implementation must support MCP over HTTP without replacing the existing server stack.

## Decision
Use the MCP TypeScript SDK v1.x with Node transport integration and bridge Fastify handlers through `req.raw` and `reply.raw`.

## Alternatives considered
- Build a custom transport adapter from scratch.
- Move MCP endpoints to another framework or process.

## Consequences
Positive:
- Uses official SDK and transport support.
- Preserves Fastify as the single web server.
- Reduces protocol handling risk by reusing upstream implementation.

Negative:
- Adds dependency on MCP transport package lifecycle and compatibility.

## Implementation plan
- Create shared transport helper under `src/mcp/shared/transport.ts`.
- Standardize MCP request handling for POST, GET, and DELETE.
- Keep transport wiring isolated from business tool logic.

## References
- `src/mcp/shared/transport.ts`
- `src/server/routes/index.ts`
