# ADR-0018: MCP Stateless Authentication Token Contract

## Status
Accepted

## Date
2026-03-18

## Context
MCP agents were completing OTP verification but failing in subsequent protected tools because token reuse was not explicit enough in the tool contract. The server currently supports token extraction from HTTP headers and cookies, but agents primarily interact through tool arguments and do not reliably control transport headers.

Konecty also requires explicit session invalidation support for logout to revoke tokens that should no longer be used.

## Decision
Adopt a stateless authentication contract for MCP:
- `session_verify_otp` must return `authId` explicitly with usage instructions.
- Protected user tools must accept `authTokenId` as explicit input.
- The client is responsible for storing `authId` and forwarding it on each protected call.
- Header and cookie token extraction remain as compatibility fallback.
- `session_logout` must revoke token server-side by removing it from `services.resume.loginTokens`.

## Alternatives considered
- Keep transport-only auth via headers/cookies and rely on prompts.
- Keep no-op logout and only discard token on client side.

## Consequences
Positive:
- Better agent recovery after OTP verification.
- Lower rate of authentication retries and `[get-user] User not found` failures.
- Deterministic token revocation path aligned with Konecty auth model.

Negative:
- Protected tool schemas become more verbose due to `authTokenId`.
- Clients must implement token persistence explicitly.

## Implementation plan
- Add shared auth helpers for token resolution and standardized unauthorized response.
- Update user protected tools to resolve token from argument first and fallback transport second.
- Update prompts and docs to describe the stateless contract and recovery steps.
- Implement real `session_logout` calling server-side logout logic.

## References
- `src/mcp/user/tools/session.ts`
- `src/mcp/user/tools/common.ts`
- `src/mcp/user/tools/modules.ts`
- `src/mcp/user/tools/records.ts`
- `src/mcp/user/tools/query.ts`
- `src/mcp/user/tools/files.ts`
- `src/mcp/shared/errors.ts`
- `src/imports/auth/logout/index.js`
- `docs/en/mcp.md`
