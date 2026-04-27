# MCP: Redesign de Prompts, Mensagens de Erro e Orientação de Campos de Controle

Data: 2026-03-20

## Resumo

Redesign completo dos prompts, descrições de ferramentas e mensagens de erro do MCP para resolver falhas persistentes de agentes com formato de filtro Konecty e campos de controle, seguindo ADR 24 (comunicação empática e não tecnocêntrica) e boas práticas da indústria (Block playbook, Phil Schmid).

## Motivação

Agentes usando o MCP Konecty falhavam consistentemente em:
- Entender campos de controle (`_createdAt`, `_updatedAt`, `_user`, `_id`) e seus tipos/formatos
- Construir filtros válidos apesar de `filter_build` existir
- Escolher operadores corretos para tipos de campo (ex.: `contains` em dateTime)

## O que mudou

### Novos guias de contexto (prompts/index.ts)
- `CONTROL_FIELDS_GUIDANCE`: documenta todos os campos de sistema com tipos, caminhos de filtro e formatos
- `OPERATORS_BY_TYPE_GUIDANCE`: referência compacta de operadores válidos por tipo de campo
- `FILTER_FORMAT_GUIDANCE` refatorado: agora obriga uso de `filter_build` (remove exemplos de JSON manual)

### filter_build aprimorado (filterBuilder.ts)
- Novo parâmetro opcional `fieldType` por condição para validação de compatibilidade operador/tipo
- Validação de formato de data (detecta ISO 8601 incompleto e formato DD/MM/YYYY)
- Mapa de operadores compartilhado via `fieldTypeOperators.ts`

### modules_fields aprimorado (modules.ts)
- Resposta inclui seção "Control Fields" no `content.text`
- `structuredContent` agora inclui array `controlFields` com metadados de tipo, caminho de filtro e operadores válidos

### Mensagens de erro redesenhadas (konectyProxy.ts)
- `normalizeKonectyFilter` detecta padrões Mongo ($gte, $lte, $eq, etc.) e sugere a chamada `filter_build` equivalente
- Detecção de intenção do agente traduzida em sugestão concreta
- Mensagens concisas focadas na solução, não no problema (ADR 24)

### toMcpErrorResult com recovery (errors.ts)
- Novo parâmetro `recovery` (string ou array de strings) para passos concretos de recuperação
- Incluído em `content.text` e `structuredContent.error.recovery`
- `authRequiredError` agora retorna passos numerados de recuperação

### Descrições de tools atualizadas (records.ts, query.ts)
- `records_find`, `query_pivot`, `query_graph`: "ALWAYS call filter_build first"
- Campos de controle documentados inline nas descrições
- Erros incluem sugestões de recovery

### Documentação (en/pt-BR mcp.md)
- Nova seção "Control / System Fields" com tabela completa
- Seção "Konecty Filter Format" atualizada para obrigar `filter_build`
- Referência I/O atualizada para `filter_build` (com `fieldType`) e `modules_fields` (com `controlFields`)

## Impacto técnico

- Arquivo novo: `src/mcp/shared/fieldTypeOperators.ts`
- Arquivos modificados: `prompts/index.ts`, `filterBuilder.ts`, `modules.ts`, `konectyProxy.ts`, `errors.ts`, `common.ts`, `records.ts`, `query.ts`, `docs/en/mcp.md`, `docs/pt-BR/mcp.md`

## Impacto externo

Agentes que usam o MCP receberão orientação mais clara, erros mais informativos e validação de operador por tipo de campo, reduzindo falhas de filtro.

## Como validar

1. Conectar um agente ao MCP e pedir para listar registros criados em um período — verificar se usa `filter_build` com `_createdAt` em ISO 8601
2. Enviar filtro Mongo-style via records_find — verificar se o erro sugere `filter_build` com condições corretas
3. Chamar `filter_build` com operador incompatível (ex.: `contains` em `dateTime`) — verificar se rejeita com operadores válidos
4. Chamar `modules_fields` — verificar seção "Control Fields" no `content.text` e `controlFields` no `structuredContent`

## Arquivos afetados

- `src/mcp/shared/fieldTypeOperators.ts` (novo)
- `src/mcp/shared/errors.ts`
- `src/mcp/shared/konectyProxy.ts`
- `src/mcp/user/prompts/index.ts`
- `src/mcp/user/tools/filterBuilder.ts`
- `src/mcp/user/tools/modules.ts`
- `src/mcp/user/tools/common.ts`
- `src/mcp/user/tools/records.ts`
- `src/mcp/user/tools/query.ts`
- `docs/en/mcp.md`
- `docs/pt-BR/mcp.md`
- `docs/changelog/2026-03-20_mcp-prompts-error-redesign.md`
- `docs/changelog/README.md`

## Existe migração?

Não.
