# ADR-0015: Rate Limiting do MCP em Memória

## Status
Accepted

## Date
2026-03-18

## Context
Os endpoints MCP precisam de proteção contra abuso. O escopo atual não exige limite global distribuído e não justifica complexidade operacional com Redis.

## Decision
Usar `@fastify/rate-limit` com armazenamento em memória para os endpoints MCP. O throttling de OTP permanece delegado à lógica já existente no backend.

## Alternatives considered
- Rate limiting distribuído com Redis.
- Sem rate limiting específico para MCP.

## Consequences
Positive:
- Baixa complexidade e adoção rápida.
- Atende necessidades imediatas de proteção.
- Alinha com YAGNI e KISS.

Negative:
- Limites são locais por instância em cenário horizontal.

Restrição:
- Konecty permanece em Fastify 4; usar `@fastify/rate-limit` na linha major 9.x. A linha 10+ exige Fastify 5 e falha no registro do plugin.

## Implementation plan
- Registrar plugin de rate limit com políticas por endpoint.
- Aplicar limites mais restritivos no Admin MCP.
- Documentar gatilho de migração para Redis quando limite global por múltiplas instâncias for necessário.

## References
- `src/mcp/shared/rateLimiter.ts`
- `src/server/routes/index.ts`
