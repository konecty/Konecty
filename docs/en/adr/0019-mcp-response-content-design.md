# ADR-0019: MCP Tool Response Content Design

## Status
Accepted

## Date
2026-03-18

## Context
Several MCP clients prioritize `content.text` for model context and do not consistently use `structuredContent`. In the previous implementation, many tools returned generic summaries such as "Record loaded." in `content.text`, while useful data was only present in `structuredContent`.

That pattern reduced agent effectiveness because essential fields were hidden from the model context in common client implementations.

## Decision
Adopt a dual-channel response design with semantic equivalence:
- `content.text` must contain model-friendly, high-signal output with essential data and actionable next steps.
- `structuredContent` must contain complete machine-friendly JSON payload for programmatic consumers.
- Both channels must represent the same outcome and compatible meaning.
- Generic success text without operational data is no longer acceptable for business tools.

## Alternatives considered
- Keep generic summaries in `content.text` and rely on `structuredContent` only.
- Return JSON string dumps in `content.text` for all tools.

## Consequences
Positive:
- Better agent reasoning and recovery in clients that prioritize `content.text`.
- Preserved machine compatibility through full structured JSON.
- Lower ambiguity in multi-step workflows due to explicit next-step guidance.

Negative:
- Tool handlers must format meaningful textual outputs instead of static one-line summaries.
- Slight increase in maintenance for response text quality.

## Implementation plan
- Introduce shared formatters for common response text patterns.
- Refactor tool handlers to emit informative model-oriented text and keep full structured payloads.
- Update tool descriptions with explicit "Returns" contracts.
- Update MCP documentation with response design and tool I/O reference.

## References
- `src/mcp/shared/textFormatters.ts`
- `src/mcp/shared/errors.ts`
- `src/mcp/user/tools/records.ts`
- `src/mcp/user/tools/query.ts`
- `src/mcp/user/tools/modules.ts`
- `src/mcp/user/tools/files.ts`
- `src/mcp/user/tools/session.ts`
- `src/mcp/admin/tools/metaRead.ts`
- `src/mcp/admin/tools/metaDocument.ts`
- `src/mcp/admin/tools/metaList.ts`
- `src/mcp/admin/tools/metaView.ts`
- `src/mcp/admin/tools/metaAccess.ts`
- `src/mcp/admin/tools/metaHook.ts`
- `src/mcp/admin/tools/metaNamespace.ts`
- `src/mcp/admin/tools/metaPivot.ts`
- `src/mcp/admin/tools/metaDoctor.ts`
- `src/mcp/admin/tools/metaSync.ts`
- `docs/en/mcp.md`
- `docs/pt-BR/mcp.md`
