# ADR-0014: Proxy Interno MCP para Serviços Konecty

## Status
Accepted

## Date
2026-03-18

## Context
As tools MCP precisam expor capacidades já existentes no Konecty sem duplicar regras de negócio. O backend já possui serviços maduros para dados, queries, autenticação, arquivos, gráficos e pivots.

## Decision
Implementar tools MCP como adaptadores que chamam serviços internos do Konecty diretamente, sem loopback HTTP para endpoints REST locais.

## Alternatives considered
- Chamar endpoints REST locais via HTTP a partir dos handlers MCP.
- Reimplementar lógica específica para MCP.

## Consequences
Positive:
- Mantém fonte única de verdade das regras de negócio.
- Evita overhead de HTTP local e validação duplicada.
- Facilita alinhamento comportamental com APIs e skills existentes.

Negative:
- Acoplamento de compilação mais forte entre camada MCP e módulos de serviço.

## Implementation plan
- Criar `src/mcp/shared/konectyProxy.ts`.
- Mapear cada tool MCP para o serviço interno correspondente.
- Normalizar retorno para `structuredContent` e `content` do MCP.

## References
- `src/mcp/shared/konectyProxy.ts`
- `src/imports/data/api`
- `src/imports/data/data`
