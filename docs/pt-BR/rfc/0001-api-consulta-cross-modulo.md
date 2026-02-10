# RFC-0001: API de Consulta Cross-Module (Konecty Advanced Query Language)

> Uma nova API para consultas cross-module com joins, agregacoes e interface SQL -- somente API, sem UI.

---

## Metadados

| Campo           | Valor                                          |
| --------------- | ---------------------------------------------- |
| **Status**      | RASCUNHO                                       |
| **Autores**     | Equipe Konecty                                 |
| **Criado em**   | 2026-02-10                                     |
| **Atualizado**  | 2026-02-10                                     |
| **Revisores**   | A definir                                      |
| **Relacionados**| ADR-0001 a ADR-0010, especialmente ADR-0005 (leituras no secundario), ADR-0006 (integracao Python), ADR-0008 (Polars/Pandas), ADR-0010 (padroes de codigo) |

---

## 1. Problema

### Limitacoes Atuais

A API `find` do Konecty (`/rest/data/:document/find` e `/rest/stream/:document/findStream`) so permite consultar **um unico modulo** por vez, sem suporte para:

- **Joins cross-module**: Nao e possivel consultar Product e seus ProductsPerOpportunities relacionados em uma unica requisicao.
- **Agregacoes cross-module**: Nao e possivel contar oportunidades por contato, ou somar vendas por campanha.
- **Projecoes multi-modulo arbitrarias**: `withDetailFields` so traz `descriptionFields`/`detailFields` do lookup, nao consultas cross-module arbitrarias com projecoes customizadas.

### Impacto

Clientes precisam fazer **N+1 chamadas de API** para dados relacionados e fazer joins no lado do cliente, resultando em:

- Alta latencia para cenarios de analytics e relatorios
- Uso excessivo de memoria nos clientes
- Logica de seguranca duplicada quando clientes tentam mesclar dados
- Impossibilidade de realizar agregacoes server-side entre modulos

### Objetivo

Fornecer uma API de consulta cross-module segura, com streaming, acessivel via REST que:

1. Suporte joins de 1 a N modulos (INNER, LEFT, RIGHT, CROSS)
2. Suporte agregacoes (COUNT, SUM, AVG, MIN, MAX, COLLECT)
3. Ofereca tanto uma interface JSON estruturada quanto uma interface de subconjunto ANSI SQL
4. **Nunca contorne** o modelo de seguranca existente de 6 camadas
5. Use streaming e leituras no secundario para performance
6. Aproveite a ponte Python existente (Polars) para processamento de joins

---

## 2. Solucao Proposta: Dois Novos Endpoints

### Endpoint 1 -- Consulta JSON

```
POST /rest/query/json
Content-Type: application/json
Authorization: <auth token>
```

Aceita um body JSON estruturado definindo documentos, joins, projecoes, filtros e agregacoes.

### Endpoint 2 -- Consulta SQL

```
POST /rest/query/sql
Content-Type: application/json
Authorization: <auth token>

{
  "sql": "SELECT Product.code, COUNT(ProductsPerOpportunities._id) AS offers FROM Product INNER JOIN ProductsPerOpportunities ON Product._id = ProductsPerOpportunities.product._id WHERE Product._id = 'fFaJkGaWAdDhvcPH6' GROUP BY Product.code"
}
```

Aceita uma string de subconjunto ANSI SQL que e traduzida para a mesma Representacao Interna de Consulta (IQR).

### Formato de Resposta

Ambos os endpoints retornam respostas **NDJSON** com streaming:

```
Content-Type: application/x-ndjson
X-Total-Count: 42  (opcional, se solicitado)
```

Primeira linha (metadados opcionais):

```json
{"_meta":{"modules":["Product","ProductsPerOpportunities"],"warnings":[],"executionTimeMs":234}}
```

Linhas subsequentes (registros de dados):

```json
{"code":123,"offers":[{"_id":"xyz","status":"Ofertado"},{"_id":"zxy","status":"Visitado"}]}
{"code":456,"offers":[{"_id":"abc","status":"Nova"}]}
```

---

## 3. Arquitetura de Seguranca (Critico -- 6 Camadas de Seguranca)

Cada modulo referenciado em uma consulta passa **independentemente** por TODAS as 6 camadas de seguranca de `find.ts`, `findUtils.ts`, `data.js` e `accessUtils.ts`. **Nenhuma camada pode ser contornada.**

### Camada 1 -- Autenticacao do Usuario

**Funcao**: `getUserSafe(authTokenId, contextUser)`

- Valida `authTokenId` ou `contextUser`
- Retorna objeto `User` autenticado com mapa `user.access`
- Se invalido, retorna erro imediatamente
- Chamado **uma vez** por requisicao, compartilhado entre todos os modulos na consulta

### Camada 2 -- Acesso em Nivel de Documento

**Funcao**: `getAccessFor(document, user)` em `accessUtils.ts:80-134`

- Resolve o perfil de acesso do usuario para cada modulo: `user.access[documentName]` -> `MetaObject.Access[name]`
- Verifica `access.isReadable === true`
- Retorna objeto `MetaAccess` ou `false` (negado)
- **Cada modulo** na consulta deve passar independentemente nesta verificacao
- Se QUALQUER modulo falhar, toda a consulta e rejeitada com erro claro

### Camada 3 -- Filtro de Leitura em Nivel de Documento (Seguranca em Nivel de Registro)

**Origem**: `access.readFilter` (um objeto KonFilter)

- Cada `MetaAccess` pode definir um `readFilter`
- Este filtro e **sempre mesclado** com o filtro do usuario via `$and`
- Restringe quais **registros** o usuario pode ver
- Exemplo: um corretor so pode ver oportunidades atribuidas a ele
- Aplicado em `find.ts:114-116`: `if (isObject(access.readFilter)) queryFilter.filters.push(access.readFilter)`
- **Critico**: Em consultas cross-module, o readFilter de cada modulo e aplicado a sua propria query de colecao independentemente

### Camada 4 -- Permissoes em Nivel de Campo

**Funcao**: `getFieldPermissions(metaAccess, fieldName)` em `accessUtils.ts:32-78`

- Para cada campo nos metadados do modulo, verifica se `access.fields[fieldName].READ.allow === true`
- Fallback para `metaAccess.fieldDefaults.isReadable`
- Se um campo NAO for legivel: e **removido da projecao do MongoDB** (nunca buscado do BD)
- Aplicado em `find.ts:179-210` e `findUtils.ts:314-316`

### Camada 5 -- Acesso Condicional em Nivel de Campo

**Funcoes**: `getFieldConditions(metaAccess, fieldName)` + `filterConditionToFn()` em `accessUtils.ts:11-28`

- Alguns campos tem condicoes de READ: `access.fields[fieldName].READ.condition`
- Convertidos em funcoes de runtime via `filterConditionToFn()`
- Apos o MongoDB retornar os dados, cada registro e avaliado contra essas condicoes
- Se a condicao retornar `false` para um registro, o campo e **removido daquele registro especifico**
- Em `findStream.ts`: tratado pelo Transform `ApplyFieldPermissionsTransform`

### Camada 6 -- `removeUnauthorizedDataForRead()`

**Funcao**: `removeUnauthorizedDataForRead()` em `accessUtils.ts:136-162`

- Rede de seguranca final (defesa em profundidade)
- Itera todos os campos nos dados de resultado
- Re-verifica `getFieldPermissions()` e `getFieldConditions()` para cada campo
- So copia campos autorizados para um novo objeto (abordagem whitelist)

### Invariante de Seguranca para Consulta Cross-Module

O motor de consulta cross-module DEVE decompor a consulta em operacoes por modulo onde cada modulo passa independentemente pelas Camadas 1-5:

1. Chamar `buildFindQuery()` (ou equivalente) para **CADA** modulo envolvido
2. Nunca permitir que um join exponha registros filtrados pelo `readFilter` de outro modulo
3. Nunca permitir que uma projecao inclua campos que o usuario nao pode ler
4. Aplicar condicoes de campo (Camada 5) via Transform streams nos dados de cada modulo **ANTES** do join
5. Registrar decisoes relevantes de seguranca para auditoria

---

## 4. Formato de Consulta JSON (com Schema estilo Zod)

### Schema Completo

```typescript
import { z } from 'zod';

// --- Enums ---
const JoinTypeEnum = z.enum(['inner', 'left', 'right', 'cross']);
const AggregateEnum = z.enum(['count', 'sum', 'avg', 'min', 'max', 'collect']);
const DirectionEnum = z.enum(['asc', 'desc']);
const OperatorEnum = z.enum([
  'equals', 'not_equals', 'contains', 'starts_with', 'end_with',
  'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals',
  'greater_or_equals', 'between', 'exists', 'current_user',
]);

// --- Condicao de Join ---
const JoinConditionSchema = z.object({
  left: z.string().describe('Campo qualificado por modulo: "Product._id"'),
  operator: OperatorEnum,
  right: z.string().describe('Campo qualificado por modulo: "ProductsPerOpportunities.product._id"'),
});

// --- Join ---
const JoinSchema = z.object({
  document: z.string().describe('Nome do modulo alvo, ex: "ProductsPerOpportunities"'),
  type: JoinTypeEnum.default('inner'),
  on: JoinConditionSchema,
});

// --- Campo de Selecao ---
const SelectFieldSchema = z.object({
  field: z.string().describe('Campo qualificado ou wildcard: "Product.code" ou "ProductsPerOpportunities.*"'),
  alias: z.string().describe('Nome do campo no resultado'),
  aggregate: AggregateEnum.optional().describe('Funcao de agregacao a aplicar'),
});

// --- Condicao Where (reutiliza estrutura KonFilter) ---
const WhereConditionSchema = z.object({
  term: z.string().describe('Campo qualificado por modulo: "Product._id"'),
  operator: OperatorEnum,
  value: z.any(),
});

const WhereSchema: z.ZodType<any> = z.object({
  match: z.enum(['and', 'or']).default('and'),
  conditions: z.array(WhereConditionSchema).optional(),
  filters: z.lazy(() => z.array(WhereSchema)).optional(),
  textSearch: z.string().optional(),
});

// --- Ordenacao ---
const SortSchema = z.object({
  field: z.string().describe('Campo qualificado por modulo: "Product.code"'),
  direction: DirectionEnum.default('asc'),
});

// --- Schema Principal da Consulta ---
const CrossModuleQuerySchema = z.object({
  from: z.string().describe('Nome do modulo primario/condutor'),
  join: z.array(JoinSchema).min(1).max(10).describe('Definicoes de join, 1-N modulos'),
  select: z.array(SelectFieldSchema).min(1).describe('Campos a retornar com agregacoes opcionais'),
  where: WhereSchema.optional().describe('Condicoes de filtro com campos qualificados por modulo'),
  sort: z.array(SortSchema).optional(),
  limit: z.number().int().min(1).max(100_000).default(1000),
  start: z.number().int().min(0).default(0),
  includeTotal: z.boolean().default(false),
  includeMeta: z.boolean().default(true).describe('Incluir _meta na primeira linha da resposta NDJSON'),
});
```

---

## 5. Interface SQL (Subconjunto ANSI SQL)

### Gramatica Suportada

```
query := SELECT select_list FROM table_ref join_clause* where_clause? group_clause? having_clause? order_clause? limit_clause?

select_list := select_item (',' select_item)*
select_item := aggregate_fn '(' field_ref ')' (AS alias)?
             | field_ref (AS alias)?
             | '*'

aggregate_fn := COUNT | SUM | AVG | MIN | MAX | COLLECT

field_ref := module_name '.' field_path
           | field_path

table_ref := module_name (AS? alias)?

join_clause := join_type JOIN module_name (AS? alias)? ON join_condition
join_type := INNER | LEFT (OUTER)? | RIGHT (OUTER)? | CROSS

join_condition := field_ref '=' field_ref

where_clause := WHERE condition
operator := '=' | '!=' | '<>' | '<' | '>' | '<=' | '>='
          | LIKE | IN | NOT IN | IS NULL | IS NOT NULL | BETWEEN

group_clause := GROUP BY field_ref (',' field_ref)*
having_clause := HAVING condition

order_clause := ORDER BY order_item (',' order_item)*
limit_clause := LIMIT number (OFFSET number)?
```

### NAO Suportado (Fase 1)

| Funcionalidade | Motivo |
|----------------|--------|
| Subqueries | Complexidade; planejado para Fase 3 |
| UNION / INTERSECT | Complexidade; planejado para Fase 3 |
| DDL (CREATE, ALTER, DROP) | Seguranca: API somente leitura |
| DML (INSERT, UPDATE, DELETE) | Seguranca: API somente leitura |
| Window functions | Complexidade; pode ser adicionado na Fase 4 |

### Parser: `node-sql-parser`

- **Biblioteca**: `node-sql-parser` (npm) -- faz parse de SQL para AST
- **Traducao**: AST e percorrido para produzir a Representacao Interna de Consulta (IQR), identica ao formato de consulta JSON
- **Validacao whitelist**: `parser.whiteListCheck()` garante que somente tabelas permitidas (modulos Konecty) sao referenciadas
- **Seguranca**: Somente sentencas SELECT sao aceitas; qualquer DDL/DML dispara erro imediato

---

## 6. Estrategia de Execucao

### Fluxo de Execucao

```
                    +------------------+
                    |  JSON ou SQL     |
                    |  Entrada         |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Parse & Validar  |
                    |  -> IQR           |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Verificacao      |
                    |  Seguranca        |
                    |  (por modulo)     |
                    |  Camadas 1-4      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v--------+          +---------v--------+
    | findStream()     |          | findStream()     |
    | Modulo A         |          | Modulo B         |
    | (com readFilter, |          | (com readFilter, |
    |  perms campo,    |          |  perms campo,    |
    |  leitura         |          |  leitura         |
    |  secundario)     |          |  secundario)     |
    +---------+--------+          +---------+--------+
              |                             |
    +---------v--------+          +---------v--------+
    | Camada 5:        |          | Camada 5:        |
    | Condicoes Campo  |          | Condicoes Campo  |
    | Transform        |          | Transform        |
    +---------+--------+          +---------+--------+
              |                             |
              | Tag: _dataset="A"           | Tag: _dataset="B"
              +--------------+--------------+
                             |
                    +--------v---------+
                    | Processo Python  |
                    | (Polars join +   |
                    |  agregacao)      |
                    +--------+---------+
                             |
                    +--------v---------+
                    | Stream NDJSON    |
                    | Resposta         |
                    +------------------+
```

---

## 7. Ponte Python para Processamento de Joins

### Padrao Estabelecido

O backend Konecty tem uma arquitetura de ponte Python comprovada documentada nas ADR-0006, ADR-0007 e ADR-0008, com tres implementacoes existentes:

| Implementacao | Script | Proposito |
|--------------|--------|-----------|
| `pivotStream.ts` | `pivot_table.py` (569 linhas) | Tabelas pivot com Polars |
| `graphStream.ts` | `graph_generator.py` (915 linhas) | Graficos SVG com Polars + Pandas/matplotlib |
| `kpiStream.ts` | `kpi_aggregator.py` (222 linhas) | Agregacoes KPI com Polars |

Todas seguem a mesma orquestracao de 7 passos:

```
Passo 1: findStream() por modulo (seguranca, permissoes de campo, leitura no secundario)
Passo 2: Coletar dados NDJSON do stream em array
Passo 3: Popular campos de lookup (busca em lote por _id)
Passo 4: Iniciar processo Python via uv run --script
Passo 5: Enviar config JSON-RPC como primeira linha no stdin
Passo 6: Enviar linhas de dados NDJSON no stdin, fechar stdin
Passo 7: Ler resposta JSON-RPC + resultado do stdout
```

### Proposto: `cross_module_join.py`

Novo script em `src/scripts/python/cross_module_join.py` usando Polars para:

- **Receber multiplos datasets**: Dados de cada modulo chegam tagueados com campo `_dataset`
- **Realizar joins**: Polars `join()` com suporte para inner, left, right, cross
- **Aplicar agregacoes**: GROUP BY, COUNT, SUM, AVG, MIN, MAX, COLLECT
- **Retornar resultados**: NDJSON de volta para Node.js

### Protocolo Proposto

```
stdin linha 1:  {"jsonrpc":"2.0","method":"join","params":{"config":{
  "from": "Product",
  "joins": [
    {"document":"ProductsPerOpportunities","type":"inner","leftKey":"_id","rightKey":"product._id"}
  ],
  "select": [...],
  "groupBy": ["Product.code"]
}}}

stdin linha 2:  {"_dataset":"Product","_id":"abc","code":123,"type":"Apartamento"}\n
stdin linha 3:  {"_dataset":"Product","_id":"def","code":456,"type":"Casa"}\n
stdin linha 4:  {"_dataset":"ProductsPerOpportunities","_id":"x1","product":{"_id":"abc"},"status":"Ofertado"}\n
stdin linha 5:  {"_dataset":"ProductsPerOpportunities","_id":"x2","product":{"_id":"abc"},"status":"Visitado"}\n
stdin EOF

stdout linha 1: {"jsonrpc":"2.0","result":"ok"}
stdout linha 2: {"code":123,"offers":[{"_id":"x1","status":"Ofertado"},{"_id":"x2","status":"Visitado"}]}\n
stdout linha 3: {"code":456,"offers":[]}\n
```

### Decisoes de Design Chave

| Decisao | Justificativa |
|---------|--------------|
| Tag `_dataset` por registro | Separa dados de multiplos modulos em um unico stream NDJSON |
| Polars `join()` | 3-10x mais rapido que JS puro para grandes datasets (ADR-0008) |
| Saida NDJSON (nao JSON unico) | Permite streaming de volta para Node.js; eficiente em memoria |
| `COLLECT` via Polars `list()` | Agrupa registros relacionados em arrays eficientemente |
| PEP 723 metadados inline | Sem necessidade de pyproject.toml separado (ADR-0006) |

---

## 8. Streaming e Performance

### Preferencia de Leitura

Conforme ADR-0005, todas as consultas DEVEM usar nos secundarios:

```typescript
const hasSecondaries = await hasSecondaryNodes();
const readPreference = hasSecondaries ? 'secondary' : 'secondaryPreferred';
```

### Configuracao MongoDB

Conforme `streamConstants.ts` existente:

| Constante | Valor | Proposito |
|-----------|-------|-----------|
| `STREAM_BATCH_SIZE` | 1000 | Tamanho otimo de batch para streaming de cursor |
| `STREAM_MAX_TIME_MS` | 300.000 (5 min) | Tempo maximo de execucao da query |
| `allowDiskUse` | `true` | Habilita ordenacao em disco para grandes conjuntos de resultados |

### Backpressure

- Mecanismo `pipe()` do Node.js trata backpressure automaticamente entre cursor stream do MongoDB e Transform streams
- stdin/stdout do processo Python tambem respeita buffering de pipe do SO
- `highWaterMark` pode ser ajustado nos Transform streams se necessario

### Gerenciamento de Memoria

| Estrategia | Implementacao |
|-----------|--------------|
| Streaming por modulo | Cada modulo streamed via `findStream()` com `batchSize: 1000` |
| Limites configuraveis | Variavel de ambiente `CROSS_QUERY_MAX_RECORDS` (padrao: 100.000) |
| Memoria Python | Polars usa formato colunar Apache Arrow (eficiente em memoria) |
| Limpeza | Matar processo Python em caso de erro (mesmo padrao do `pivotStream.ts`) |

---

## 9. Exemplos Reais Detalhados

Todos os exemplos usam metadados reais de `src/private/metadata` e `foxter-metas/MetaObjects/ProductsPerOpportunities`. Cada exemplo mostra tanto a consulta JSON quanto o equivalente SQL.

### Exemplo 1: Product + ProductsPerOpportunities (INNER JOIN, COLLECT)

**Caso de uso**: "Obter Product fFaJkGaWAdDhvcPH6 e todas as suas ofertas relacionadas"

**JSON**:

```json
{
  "from": "Product",
  "join": [
    {
      "document": "ProductsPerOpportunities",
      "type": "inner",
      "on": {
        "left": "Product._id",
        "operator": "equals",
        "right": "ProductsPerOpportunities.product._id"
      }
    }
  ],
  "select": [
    { "field": "Product.code", "alias": "code" },
    { "field": "Product.type", "alias": "productType" },
    { "field": "ProductsPerOpportunities.*", "alias": "offers", "aggregate": "collect" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Product._id", "operator": "equals", "value": "fFaJkGaWAdDhvcPH6" }
    ]
  },
  "limit": 100
}
```

**SQL**:

```sql
SELECT p.code AS code,
       p.type AS productType,
       COLLECT(ppo.*) AS offers
  FROM Product p
 INNER JOIN ProductsPerOpportunities ppo
    ON p._id = ppo.product._id
 WHERE p._id = 'fFaJkGaWAdDhvcPH6'
 GROUP BY p.code, p.type
 LIMIT 100
```

### Exemplo 2: Contact + Opportunity (INNER JOIN, COUNT)

**Caso de uso**: "Quantas oportunidades ativas cada contato tem?"

**JSON**:

```json
{
  "from": "Contact",
  "join": [
    {
      "document": "Opportunity",
      "type": "inner",
      "on": {
        "left": "Contact._id",
        "operator": "equals",
        "right": "Opportunity.contact._id"
      }
    }
  ],
  "select": [
    { "field": "Contact.code", "alias": "contactCode" },
    { "field": "Contact.name.full", "alias": "contactName" },
    { "field": "Opportunity._id", "alias": "activeOpportunities", "aggregate": "count" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Opportunity.status", "operator": "in", "value": ["Nova", "Ofertando Imveis", "Em Visitacao"] }
    ]
  },
  "sort": [{ "field": "Contact.name.full", "direction": "asc" }],
  "limit": 1000
}
```

**SQL**:

```sql
SELECT ct.code AS contactCode,
       ct.name.full AS contactName,
       COUNT(o._id) AS activeOpportunities
  FROM Contact ct
 INNER JOIN Opportunity o ON ct._id = o.contact._id
 WHERE o.status IN ('Nova', 'Ofertando Imveis', 'Em Visitacao')
 GROUP BY ct.code, ct.name.full
 ORDER BY ct.name.full ASC
 LIMIT 1000
```

### Exemplo 3: Campaign + Opportunity + Contact (JOIN de 3 vias)

**Caso de uso**: "Quais contatos vieram da Campanha X e qual o status de suas oportunidades?"

**JSON**:

```json
{
  "from": "Campaign",
  "join": [
    {
      "document": "Opportunity",
      "type": "inner",
      "on": {
        "left": "Campaign._id",
        "operator": "equals",
        "right": "Opportunity.campaign._id"
      }
    },
    {
      "document": "Contact",
      "type": "inner",
      "on": {
        "left": "Opportunity.contact._id",
        "operator": "equals",
        "right": "Contact._id"
      }
    }
  ],
  "select": [
    { "field": "Campaign.name", "alias": "campaignName" },
    { "field": "Opportunity.code", "alias": "opportunityCode" },
    { "field": "Opportunity.status", "alias": "opportunityStatus" },
    { "field": "Contact.name.full", "alias": "contactName" },
    { "field": "Contact.email", "alias": "contactEmail" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Campaign._id", "operator": "equals", "value": "campXYZ123" }
    ]
  },
  "limit": 500
}
```

**SQL**:

```sql
SELECT c.name AS campaignName,
       o.code AS opportunityCode,
       o.status AS opportunityStatus,
       ct.name.full AS contactName,
       ct.email AS contactEmail
  FROM Campaign c
 INNER JOIN Opportunity o ON c._id = o.campaign._id
 INNER JOIN Contact ct ON o.contact._id = ct._id
 WHERE c._id = 'campXYZ123'
 LIMIT 500
```

### Exemplo 4: Activity + Product (LEFT JOIN com nulls)

**Caso de uso**: "Listar todas as atividades, incluindo aquelas sem produto vinculado"

**JSON**:

```json
{
  "from": "Activity",
  "join": [
    {
      "document": "Product",
      "type": "left",
      "on": {
        "left": "Activity.product._id",
        "operator": "equals",
        "right": "Product._id"
      }
    }
  ],
  "select": [
    { "field": "Activity.code", "alias": "activityCode" },
    { "field": "Activity.subject", "alias": "subject" },
    { "field": "Activity.status", "alias": "activityStatus" },
    { "field": "Product.code", "alias": "productCode" },
    { "field": "Product.sale", "alias": "productSale" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Activity.status", "operator": "in", "value": ["new", "in-progress"] }
    ]
  },
  "sort": [{ "field": "Activity._createdAt", "direction": "desc" }],
  "limit": 200
}
```

**SQL**:

```sql
SELECT a.code AS activityCode,
       a.subject AS subject,
       a.status AS activityStatus,
       p.code AS productCode,
       p.sale AS productSale
  FROM Activity a
  LEFT JOIN Product p ON a.product._id = p._id
 WHERE a.status IN ('new', 'in-progress')
 ORDER BY a._createdAt DESC
 LIMIT 200
```

### Exemplo 5: Agregacoes ProductsPerOpportunities (GROUP BY, AVG)

**Caso de uso**: "Media de avaliacao e contagem por status"

**JSON**:

```json
{
  "from": "ProductsPerOpportunities",
  "join": [],
  "select": [
    { "field": "ProductsPerOpportunities.status", "alias": "status" },
    { "field": "ProductsPerOpportunities._id", "alias": "count", "aggregate": "count" },
    { "field": "ProductsPerOpportunities.rating", "alias": "avgRating", "aggregate": "avg" }
  ],
  "limit": 100
}
```

**SQL**:

```sql
SELECT ppo.status AS status,
       COUNT(ppo._id) AS count,
       AVG(ppo.rating) AS avgRating
  FROM ProductsPerOpportunities ppo
 GROUP BY ppo.status
 LIMIT 100
```

### Exemplo 6: Contact + Message (LEFT JOIN, MAX)

**Caso de uso**: "Ultimo email enviado para cada contato"

**JSON**:

```json
{
  "from": "Contact",
  "join": [
    {
      "document": "Message",
      "type": "left",
      "on": {
        "left": "Contact._id",
        "operator": "equals",
        "right": "Message.contact._id"
      }
    }
  ],
  "select": [
    { "field": "Contact.code", "alias": "contactCode" },
    { "field": "Contact.name.full", "alias": "contactName" },
    { "field": "Message._createdAt", "alias": "lastEmailSent", "aggregate": "max" }
  ],
  "where": {
    "match": "and",
    "conditions": [
      { "term": "Message.type", "operator": "equals", "value": "Email" },
      { "term": "Message.status", "operator": "equals", "value": "Enviada" }
    ]
  },
  "sort": [{ "field": "Contact.name.full", "direction": "asc" }],
  "limit": 1000
}
```

**SQL**:

```sql
SELECT ct.code AS contactCode,
       ct.name.full AS contactName,
       MAX(m._createdAt) AS lastEmailSent
  FROM Contact ct
  LEFT JOIN Message m ON ct._id = m.contact._id
 WHERE m.type = 'Email'
   AND m.status = 'Enviada'
 GROUP BY ct.code, ct.name.full
 ORDER BY ct.name.full ASC
 LIMIT 1000
```

### Exemplo 7: Exemplo com Seguranca

**Caso de uso**: "Corretor consultando oportunidades -- readFilter restringe as suas proprias"

**Cenario**:
- Usuario e um corretor com perfil de acesso "Corretor"
- `Opportunity:access:Corretor` define `readFilter: { conditions: [{ term: "_user._id", operator: "equals", value: "$user" }] }`
- `Product:access:Corretor` define condicao de campo: campo `sale` so legivel quando `status = 'active'`

**O que acontece internamente**:

1. **Camada 2**: `getAccessFor('Opportunity', user)` retorna acesso "Corretor"; `getAccessFor('Product', user)` retorna acesso "Corretor"
2. **Camada 3**: `readFilter` da Opportunity e mesclado: corretor so ve suas proprias oportunidades (`_user._id = $user`)
3. **Camada 4**: Todos os campos sao verificados quanto a legibilidade em ambos os modulos
4. **Camada 5**: Campo `sale` do Product tem condicao: so legivel se `Product.status = 'active'`. Aplicado via `ApplyFieldPermissionsTransform` ANTES do join.
5. **Resultado**: Corretor so ve suas oportunidades, e `productSale` e `null` para produtos inativos mesmo que os dados existam no MongoDB

---

## 10. Fases de Implementacao

### Fase 1 (MVP)

- Endpoint de consulta JSON (`POST /rest/query/json`)
- Somente INNER JOIN
- Maximo 2 modulos (1 from + 1 join)
- Agregacoes basicas: `count`, `sum`, `avg`, `collect`
- Aplicacao completa de seguranca (todas as 6 camadas)
- Ponte Python com `cross_module_join.py`
- Resposta streaming NDJSON
- Validacao Zod para entrada de consulta

### Fase 2

- Endpoint de consulta SQL (`POST /rest/query/sql`)
- Integracao `node-sql-parser`
- Joins LEFT e RIGHT
- Ate N modulos (configuravel, padrao 5)
- Suporte GROUP BY / HAVING
- Agregacoes `min`, `max`

### Fase 3

- CROSS JOIN com avisos obrigatorios
- Subqueries (na clausula WHERE)
- Suporte UNION
- Ponte Python para agregacoes complexas (funcoes estatisticas)
- Timeout e cancelamento de consulta

### Fase 4

- Cache de plano de consulta
- Otimizador de consulta (otimizacao de ordem de join)
- Avisos de sugestao de indice
- Estrategia `$lookup` do MongoDB como alternativa aos joins Python
- Dashboard de performance / analytics de consulta

---

## 11. Estrategia de Testes

Conforme ADR-0003 (Estrategia de Testes com Jest e Supertest):

### Testes Unitarios

- **Parser SQL**: Traducao de AST para cada funcionalidade SQL
- **Validador de consulta JSON**: Validacao de schema Zod para consultas validas/invalidas
- **Construtor IQR**: Representacao Interna de Consulta correta de ambos JSON e SQL
- **Extracao de filtro por modulo**: Divisao correta de filtro por modulo a partir da clausula WHERE cross-module

### Testes de Integracao (com MongoDB Memory Server)

- **Execucao completa de consulta**: End-to-end com colecoes MongoDB reais
- **Testes de seguranca**: Verificar que campos nao autorizados sao removidos, readFilters aplicados por modulo
- **Corretude de joins**: INNER, LEFT, RIGHT produzem resultados corretos
- **Corretude de agregacoes**: COUNT, SUM, AVG, COLLECT produzem valores corretos

### Testes Python

- **`cross_module_join.py`**: Testes unitarios com pytest
- **Operacoes de join**: Verificar que comportamento de join do Polars corresponde a semantica SQL esperada
- **Casos limite**: Datasets vazios, chaves de join nulas, consultas de modulo unico

---

## 12. Referencias de Pesquisa para Implementadores

### Context7

Usar Context7 (`resolve-library-id` + `query-docs`) para documentacao atualizada:

1. **`node-sql-parser`**: "How to parse SQL SELECT with JOIN into AST in node-sql-parser"
2. **MongoDB Node.js Driver**: "How to use $lookup in aggregation pipeline with readPreference secondary"
3. **Zod**: "How to create recursive schemas with z.lazy for nested filter conditions"
4. **Fastify**: "How to stream NDJSON responses in Fastify with proper Content-Type"
5. **Polars (Python)**: "How to perform DataFrame join with different join types in Polars"

### Pesquisas Perplexity

1. "node-sql-parser SQL to AST translation TypeScript examples 2026"
2. "MongoDB $lookup cross-collection security RBAC streaming best practices 2026"
3. "Node.js Transform stream backpressure cross-collection join patterns"
4. "ANSI SQL subset safe parser whitelist validation security"
5. "Polars Python DataFrame join inner left right cross performance large datasets"

---

## Referencias

- [ADR-0001: HTTP Streaming para Busca de Dados](../adr/0001-http-streaming-para-busca-de-dados.md)
- [ADR-0002: Extracao de Logica Comum para findUtils](../adr/0002-extracao-de-logica-comum-para-find-utils.md)
- [ADR-0003: Node Transform Streams para Processamento Sequencial](../adr/0003-node-transform-streams-para-processamento-sequencial.md)
- [ADR-0005: Uso Obrigatorio nos Secundarios para Leitura](../adr/0005-uso-obrigatorio-nos-secundarios-para-leitura.md)
- [ADR-0006: Integracao Python para Pivot Tables](../adr/0006-integracao-python-para-pivot-tables.md)
- [ADR-0007: Formato Hierarquico Saida Pivot](../adr/0007-formato-hierarquico-saida-pivot.md)
- [ADR-0008: Graph Endpoint com Polars e Pandas](../adr/0008-graph-endpoint-com-polars-pandas.md)
- [ADR-0010: Padroes de Codigo](../adr/0010-padroes-codigo.md)
- [node-sql-parser (npm)](https://www.npmjs.com/package/node-sql-parser)
- [Polars Documentation](https://pola.rs/)
- [Fastify Streaming](https://fastify.dev/docs/latest/Reference/Reply/#streams)

---

_Autores: Equipe Konecty_
_Data: 2026-02-10_
