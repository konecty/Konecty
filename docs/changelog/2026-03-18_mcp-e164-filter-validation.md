# 2026-03-18 — MCP: E.164 phone OTP and filter validation

## Resumo

Normalização e validação de telefone em E.164 para OTP por WhatsApp/telefone; validação de filtros Konecty no proxy antes de `find`/`pivot`/`graph`; nova tool pública `filter_build` para montar filtros validados.

## Motivação

Agentes enviavam número sem DDI e filtros estilo Mongo, gerando falhas de auth ou resultados sem filtro aplicado (comportamento silencioso no backend).

## O que mudou

- `session_request_otp_phone` e `session_verify_otp_phone`: normalização para E.164 (Brasil: +55 quando só DDD+número); mensagens de erro explícitas; `normalizedPhoneNumber` no sucesso quando aplicável.
- `normalizeKonectyFilter` em `konectyProxy.ts`: rejeita objetos sem chaves reservadas Konecty; coerção de `textSearch` / `conditions` sem `match`; validação com schema `KonFilter`.
- Nova tool `filter_build` (sem auth): entrada `match`, `conditions` (`field` → `term`), `textSearch` opcional.
- Prompts e documentação (`docs/en/mcp.md`, `docs/pt-BR/mcp.md`) atualizados; prompt `build_filter`.

## Impacto técnico

- Filtros inválidos em `records_find`, `query_pivot`, `query_graph` retornam erro MCP em vez de prosseguir com filtro vazio.
- Dependência do schema existente `@imports/model/Filter` (`KonFilter`).

## Impacto externo

Integrações MCP devem usar E.164 no fluxo phone OTP e preferir `filter_build` ou formato estruturado documentado.

## Como validar

- OTP phone: `11999999999` → normalizado para `+5511999999999` (ajustar dígitos de exemplo conforme ambiente).
- `records_find` com `filter: { "status": "x" }` → erro de validação MCP.
- `filter_build` com `conditions: [{ field: "status", operator: "equals", value: "Ativo" }]` → JSON válido em `structuredContent.filter`.

## Arquivos afetados

- `src/mcp/user/tools/session.ts`
- `src/mcp/shared/konectyProxy.ts`
- `src/mcp/user/tools/filterBuilder.ts` (novo)
- `src/mcp/user/tools/index.ts`
- `src/mcp/user/prompts/index.ts`
- `src/mcp/user/tools/records.ts`
- `src/mcp/user/tools/query.ts`
- `docs/en/mcp.md`, `docs/pt-BR/mcp.md`
- `docs/changelog/README.md`

## Existe migração?

Não.
