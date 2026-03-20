# ADR-0017: ChatGPT UI Guideline Conformance for Widgets

## Status
Accepted

## Date
2026-03-18

## Context
Konecty MCP widgets must be approved for OpenAI app distribution. OpenAI guidelines impose visual and interaction constraints that differ from full Konecty UI conventions.

## Decision
Implement widgets with ChatGPT guideline conformance as the primary requirement:
- System fonts in widgets.
- System-oriented structural colors.
- Outlined monochromatic icon style.
- Konecty primary color reserved for accents such as CTA and active indicators.

Do not use `@apps-sdk-ui` due project-level Tailwind 3 baseline and package requirement for Tailwind 4.

## Alternatives considered
- Full Konecty visual system inside widgets.
- Adopt `@apps-sdk-ui` and migrate widget stack to Tailwind 4.

## Consequences
Positive:
- Higher probability of OpenAI review approval.
- Preserves Konecty brand through controlled accent usage.
- Avoids framework mismatch and migration risk.

Negative:
- Visual parity with the main Konecty UI is intentionally reduced inside ChatGPT widgets.

## Implementation plan
- Implement widget style constraints in `src/mcp/widgets`.
- Keep icon and interaction patterns aligned with guideline limits.
- Validate widgets against OpenAI visual and submission guidance.

## References
- `src/mcp/widgets`
- `docs/en/mcp.md`
