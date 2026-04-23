# ADR-0015: MCP Rate Limiting In-Memory

## Status
Accepted

## Date
2026-03-18

## Context
MCP endpoints need abuse protection. Current scope does not require distributed global rate limiting and does not justify Redis operational complexity.

## Decision
Use `@fastify/rate-limit` with in-memory storage for MCP endpoints. Keep OTP request throttling delegated to existing backend logic already enforced by OTP services.

## Alternatives considered
- Redis-backed distributed rate limiting.
- No dedicated MCP rate limiting.

## Consequences
Positive:
- Minimal complexity and fast adoption.
- Satisfies immediate abuse-protection requirements.
- Aligns with YAGNI and KISS principles.

Negative:
- Limits are instance-local in horizontal scale scenarios.

Constraint:
- Konecty stays on Fastify 4; use `@fastify/rate-limit` major version 9.x. Major 10+ targets Fastify 5 and will fail at plugin registration.

## Implementation plan
- Register rate-limit plugin and define per-endpoint policies.
- Apply stricter limits to admin MCP.
- Document migration trigger to Redis if global cross-instance limits become required.

## References
- `src/mcp/shared/rateLimiter.ts`
- `src/server/routes/index.ts`
