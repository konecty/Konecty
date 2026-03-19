# ADR-0012: Servidores MCP como Plugins Fastify

## Status
Accepted

## Date
2026-03-18

## Context
O Konecty precisa de dois endpoints MCP com fronteiras de segurança e responsabilidades diferentes. O backend já adota plugins Fastify como padrão arquitetural para composição de rotas e ciclo de vida.

## Decision
Implementar dois servidores MCP como plugins Fastify:
- User MCP em `/mcp`
- Admin MCP em `/admin-mcp`

Ambos são registrados no startup e usam guards em tempo de requisição para habilitação e autorização.

## Alternatives considered
- Processo MCP separado fora do Fastify.
- Endpoint MCP único com filtragem de tools apenas por papel.

## Consequences
Positive:
- Reaproveita a arquitetura atual do servidor.
- Separação clara entre superfície de tools de usuário e admin.
- Menor complexidade operacional que um processo adicional.

Negative:
- Runtime compartilhado exige isolamento cuidadoso de auth e rate limiting por endpoint.

## Implementation plan
- Adicionar módulos de plugin MCP de usuário e admin em `src/mcp`.
- Registrar os plugins em `src/server/routes/index.ts`.
- Aplicar preHandlers específicos de flag e permissão.
- Envolver com `fastify-plugin` usando `encapsulate: true` para que cada prefixo (`/mcp`, `/admin-mcp`) tenha suas próprias rotas; o `fp` sem encapsulação registraria `POST /` duplicado no pai.

## References
- `src/server/routes/index.ts`
- `docs/pt-BR/adr/0016-separacao-user-admin-mcp.md`
