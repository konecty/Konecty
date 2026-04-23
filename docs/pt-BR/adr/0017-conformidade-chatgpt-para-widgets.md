# ADR-0017: Conformidade de Widgets com Diretrizes Visuais do ChatGPT

## Status
Accepted

## Date
2026-03-18

## Context
Os widgets MCP do Konecty precisam de aprovação para distribuição de app na OpenAI. As diretrizes visuais da OpenAI impõem restrições que diferem da aplicação integral do design system do Konecty.

## Decision
Implementar widgets com conformidade às diretrizes do ChatGPT como requisito primário:
- Fonte de sistema nos widgets.
- Cores estruturais orientadas ao sistema.
- Estilo de ícones monocromático e outlined.
- Cor primária do Konecty reservada para accents, como CTA e indicadores ativos.

Não usar `@apps-sdk-ui` por incompatibilidade com baseline do projeto em Tailwind 3 e exigência de Tailwind 4 no pacote.

## Alternatives considered
- Aplicar sistema visual completo do Konecty dentro dos widgets.
- Adotar `@apps-sdk-ui` e migrar a stack dos widgets para Tailwind 4.

## Consequences
Positive:
- Maior probabilidade de aprovação na revisão da OpenAI.
- Preserva identidade de marca por uso controlado de accent.
- Evita risco de incompatibilidade de framework e migração adicional.

Negative:
- Paridade visual com a UI principal do Konecty fica intencionalmente reduzida no contexto dos widgets.

## Implementation plan
- Implementar restrições visuais em `src/mcp/widgets`.
- Manter padrão de ícones e interações dentro dos limites de guideline.
- Validar widgets contra documentação de submissão e UI da OpenAI.

## References
- `src/mcp/widgets`
- `docs/pt-BR/mcp.md`
