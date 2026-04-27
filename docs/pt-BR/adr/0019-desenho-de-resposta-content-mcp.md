# ADR-0019: Desenho de Resposta das Tools MCP

## Status
Accepted

## Date
2026-03-18

## Context
Vários clientes MCP priorizam `content.text` no contexto do modelo e não usam `structuredContent` de forma consistente. Na implementação anterior, muitas tools retornavam textos genéricos como "Record loaded." em `content.text`, enquanto os dados úteis estavam apenas em `structuredContent`.

Esse padrão reduzia a efetividade dos agentes, pois campos essenciais não chegavam ao contexto do modelo em clientes comuns.

## Decision
Adotar desenho de resposta em dois canais com equivalência semântica:
- `content.text` deve conter saída orientada ao modelo, com dados essenciais e próximos passos acionáveis.
- `structuredContent` deve conter payload JSON completo orientado à máquina para consumo programático.
- Ambos os canais devem representar o mesmo resultado e significado compatível.
- Texto de sucesso genérico sem dados operacionais deixa de ser aceitável em tools de negócio.

## Alternatives considered
- Manter resumos genéricos em `content.text` e depender apenas de `structuredContent`.
- Retornar dump JSON em `content.text` para todas as tools.

## Consequences
Positive:
- Melhor raciocínio e recuperação dos agentes em clientes que priorizam `content.text`.
- Compatibilidade de máquina preservada por meio de JSON estruturado completo.
- Menor ambiguidade em fluxos multi-etapa por causa de orientação explícita de próximos passos.

Negative:
- Handlers das tools passam a exigir formatação de texto útil, em vez de resumos estáticos.
- Pequeno aumento de manutenção para qualidade dos textos de resposta.

## Implementation plan
- Introduzir formatadores compartilhados para padrões comuns de texto.
- Refatorar handlers para emitir texto informativo orientado ao modelo e manter payload estruturado completo.
- Atualizar descrições das tools com contrato explícito de retorno.
- Atualizar documentação MCP com desenho de resposta e referência de entrada/saída.

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
