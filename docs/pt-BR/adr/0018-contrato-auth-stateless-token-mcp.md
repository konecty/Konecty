# ADR-0018: Contrato de Autenticação Stateless por Token no MCP

## Status
Accepted

## Date
2026-03-18

## Context
Os agentes MCP concluíam a verificação OTP, mas falhavam nas tools protegidas seguintes porque o reuso do token não estava explícito no contrato das tools. O servidor já suporta extração de token por headers e cookies HTTP, porém agentes atuam principalmente via argumentos das tools e nem sempre controlam headers de transporte.

Também é necessário manter invalidação explícita de sessão no logout para revogar tokens que não devem mais ser usados.

## Decision
Adotar contrato stateless de autenticação no MCP:
- `session_verify_otp` deve retornar `authId` de forma explícita com instruções de uso.
- Tools protegidas do User MCP devem aceitar `authTokenId` como entrada explícita.
- O cliente é responsável por armazenar `authId` e reenviar em cada chamada protegida.
- Extração por header e cookie permanece como fallback de compatibilidade.
- `session_logout` deve revogar token no servidor removendo-o de `services.resume.loginTokens`.

## Alternatives considered
- Manter autenticação apenas por header/cookie e depender de prompts.
- Manter logout no-op e descartar token apenas no cliente.

## Consequences
Positive:
- Melhor recuperação do agente após verificação OTP.
- Menor taxa de retries de autenticação e erros `[get-user] User not found`.
- Caminho determinístico para revogação de token alinhado ao modelo de auth do Konecty.

Negative:
- Schemas das tools protegidas ficam mais verbosos por incluir `authTokenId`.
- Clientes precisam implementar persistência de token explicitamente.

## Implementation plan
- Adicionar helpers compartilhados de autenticação para resolução de token e resposta padrão de não autorizado.
- Atualizar tools protegidas para resolver token primeiro por argumento e depois por fallback de transporte.
- Atualizar prompts e documentação com o contrato stateless e passos de recuperação.
- Implementar `session_logout` real usando a lógica de logout do servidor.

## References
- `src/mcp/user/tools/session.ts`
- `src/mcp/user/tools/common.ts`
- `src/mcp/user/tools/modules.ts`
- `src/mcp/user/tools/records.ts`
- `src/mcp/user/tools/query.ts`
- `src/mcp/user/tools/files.ts`
- `src/mcp/shared/errors.ts`
- `src/imports/auth/logout/index.js`
- `docs/pt-BR/mcp.md`
