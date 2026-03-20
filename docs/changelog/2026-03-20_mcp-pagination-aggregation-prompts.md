# MCP: Paginação em records_find e agregação cross-module em query_json

## Resumo
Melhoria dos prompts e tool descriptions do MCP para cobrir paginação de registros e agregação cross-module com relations, groupBy e aggregators.

## Motivação
Agentes LLM não entendiam como paginar resultados grandes de `records_find` e desconheciam as capacidades de agregação (groupBy, relations com aggregators) do `query_json`, limitando-se a buscas simples.

## O que mudou

### Prompts (src/mcp/user/prompts/index.ts)
- Adicionada constante `PAGINATION_GUIDANCE` com estratégia de paginação offset-based (start, limit, total, iteração).
- Adicionada constante `CROSS_MODULE_QUERY_GUIDANCE` com estrutura completa da query, relations, aggregators suportados (count, sum, avg, min, max, first, last, push, addToSet, countDistinct), groupBy e exemplos concretos.
- Prompt `find_records` atualizado com passo de paginação e recomendação de usar query_json para agregações.
- Prompt `cross_module_query` reescrito com workflow step-by-step incluindo relations, groupBy e aggregators.

### Tool records_find (src/mcp/user/tools/records.ts)
- Description atualizada para mencionar paginação offset-based, limit default 50, e recomendação de query_json para agregações.
- Parâmetros `limit`, `start` e `fields` agora possuem `.describe()` com orientação de uso.
- Resposta `content.text` inclui informações de paginação (página atual, hasMore, nextStart).
- `structuredContent` agora retorna objeto `pagination` com `start`, `limit`, `returned`, `total`, `hasMore`, `nextStart`.

### Tool query_json (src/mcp/user/tools/query.ts)
- Description reescrita documentando relations, groupBy, aggregators suportados e exemplos.
- `inputSchema` migrado de `z.record(z.unknown())` genérico para schema tipado com `document`, `filter`, `fields`, `sort`, `limit`, `start`, `relations` (com aggregators obrigatórios), `groupBy`, `aggregators`, `includeTotal`, `includeMeta`.
- Resposta `content.text` inclui resumo de agregações (groupBy, aggregators raiz, relations e seus aggregators).
- Erros de validação agora retornam recovery steps específicos para query_json.

### Documentação
- Adicionada seção "Pagination (records_find)" / "Paginação (records_find)" em docs/en/mcp.md e docs/pt-BR/mcp.md.
- Adicionada seção "Cross-Module Query (query_json) — Aggregation" / "Query Cross-Module (query_json) — Agregação" com exemplos e tabela de aggregators.
- Referências I/O de `records_find` e `query_json` atualizadas.
- Lista de prompts de usuário atualizada com descrições.

## Impacto técnico
- Agentes passam a receber orientação de paginação explícita com `hasMore` e `nextStart` na resposta.
- Agentes passam a conhecer e utilizar as capacidades de agregação cross-module do `query_json` para trazer dados consolidados (contagens, somas, médias) sem necessidade de paginar todos os registros.
- Schema tipado do `query_json` melhora autocompletion e validação pelo LLM.

## Impacto externo
Nenhum. Alterações em prompts, tool descriptions e documentação — sem mudança de API.

## Como validar
1. `npx tsc --noEmit` — sem erros de compilação nos arquivos MCP.
2. Testar `records_find` com filtro: resposta deve incluir `pagination` com `hasMore`/`nextStart`.
3. Testar `query_json` com relations e aggregators: resposta deve incluir resumo de agregações.

## Arquivos afetados
- `src/mcp/user/prompts/index.ts`
- `src/mcp/user/tools/records.ts`
- `src/mcp/user/tools/query.ts`
- `docs/en/mcp.md`
- `docs/pt-BR/mcp.md`
- `docs/changelog/2026-03-20_mcp-pagination-aggregation-prompts.md`
- `docs/changelog/README.md`

## Existe migração?
Não.
