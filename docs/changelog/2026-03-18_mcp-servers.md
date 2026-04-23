# 2026-03-18 — MCP Servers (User & Admin)

## Resumo

Implementação completa dos servidores MCP no backend Konecty — um para operações de usuário (`/mcp`) e outro para operações administrativas de metadados (`/admin-mcp`), incluindo autenticação stateless via OTP, tools de CRUD/query/arquivos/metadados, widgets, prompts e camadas de segurança.

## Motivação

Disponibilizar capacidades de automação via MCP com as mesmas regras de segurança e consistência já adotadas no backend e nas KonectySkills, permitindo que agentes LLM interajam com o Konecty de forma estruturada.

## O que mudou

### Infraestrutura MCP

- Base compartilhada: transporte HTTP streaming, guards de feature flags, proxy para serviços internos, rate limiting em memória e tratamento de erros.
- Plugins Fastify com `encapsulate: true` para isolar rotas `/mcp` e `/admin-mcp`.
- `@fastify/rate-limit` fixado em v9.x (compatível com Fastify 4).
- Feature flags `mcpUserEnabled` / `mcpAdminEnabled` no Namespace.
- Pipeline de build dedicado para widgets MCP (`esbuild`).
- ADRs 0012 a 0019 documentando decisões arquiteturais.

### User MCP — Tools

- **Sessão**: `session_login_options`, `session_request_otp_email`, `session_request_otp_phone`, `session_verify_otp_email`, `session_verify_otp_phone`, `session_logout` (com invalidação server-side).
- **Módulos**: `modules_list`, `modules_fields`.
- **Field type helpers**: `field_picklist_options` (opções válidas de picklist), `field_lookup_search` (busca de registros relacionados em lookup).
- **Registros**: `records_find`, `records_find_by_id`, `records_create`, `records_update`, `records_delete_preview`, `records_delete`.
- **Query**: `query_json`, `query_sql`, `query_pivot`, `query_graph`.
- **Arquivos**: `file_upload`, `file_download`, `file_delete`.
- **Widgets**: `render_records_widget`, `render_record_widget`, `render_record_card`, `render_pivot_widget`, `render_graph_widget`, `render_file_widget`.

### Admin MCP — Tools

- `meta_read`, `meta_document_upsert`, `meta_list_upsert`, `meta_view_upsert`, `meta_access_upsert`, `meta_hook_validate`, `meta_hook_upsert`, `meta_namespace_update`, `meta_pivot_upsert`, `meta_doctor_run`, `meta_sync_plan`, `meta_sync_apply`.

### Autenticação stateless

- MCP é stateless: agente deve armazenar `authId` retornado por `session_verify_otp_*` e enviá-lo como `authTokenId` em cada tool autenticada.
- Tools de OTP separadas por canal (email/phone) para evitar ambiguidade de parâmetros.
- `session_logout` invalida o token no servidor.
- Fallback via header `Authorization` (raw ou Bearer) e cookies.
- Mensagens de erro UNAUTHORIZED incluem instruções explícitas de recuperação.

### Orientação ao agente

- **Formato de filtro Konecty**: documentado extensivamente o formato `{ "match": "and", "conditions": [{ "term", "operator", "value" }] }`. Formato Mongo-style (`{ "field": "value" }`) é silenciosamente ignorado pelo backend — todas as descriptions e prompts alertam contra isso.
- **Document `_id`**: tools exigem `_id` técnico do módulo (não label/name). Erros retornam sugestões quando o agente usa label.
- **Sort**: formato Konecty `[{ "property": "field", "direction": "ASC"|"DESC" }]` validado com mensagens de erro claras.
- **Picklist**: `field_picklist_options` retorna chaves válidas; agents orientados a consultar antes de filtrar.
- **Lookup**: `field_lookup_search` resolve `_id` de registros relacionados; agents orientados a confirmar com usuário se múltiplos resultados.

### Response design

- `content.text`: texto legível com dados essenciais e próximos passos (não JSON bruto).
- `structuredContent`: payload JSON completo para consumo programático.
- Formatadores compartilhados para records, módulos, key-values e confirmações de escrita.

### Prompts

- User: `authenticate`, `find_records`, `filter_by_picklist`, `filter_by_lookup`, `create_record`, `update_record`, `delete_record`, `cross_module_query`, `build_pivot`, `build_graph`, `upload_file`.
- Admin: `add_field_to_document`, `create_access_profile`, `write_hook`, `sync_metadata`, `diagnose_metadata`, `configure_namespace`.

## Impacto técnico

- Novas dependências: `@modelcontextprotocol/sdk`, `@fastify/rate-limit` v9.
- Novos diretórios: `src/mcp/shared`, `src/mcp/user`, `src/mcp/admin`, `src/mcp/widgets`.
- Novos plugins Fastify registrados em `src/server/routes/index.ts`.
- ADRs 0012 a 0019 em `docs/en/adr` e `docs/pt-BR/adr`.

## Impacto externo

- Clientes MCP passam a ter endpoints dedicados para operações de usuário e administrativas.
- Restrições de segurança (optimistic locking, delete confirmation, access control) aplicadas via MCP.
- Necessário configurar flags `mcpUserEnabled` / `mcpAdminEnabled` no Namespace.

## Como validar

1. Subir o backend (`yarn start`) e verificar carregamento dos plugins MCP sem erros.
2. `POST /mcp` com `initialize` → resposta com capabilities.
3. Fluxo OTP: `session_login_options` → `session_request_otp_email` → `session_verify_otp_email` → usar `authId` nas tools.
4. `records_find` com filtro Konecty: `{ "match": "and", "conditions": [{ "term": "status", "operator": "equals", "value": "Ativo" }] }`.
5. `field_picklist_options` com campo picklist → receber chaves válidas.
6. `field_lookup_search` com campo lookup → receber registros relacionados.
7. `POST /admin-mcp` com token admin → `meta_read` funciona.

## Arquivos afetados

- `src/mcp/shared/*` (transport, proxy, errors, guards, registerTool, textFormatters, rateLimiter, sessionGuard)
- `src/mcp/user/*` (server, tools, prompts, widgets)
- `src/mcp/admin/*` (server, tools, prompts)
- `src/mcp/widgets/*` (esbuild config, widget sources)
- `src/server/routes/index.ts`
- `src/imports/model/Namespace/index.ts`
- `src/imports/utils/sessionUtils.ts`
- `src/imports/file/file.js`
- `package.json`, `yarn.lock`
- `docs/en/mcp.md`, `docs/pt-BR/mcp.md`
- `docs/en/adr/0012-*.md` a `docs/en/adr/0019-*.md`
- `docs/pt-BR/adr/0012-*.md` a `docs/pt-BR/adr/0019-*.md`

## Existe migração?

Não há migração de banco obrigatória. É necessário configurar as flags `mcpUserEnabled` e `mcpAdminEnabled` no documento Namespace para habilitar os endpoints.
