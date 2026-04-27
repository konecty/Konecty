# ADR-0016: Separação entre User MCP e Admin MCP

## Status
Accepted

## Date
2026-03-18

## Context
O Konecty possui dois domínios operacionais distintos:
- Operações de usuário com sessão OTP e CRUD de registros.
- Operações administrativas de metadados com privilégio elevado.

Esses domínios possuem perfis de risco e controles de acesso diferentes.

## Decision
Expor endpoints MCP e inventários de tools separados:
- `/mcp` para escopo de usuário.
- `/admin-mcp` para escopo administrativo de metadados.

Aplicar verificação de admin em todas as tools administrativas e guards independentes por endpoint.

## Alternatives considered
- Endpoint único com inventário misto de tools.
- Endpoint único com filtragem dinâmica de tools.

## Consequences
Positive:
- Fronteira de segurança mais forte e modelo claro de menor privilégio.
- Melhor observabilidade e controle operacional por superfície.
- Evolução de políticas facilitada por endpoint.

Negative:
- Maior superfície de rotas e configuração para manter.

## Implementation plan
- Implementar dois módulos de servidor MCP em `src/mcp/user` e `src/mcp/admin`.
- Registrar tools de forma independente por endpoint.
- Aplicar guards, rate limits e validações de permissão específicos por endpoint.

## References
- `src/mcp/user/server.ts`
- `src/mcp/admin/server.ts`
