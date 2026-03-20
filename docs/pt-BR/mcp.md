# Referência dos Servidores MCP

## Visão Geral
O Konecty expõe dois endpoints MCP:
- Endpoint de usuário em `/mcp`
- Endpoint administrativo em `/admin-mcp`

Ambos usam transporte Streamable HTTP e são registrados como plugins Fastify.

## Autenticação
### Desenho stateless
User MCP e Admin MCP são stateless. O servidor não persiste sessão de autenticação de conversa MCP para agentes. O cliente deve armazenar o token e enviá-lo em cada operação protegida.

### Fluxo de autenticação do User MCP
1. Chamar `session_login_options` para verificar métodos OTP.
2. Solicitar OTP com tool específica por canal:
   - `session_request_otp_email` para e-mail
   - `session_request_otp_phone` para telefone/WhatsApp — `phoneNumber` deve estar em **E.164** (ex.: `+5511999999999`). Se o usuário informar só DDD + número (Brasil), prefixe `+55`. Use o mesmo número normalizado na solicitação e na verificação.
3. Validar OTP com a tool correspondente ao canal:
   - `session_verify_otp_email`
   - `session_verify_otp_phone`
4. Ler `authId` no retorno.
5. Armazenar `authId` no cliente.
6. Enviar esse valor no argumento `authTokenId` em cada tool autenticada do User MCP.

### Estratégia de query para agentes
- Para leitura e paginação de um único módulo, usar `records_find` com `document` vindo de `modules_list.modules[].document`.
- Para consultas cross-module e agregações, usar `query_json` como padrão — suporta relations (joins), `groupBy` e aggregators (count, sum, avg, min, max, etc.).
- Usar `query_sql` somente quando o usuário pedir SQL explicitamente.
- Nunca usar label/nome de exibição do módulo como identificador; sempre usar `_id` técnico.
- Para resumos consolidados em grandes volumes de dados, preferir `query_json` com `groupBy`/`aggregators` em vez de paginar todos os registros com `records_find`.

### Classificação das tools do User MCP
Tools públicas:
- `session_login_options`
- `session_request_otp_email`
- `session_request_otp_phone`
- `session_verify_otp_email`
- `session_verify_otp_phone`
- `filter_build` (monta JSON de filtro Konecty validado; sem auth)

Tools autenticadas:
- `session_logout`
- `modules_list`
- `modules_fields`
- `records_find`
- `records_find_by_id`
- `records_create`
- `records_update`
- `records_delete_preview`
- `records_delete`
- `query_json`
- `query_sql`
- `query_pivot`
- `query_graph`
- `file_upload`
- `file_download`
- `file_delete`

Tools apenas de renderização (sem token):
- `render_records_widget`
- `render_record_widget`
- `render_record_card`
- `render_pivot_widget`
- `render_graph_widget`
- `render_file_widget`

### Opções de transporte de token
Opção preferida para agentes:
- Enviar token no argumento `authTokenId` da tool

Fallback de compatibilidade:
- Header `Authorization` com `authTokenId` puro
- Header `Authorization` com `Bearer <authTokenId>`
- Cookies `authTokenId` ou `_authTokenId`

### Recuperação de erro
Quando uma tool autenticada retorna `UNAUTHORIZED`:
1. Reexecutar o fluxo OTP até `session_verify_otp_email` ou `session_verify_otp_phone` retornar `authId`.
2. Confirmar que o cliente armazenou o `authId` mais recente.
3. Repetir a mesma tool com `authTokenId`.
4. Se continuar falhando, solicitar novo OTP e substituir o token armazenado.

### Autenticação do Admin MCP
Admin MCP exige token de um usuário admin (`admin=true`) obtido fora do fluxo OTP do MCP. Enviar esse token por Authorization HTTP ou cookies.

## Desenho de Resposta
Todas as tools MCP retornam dois canais com equivalência semântica:

- `content.text`: saída orientada ao modelo com dados essenciais em formato legível e orientação de próximo passo.
- `structuredContent`: saída orientada à máquina com payload JSON completo para consumo programático.

Objetivos do desenho:
- O agente deve continuar funcionando mesmo quando o cliente ignorar `structuredContent`.
- Clientes programáticos devem receber JSON completo e estável em `structuredContent`.
- `content.text` deve ser conciso e de alto sinal, evitando resumos genéricos como "Record loaded.".

## Campos de Controle / Sistema

Todos os módulos Konecty possuem campos de sistema (prefixados com `_`). Estão presentes em todos os registros e podem ser usados em filtros e ordenações.

| Campo | Tipo | Caminho de filtro | Operadores válidos | Formato do valor |
|-------|------|-------------------|--------------------| -----------------|
| `_id` | ObjectId | `_id` | equals, not_equals, in, not_in, exists | String |
| `_createdAt` | dateTime | `_createdAt` | equals, not_equals, greater_than, less_than, greater_or_equals, less_or_equals, between, exists | ISO 8601 (ex.: `"2026-03-18T00:00:00Z"`) |
| `_updatedAt` | dateTime | `_updatedAt` | (mesmo que _createdAt) | ISO 8601 |
| `_user` | lookup (User[]) | `_user._id` | equals, not_equals, in, not_in, exists | String _id do User. Também suporta operador `current_user` (sem valor) |
| `_createdBy` | lookup (User) | `_createdBy._id` | equals, not_equals, in, not_in, exists | String _id do User |
| `_updatedBy` | lookup (User) | `_updatedBy._id` | equals, not_equals, in, not_in, exists | String _id do User |

**Importante**: Valores de date/dateTime DEVEM sempre ser ISO 8601 com timezone (ex.: `"2026-01-01T00:00:00Z"`). Formatos como `"2026-01-01"` ou `"01/01/2026"` não são aceitos.

A resposta de `modules_fields` inclui array `controlFields` com esses metadados para uso programático.

## Paginação (records_find)

`records_find` usa paginação baseada em offset.

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `start` | number | 0 | Offset (pular N registros) |
| `limit` | number | 50 | Tamanho da página |
| `total` | (resposta) | — | Contagem total de registros correspondentes |

### Estratégia de paginação

1. Primeira chamada: `records_find` com `limit` desejado (ex.: 50).
2. Verificar `total` na resposta e `pagination.hasMore`.
3. Se `hasMore` for true, chamar novamente com `start = start anterior + limit`.
4. Repetir até `start >= total`.

Exemplo: `total=120, limit=50` → página 1: `start=0`, página 2: `start=50`, página 3: `start=100`.

Quando `limit > 1000`, o sort é forçado para `{ _id: 1 }` para ordenação estável.

Para resumos agregados (contagens, somas, médias) em grandes volumes de dados, preferir `query_json` com `groupBy`/`aggregators` em vez de paginar todos os registros.

## Query Cross-Module (query_json) — Agregação

`query_json` é a ferramenta principal para consultas cross-module e agregação. Suporta junção de módulos filhos via **relations**, agrupamento via **groupBy** e funções de agregação tanto no nível raiz quanto no nível de relação.

### Estrutura da query

```json
{
  "document": "Contact",
  "filter": { "match": "and", "conditions": [...] },
  "fields": "code,name,status",
  "sort": [{ "property": "_createdAt", "direction": "DESC" }],
  "limit": 1000,
  "start": 0,
  "relations": [...],
  "groupBy": ["status"],
  "aggregators": { "total": { "aggregator": "count" } },
  "includeTotal": true,
  "includeMeta": false
}
```

### Relations (Relações)

Relations juntam módulos filhos ao pai. Cada relation **deve** ter pelo menos um aggregator.

```json
{
  "document": "Opportunity",
  "lookup": "contact",
  "filter": { "match": "and", "conditions": [{ "term": "status", "operator": "in", "value": ["Nova", "Em Visitacao"] }] },
  "fields": "code,value",
  "aggregators": {
    "activeCount": { "aggregator": "count" },
    "totalValue": { "aggregator": "sum", "field": "value.value" }
  }
}
```

- `lookup`: campo no módulo filho que aponta para o pai.
- Máximo 10 relations, profundidade máxima de aninhamento 2.
- `limit` por relation padrão 1000 (máximo 100000).

### Aggregators suportados

| Aggregator | `field` obrigatório? | Descrição |
|------------|----------------------|-----------|
| `count` | Não | Número de registros |
| `countDistinct` | Sim | Contagem de valores distintos |
| `sum` | Sim | Soma de valores numéricos |
| `avg` | Sim | Média |
| `min` | Sim | Mínimo |
| `max` | Sim | Máximo |
| `first` | Opcional | Primeiro registro ou valor |
| `last` | Opcional | Último registro ou valor |
| `push` | Opcional | Array de registros ou valores |
| `addToSet` | Sim | Valores únicos |

Para agregações numéricas em campos de dinheiro (money), use o sub-path `"fieldName.value"` (ex.: `{ "aggregator": "sum", "field": "value.value" }`).

### groupBy

Use `groupBy` no nível raiz com `aggregators` para resultados consolidados:

```json
{
  "document": "Contact",
  "groupBy": ["status"],
  "aggregators": { "total": { "aggregator": "count" } }
}
```

Retorna um registro por valor único de `status` com a contagem.

### Exemplo — Contatos com contagem e receita de oportunidades

```json
{
  "document": "Contact",
  "fields": "code,name",
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "contact",
      "aggregators": {
        "totalOpportunities": { "aggregator": "count" },
        "totalRevenue": { "aggregator": "sum", "field": "value.value" }
      }
    }
  ]
}
```

Cada Contato retornado incluirá `totalOpportunities` e `totalRevenue` das Oportunidades relacionadas.

## Formato de Filtro Konecty

O Konecty usa formato de filtro próprio e estruturado — **não** sintaxe de query MongoDB.

**Obrigatório:** SEMPRE chamar `filter_build` com `match`, `conditions` como linhas `{ field, operator, value, fieldType? }` (e opcional `textSearch`). A tool valida compatibilidade do operador com o tipo de campo e devolve um filtro validado para usar em `records_find`, `query_pivot` e `query_graph`.

O User MCP valida filtros antes dessas chamadas: mapas estilo Mongo no topo são **rejeitados** com erro informativo sugerindo a chamada equivalente a `filter_build`.

```json
{
  "match": "and",
  "conditions": [
    { "term": "status", "operator": "equals", "value": "Ativo" },
    { "term": "code", "operator": "greater_than", "value": 100 }
  ]
}
```

- `match`: `"and"` ou `"or"` — como combinar condições
- `conditions`: array de objetos `{ term, operator, value }`
- `textSearch`: string de busca full-text (opcional)
- `filters`: sub-grupos aninhados para AND/OR complexos: `{ "match": "and", "filters": [{ "match": "or", "conditions": [...] }] }`

### Operadores

| Operador | Uso |
|----------|-----|
| `equals` / `not_equals` | Match exato |
| `contains` / `not_contains` | Substring (case-insensitive) |
| `starts_with` / `end_with` | Prefixo / sufixo |
| `in` / `not_in` | Match/exclusão de lista — value deve ser array |
| `greater_than` / `less_than` | Comparação numérica/data |
| `greater_or_equals` / `less_or_equals` | Comparação inclusiva |
| `between` | Range — value: `{ "greater_or_equals": ..., "less_or_equals": ... }` |
| `exists` | Presença de campo — value: `true` ou `false` |

### Operadores por tipo de campo

| Tipo de campo | Operadores |
|---------------|-----------|
| picklist | `exists`, `equals`, `not_equals`, `in`, `not_in` |
| lookup | `exists` |
| lookup._id | `exists`, `equals`, `not_equals`, `in`, `not_in` |
| text, url, email.address | `exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with` |
| number, date, dateTime | `exists`, `equals`, `not_equals`, `in`, `not_in`, `greater_than`, `less_than`, `greater_or_equals`, `less_or_equals`, `between` |
| boolean | `exists`, `equals`, `not_equals` |

### Exemplo de filtro lookup

```json
{ "match": "and", "conditions": [{ "term": "supplier._id", "operator": "equals", "value": "<contact_id>" }] }
```

### NUNCA use filtros estilo Mongo

`{ "status": "Ativo" }` não tem `match` / `conditions` / `filters` / `textSearch`. No MCP, `records_find`, `query_pivot` e `query_graph` **rejeitam** esse formato para o agente receber erro claro em vez de resultado sem filtro.

## Referência de Entrada e Saída das Tools
### User MCP
- `session_login_options`: entrada nenhuma; saída `options`, `nextSteps`, `requestOtpExamples`, `verifyOtpExamples`.
- `session_request_otp_email`: entrada `email`; saída `otpRequest`, `channel`, `nextStep` mais bloco de imagem OTP.
- `session_request_otp_phone`: entrada `phoneNumber` (E.164, ex. `+5511999999999`; DDD+número BR normalizado com `+55` quando aplicável); saída `otpRequest`, `channel`, `nextStep`, `normalizedPhoneNumber` quando houver normalização.
- `session_verify_otp_email`, `session_verify_otp_phone`: entrada identificador do canal e `otpCode`; saída `authId`, `user`, `logged`, `instructions`.
- `session_logout`: entrada `authTokenId`; saída `logout`.
- `modules_list`: entrada `authTokenId`; saída `modules`, `usageHint`, `queryStrategyHint`, `moduleIdentifiers`.
- `modules_fields`: entrada `document`, `authTokenId`; saída `module` (incluindo normalização de documento quando aplicável), `controlFields` (array de metadados de campos de sistema com tipo, filterPath e validOperators). Campos do tipo "picklist" têm opções embutidas — use `field_picklist_options`. Campos do tipo "lookup" têm módulo relacionado — use `field_lookup_search`.
- `field_picklist_options`: entrada `document`, `fieldName`, `authTokenId`; saída `document`, `fieldName`, `fieldLabel`, `options` (array de `{ key, sort?, pt_BR?, en? }`). Retorna as chaves válidas para picklist — use antes de filtrar.
- `field_lookup_search`: entrada `document`, `fieldName`, `search`, opcional `limit`, `authTokenId`; saída `document`, `fieldName`, `relatedDocument`, `descriptionFields`, `records`, `total`. Busca registros relacionados para resolver _id de lookup antes de filtrar.
- `filter_build`: entrada `match` (`and`|`or`), `conditions` como array de `{ field, operator, value?, fieldType? }`, opcional `textSearch`; sem `authTokenId`. Quando `fieldType` é fornecido (de `modules_fields`), valida compatibilidade de operador. Saída `filter`, `filterJson`. Use a saída como `filter` em `records_find` / `query_pivot` / `query_graph`.
- `records_find`: entrada `document`, filtros/ordenação/campos opcionais, `limit` (default 50), `start` (offset, default 0), `withDetailFields`, `authTokenId`; saída `records`, `total`, `pagination` (com `start`, `limit`, `returned`, `total`, `hasMore`, `nextStart`). Paginação baseada em offset: iterar com `start += limit` até `hasMore` ser false. Prefira `filter` vindo de `filter_build`. Mapas estilo Mongo são rejeitados. Para dados agregados em grandes volumes, preferir `query_json` com `groupBy`/`aggregators`.
- `records_find_by_id`: entrada `document`, `recordId`, opcionais `fields` e `withDetailFields`, `authTokenId`; saída `record`.
- `records_create`: entrada `document`, `data`, `authTokenId`; saída `records`.
- `records_update`: entrada `document`, `ids` com `_id` e `_updatedAt`, `data`, `authTokenId`; saída `records`.
- `records_delete_preview`: entrada `document`, `recordId`, opcional `fields`, `authTokenId`; saída `preview`.
- `records_delete`: entrada `document`, `confirm`, `ids`, `authTokenId`; saída `deleted`.
- `query_json`: entrada objeto `query` (`document`, opcionais `filter`/`fields`/`sort`/`limit`/`start`, `relations` com aggregators, `groupBy`, `aggregators`, `includeTotal`, `includeMeta`), `authTokenId`; saída `records`, `meta`, `total`. Suporta joins cross-module via `relations` (cada uma com aggregators obrigatórios: count, sum, avg, min, max, first, last, push, addToSet, countDistinct), `groupBy` para GROUP BY e `aggregators` no nível raiz para resumos consolidados.
- `query_sql`: entrada `sql`, opcionais `includeMeta` e `includeTotal`, `authTokenId`; saída `records`, `meta`, `total`.
- `query_pivot`: entrada `document`, `pivotConfig`, opcionais filtro/ordenação/campos/limite, `authTokenId`; saída `pivot`. Mesmas regras de filtro que `records_find` (use `filter_build` quando possível).
- `query_graph`: entrada `document`, `graphConfig`, opcionais filtro/ordenação/campos/limite, `authTokenId`; saída `graph`. Mesmas regras de filtro que `records_find` (use `filter_build` quando possível).
- `file_upload`: entrada `document`, `recordId`, `fieldName`, `file`, `authTokenId`; saída `file`.
- `file_download`: entrada `document`, `recordId`, `fieldName`, `fileName`, `authTokenId`; saída `fileUrl`, `fileName`.
- `file_delete`: entrada `document`, `recordId`, `fieldName`, `fileName`, `confirm`, `authTokenId`; saída `file`.
- `render_records_widget`: entrada `document`, `records`; saída `records`, `openInKonectyBaseUrl`.
- `render_record_widget`: entrada `document`, `recordId`, `record`; saída `record`, `openInKonectyUrl`.
- `render_record_card`: entrada `document`, `recordId`, `record`, opcionais `imageFields` e `highlightFields`; saída `record`, `images`, `highlightFields`, `openInKonectyUrl`.
- `render_pivot_widget`: entrada `rows`; saída `rows`.
- `render_graph_widget`: entrada `svg`; saída `svg`.
- `render_file_widget`: entrada `fileUrl`, opcional `fileName`; saída `fileUrl`, `fileName`.

### Admin MCP
- `meta_read`: entrada `name`; saída `meta`.
- `meta_document_upsert`: entrada `id`, `document`; saída `result`.
- `meta_list_upsert`: entrada `id`, `list`; saída `result`.
- `meta_view_upsert`: entrada `id`, `view`; saída `result`.
- `meta_access_upsert`: entrada `id`, `access`; saída `result`.
- `meta_hook_validate`: entrada `script`; saída `validation`.
- `meta_hook_upsert`: entrada `id`, `hook`; saída `result`.
- `meta_namespace_update`: entrada `patch`; saída `result`.
- `meta_pivot_upsert`: entrada `id`, `pivot`; saída `result`.
- `meta_doctor_run`: entrada nenhuma; saída `issues`, `total`.
- `meta_sync_plan`: entrada `items`; saída `plan`.
- `meta_sync_apply`: entrada `items`, opcional `autoApprove`; saída `applied`, `total`.

## Feature Flags
A habilitação dos MCPs é controlada no namespace:
- `mcpUserEnabled`
- `mcpAdminEnabled`

Se a flag estiver desabilitada, o endpoint retorna indisponível.

## Tools do User MCP
### Sessão
- `session_login_options`
- `session_request_otp_email`
- `session_request_otp_phone`
- `session_verify_otp_email`
- `session_verify_otp_phone`
- `session_logout`

### Módulos
- `modules_list`
- `modules_fields`

### Helpers de tipos de campo
- `field_picklist_options` — retorna chaves válidas para campos picklist
- `field_lookup_search` — busca registros relacionados para lookup e resolve _id
- `filter_build` — monta filtro Konecty validado (sem auth)

### Registros
- `records_find`
- `records_find_by_id`
- `records_create`
- `records_update`
- `records_delete_preview`
- `records_delete`
- `render_records_widget`
- `render_record_widget`
- `render_record_card`

### Query
- `query_json`
- `query_sql`
- `query_pivot`
- `query_graph`
- `render_pivot_widget`
- `render_graph_widget`

### Arquivos
- `file_upload`
- `file_download`
- `file_delete`
- `render_file_widget`

## Tools do Admin MCP
- `meta_read`
- `meta_document_upsert`
- `meta_list_upsert`
- `meta_view_upsert`
- `meta_access_upsert`
- `meta_hook_validate`
- `meta_hook_upsert`
- `meta_namespace_update`
- `meta_pivot_upsert`
- `meta_doctor_run`
- `meta_sync_plan`
- `meta_sync_apply`

## Prompts
### Prompts de usuário
- `authenticate` — fluxo de login OTP
- `find_records` — busca em módulo único com orientação de paginação
- `filter_by_picklist` — workflow de filtro por campo picklist
- `filter_by_lookup` — workflow de filtro por campo lookup
- `build_filter` — construção genérica de filtros
- `create_record` — criação de registros
- `update_record` — atualização com optimistic locking
- `delete_record` — exclusão segura com preview
- `cross_module_query` — consulta cross-module com relations, groupBy e aggregators
- `build_pivot` — geração de tabela pivot
- `build_graph` — geração de gráficos
- `upload_file` — upload de arquivos

### Prompts de admin
- `add_field_to_document`
- `create_access_profile`
- `write_hook`
- `sync_metadata`
- `diagnose_metadata`
- `configure_namespace`

## Widgets
O User MCP expõe seis widgets:
- `records-table`
- `pivot`
- `graph`
- `record-detail`
- `record-card`
- `file-preview`

Os widgets são registrados como recursos de app MCP e entregues a partir de `src/mcp/widgets/dist`.

## Controles de Segurança
- Rate limiting em memória por perfil de endpoint
- Limite de tamanho de payload
- Guard de flags de namespace
- Guard admin para endpoint e tools administrativas
- Exigência de optimistic locking em update e delete
- Exigência de confirmação explícita em operações destrutivas
