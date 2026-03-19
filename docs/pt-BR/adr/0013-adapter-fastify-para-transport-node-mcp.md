# ADR-0013: Adapter Fastify para Transport Node do MCP

## Status
Accepted

## Date
2026-03-18

## Context
O Konecty usa Fastify, enquanto o transporte Streamable HTTP do MCP trabalha com primitivas HTTP nativas do Node. A solução precisa suportar MCP sobre HTTP sem substituir a stack atual.

## Decision
Usar o MCP TypeScript SDK v1.x com integração Node transport e fazer bridge dos handlers Fastify via `req.raw` e `reply.raw`.

## Alternatives considered
- Construir adapter de transporte customizado do zero.
- Mover endpoints MCP para outro framework ou processo.

## Consequences
Positive:
- Reuso de SDK oficial e suporte de transporte upstream.
- Fastify permanece como servidor web único.
- Menor risco de erro de protocolo.

Negative:
- Dependência do ciclo de compatibilidade do pacote de transporte MCP.

## Implementation plan
- Criar helper de transporte compartilhado em `src/mcp/shared/transport.ts`.
- Padronizar tratamento MCP para POST, GET e DELETE.
- Isolar wiring de transporte da lógica de negócio das tools.

## References
- `src/mcp/shared/transport.ts`
- `src/server/routes/index.ts`
