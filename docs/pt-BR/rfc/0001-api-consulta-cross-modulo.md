# RFC-0001: API de Consulta Cross-Module (Konecty Advanced Query Language)

> Uma nova API para consultas cross-module com relations recursivas, agregacoes e interface SQL -- somente API, sem UI.

---

## Metadados

| Campo           | Valor                                          |
| --------------- | ---------------------------------------------- |
| **Status**      | RASCUNHO                                       |
| **Autores**     | Equipe Konecty                                 |
| **Criado em**   | 2026-02-10                                     |
| **Atualizado**  | 2026-02-13                                     |
| **Revisores**   | A definir                                      |
| **Relacionados**| ADR-0001 a ADR-0010, especialmente ADR-0005 (leitura no secundario), ADR-0006 (integracao Python), ADR-0008 (Polars/Pandas), ADR-0010 (padroes de codigo) |

---

## 1. Problema

### Limitacoes Atuais

A API `find` do Konecty (`/rest/data/:document/find` e `/rest/stream/:document/findStream`) so permite consultar **um unico modulo** por vez, sem suporte para:

- **Relations cross-module**: Nao e possivel consultar Contact e suas Opportunities relacionadas em uma unica requisicao.
- **Agregacoes cross-module**: Nao e possivel contar oportunidades por contato, ou somar vendas por campanha.
- **Projecoes multi-modulo arbitrarias**: `withDetailFields` so traz `descriptionFields`/`detailFields` do lookup, nao consultas cross-module arbitrarias com projecoes e agregacoes customizadas.

### Impacto

Clientes precisam fazer **N+1 chamadas de API** para dados relacionados e fazer joins no lado do cliente, resultando em:

- Alta latencia para cenarios de analytics e relatorios
- Uso excessivo de memoria nos clientes
- Logica de seguranca duplicada quando clientes tentam mesclar dados
- Impossibilidade de realizar agregacoes server-side entre modulos

### Objetivo

Fornecer uma API de consulta cross-module segura, com streaming, acessivel via REST que:

1. Estenda a API `find` existente com **relations** recursivas aninhadas (espelhando o padrao `relations` do MetaObject)
2. Infira condicoes de join a partir de campos **lookup** ja definidos nos metadados
3. Suporte agregacoes (`count`, `sum`, `avg`, `min`, `max`, `first`, `last`, `push`, `addToSet`)
4. Ofereca tanto interface JSON estruturada (compativel com find) quanto interface de subconjunto ANSI SQL
5. Use os mesmos nomes `filter`/`fields`/`sort`/`limit`/`start` da API find atual
6. Aplique seguranca por modulo com **degradacao graciosa** para relations nao autorizadas
7. Use streaming e leituras no secundario para performance
8. Aproveite a ponte Python existente (Polars) para processamento de joins e agregacoes

---

## 2. Solucao Proposta: Dois Novos Endpoints

### Endpoint 1 -- Consulta JSON (Baseada em Relations)

```
POST /rest/query/json
Content-Type: application/json
Authorization: <auth token>
```

Aceita um body JSON estruturado que e uma **chamada find padrao com um array `relations` adicionado**. Usa exatamente os mesmos nomes de parametros da API find atual (`filter`, `fields`, `sort`, `limit`, `start`).

Exemplo de body:

```json
{
  "document": "Contact",
  "filter": {
    "match": "and",
    "conditions": [{ "term": "status", "operator": "equals", "value": "active" }]
  },
  "fields": "code,name",
  "sort": [{ "property": "name.full", "direction": "ASC" }],
  "limit": 100,
  "start": 0,
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "contact",
      "filter": {
        "match": "and",
        "conditions": [{ "term": "status", "operator": "in", "value": ["Nova", "Em Visitacao"] }]
      },
      "fields": "code,status",
      "sort": [{ "property": "_createdAt", "direction": "DESC" }],
      "limit": 50,
      "aggregators": {
        "activeOpportunities": { "aggregator": "count" },
        "opportunities": { "aggregator": "push" }
      }
    }
  ]
}
```

### Endpoint 2 -- Consulta SQL

```
POST /rest/query/sql
Content-Type: application/json
Authorization: <auth token>

{
  "sql": "SELECT c.code, c.name, COUNT(o._id) AS activeOpportunities FROM Contact c INNER JOIN Opportunity o ON c._id = o.contact._id WHERE o.status IN ('Nova', 'Em Visitacao') GROUP BY c.code, c.name ORDER BY c.name ASC LIMIT 100"
}
```

Aceita uma string de subconjunto ANSI SQL que e traduzida para a mesma Representacao Interna de Consulta (IQR) -- o formato recursivo de relations.

### Formato de Resposta

Ambos os endpoints retornam respostas **NDJSON** com streaming:

```
Content-Type: application/x-ndjson
X-Total-Count: 42  (opcional, se solicitado via includeTotal)
```

Primeira linha (metadados opcionais):

```json
{"_meta":{"document":"Contact","relations":["Opportunity"],"warnings":[],"executionTimeMs":234}}
```

Linhas subsequentes (registros de dados com resultados dos agregadores mesclados):

```json
{"code":1001,"name":{"full":"Alice Santos"},"activeOpportunities":3,"opportunities":[{"code":5001,"status":"Nova"},{"code":5002,"status":"Em Visitacao"}]}
{"code":1002,"name":{"full":"Bruno Silva"},"activeOpportunities":1,"opportunities":[{"code":5003,"status":"Nova"}]}
```

---

## 3. Arquitetura de Seguranca (6 Camadas com Degradacao Graciosa)

O modelo de seguranca aplica **todas as 6 camadas existentes** mas com uma diferenca chave do find original: **somente o documento primario precisa estar totalmente autorizado; relations nao autorizadas degradam graciosamente para valores vazios/null ao inves de rejeitar toda a consulta**.

### Camada 1 -- Autenticacao do Usuario

**Funcao**: `getUserSafe(authTokenId, contextUser)`

- Valida `authTokenId` ou `contextUser`
- Retorna objeto `User` autenticado com mapa `user.access`
- Se invalido, retorna erro imediatamente
- Chamado **uma vez** por requisicao, compartilhado entre todos os modulos

### Camada 2 -- Acesso em Nivel de Documento (Soft para Relations)

**Funcao**: `getAccessFor(document, user)` em `accessUtils.ts:80-134`

- Resolve perfil de acesso do usuario: `user.access[documentName]` -> `MetaObject.Access[name]`
- Verifica `access.isReadable === true`
- Retorna objeto `MetaAccess` ou `false` (negado)

**Diferenca de comportamento para consultas cross-module**:

- **Documento primario** (campo `document`): DEVE passar esta verificacao. Se falhar, a **consulta inteira e rejeitada**.
- **Documentos de relation**: Se o documento de uma relation falhar nesta verificacao, os **campos de resultado dos agregadores sao definidos como `null`**. A consulta continua. Um aviso e adicionado a `_meta.warnings`: `{ "type": "RELATION_ACCESS_DENIED", "document": "Product", "message": "User lacks read access" }`.

**Beneficio**: O mesmo endpoint serve mais usuarios. Um usuario sem acesso a Product ainda recebe seus dados de Contact + Opportunity; os agregadores relacionados a product simplesmente retornam null.

### Camada 3 -- Filtro de Leitura em Nivel de Documento (Seguranca em Nivel de Registro)

**Origem**: `access.readFilter` (um objeto KonFilter)

- Cada `MetaAccess` pode definir um `readFilter`
- Este filtro e **sempre mesclado** com o filtro da relation via `$and`
- Restringe quais **registros** o usuario pode ver
- Exemplo: um corretor so pode ver oportunidades atribuidas a ele
- **Critico**: O readFilter de cada modulo e aplicado a sua propria sub-query independentemente

### Camada 4 -- Permissoes em Nivel de Campo

**Funcao**: `getFieldPermissions(metaAccess, fieldName)` em `accessUtils.ts:32-78`

- Para cada campo nos metadados do modulo, verifica se `access.fields[fieldName].READ.allow === true`
- Fallback para `metaAccess.fieldDefaults.isReadable`
- Se um campo NAO for legivel: e **removido da projecao do MongoDB** (nunca buscado do BD)
- Aplicado por modulo: campos da relation sao verificados contra o perfil de acesso do modulo da relation

### Camada 5 -- Acesso Condicional em Nivel de Campo

**Funcoes**: `getFieldConditions(metaAccess, fieldName)` + `filterConditionToFn()` em `accessUtils.ts:11-28`

- Alguns campos tem condicoes de READ: `access.fields[fieldName].READ.condition`
- Convertidos em funcoes de runtime via `filterConditionToFn()`
- Apos o MongoDB retornar os dados, cada registro e avaliado contra essas condicoes
- Se a condicao retornar `false`, o campo e **removido daquele registro especifico**
- Aplicado via `ApplyFieldPermissionsTransform` nos dados de cada relation **ANTES** da agregacao

### Camada 6 -- `removeUnauthorizedDataForRead()`

**Funcao**: `removeUnauthorizedDataForRead()` em `accessUtils.ts:136-162`

- Rede de seguranca final (defesa em profundidade)
- Re-verifica todas as permissoes de campo como whitelist
- Aplicado como ultimo passo antes do processamento de agregadores

### Invariante de Seguranca

O motor de consulta cross-module DEVE:

1. Chamar `buildFindQuery()` (ou equivalente) para cada modulo autorizado
2. Nunca permitir que uma relation exponha registros filtrados pelo `readFilter` de outro modulo
3. Nunca permitir que uma projecao inclua campos que o usuario nao pode ler
4. Aplicar condicoes de campo (Camada 5) nos dados de cada modulo ANTES da agregacao
5. Definir todos os campos de agregadores como `null` para relations nao autorizadas (nao expor dados parciais)
6. Registrar decisoes relevantes de seguranca para auditoria

---

## 4. Formato de Consulta JSON (Relations Recursivas com Schema Zod)

### Principio de Design

A consulta JSON e uma **chamada find padrao** com um array `relations` adicionado. Cada relation tambem e uma sub-consulta tipo find com seus proprios `filter`, `fields`, `sort`, `limit` e `aggregators`. Relations podem ser **recursivamente aninhadas** para seguir cadeias de lookups.

**Condicoes de join sao inferidas dos metadados de lookup.** O campo `lookup` em uma relation especifica qual campo de lookup no documento relacionado aponta para o pai. Por exemplo, se `Opportunity` tem um campo `contact` do tipo `lookup` apontando para `Contact`, entao `"lookup": "contact"` diz ao motor que `Opportunity.contact._id = Contact._id`. Nenhuma clausula `on` explicita e necessaria, embora uma possa ser opcionalmente fornecida.

### Schema Zod Completo

```typescript
import { z } from 'zod';
import { KonFilter } from '../model/Filter';

// --- Agregador ---
const AggregatorEnum = z.enum([
  'count', 'sum', 'avg', 'min', 'max',
  'first', 'last', 'push', 'addToSet',
]);

const AggregatorSchema = z.object({
  aggregator: AggregatorEnum,
  field: z.string().optional()
    .describe('Campo fonte para agregadores nao-count. Para push/first/last, omitir para usar registro completo.'),
});

// --- Condicao de join explicita opcional (normalmente inferida do lookup) ---
const ExplicitJoinCondition = z.object({
  left: z.string().describe('Caminho do campo no modulo pai, ex: "_id"'),
  right: z.string().describe('Caminho do campo no modulo relation, ex: "contact._id"'),
}).optional().describe('Sobrescreve join automatico baseado em lookup. Normalmente nao necessario.');

// --- Relation (recursiva) ---
const RelationSchema: z.ZodType<any> = z.object({
  document: z.string().describe('Nome do modulo relacionado, ex: "Opportunity"'),
  lookup: z.string().describe('Campo lookup no documento relacionado que aponta para o pai, ex: "contact"'),
  on: ExplicitJoinCondition,

  // Parametros de sub-find (mesmos nomes da API find)
  filter: KonFilter.optional().describe('KonFilter para esta relation (mesma sintaxe exata do find)'),
  fields: z.string().optional().describe('Nomes de campos separados por virgula, igual ao find'),
  sort: z.union([
    z.string(),
    z.array(z.object({
      property: z.string(),
      direction: z.enum(['ASC', 'DESC']).default('ASC'),
    })),
  ]).optional(),
  limit: z.number().int().min(1).max(100_000).optional()
    .describe('Max registros para esta relation. Padrao: 1000'),
  start: z.number().int().min(0).optional(),

  // Agregadores
  aggregators: z.record(z.string(), AggregatorSchema).min(1)
    .describe('Mapa de nome do campo de saida -> config do agregador'),

  // Aninhamento recursivo
  relations: z.lazy(() => z.array(RelationSchema)).optional()
    .describe('Sub-relations aninhadas para cadeias recursivas de lookup'),
});

// --- Schema Principal da Consulta ---
const CrossModuleQuerySchema = z.object({
  // Documento primario (mesmos nomes da API find)
  document: z.string().describe('Nome do modulo primario, ex: "Contact"'),
  filter: KonFilter.optional().describe('KonFilter para documento primario (mesma sintaxe do find)'),
  fields: z.string().optional().describe('Nomes de campos separados por virgula para documento primario'),
  sort: z.union([
    z.string(),
    z.array(z.object({
      property: z.string(),
      direction: z.enum(['ASC', 'DESC']).default('ASC'),
    })),
  ]).optional(),
  limit: z.number().int().min(1).max(100_000).default(1000),
  start: z.number().int().min(0).default(0),

  // Relations
  relations: z.array(RelationSchema).min(1).max(10)
    .describe('Relations cross-module com agregadores'),

  // Opcoes de resposta
  includeTotal: z.boolean().default(false),
  includeMeta: z.boolean().default(true),
});
```

### Como a Resolucao de Lookup Funciona

Quando o motor recebe `"lookup": "contact"` em uma relation com `"document": "Opportunity"`:

1. Le metadados de `Opportunity` do `MetaObject.Meta`
2. Encontra campo `contact` -- tem `type: "lookup"`, `document: "Contact"`
3. A condicao de join e: `Opportunity.contact._id = <registro pai>._id`
4. Para cada lote de registros pai, constroi: `{ "contact._id": { "$in": [parentId1, parentId2, ...] } }`
5. Mescla com `filter` da relation e `readFilter` via `$and`

### Semantica dos Agregadores

| Agregador | Entrada | Saida | Descricao |
|-----------|---------|-------|-----------|
| `count` | -- | `number` | Contagem de registros correspondentes |
| `sum` | `field` | `number` | Soma de campo numerico |
| `avg` | `field` | `number` | Media de campo numerico |
| `min` | `field` | `any` | Valor minimo do campo |
| `max` | `field` | `any` | Valor maximo do campo |
| `first` | `field` (opcional) | `object` ou `any` | Primeiro registro (conforme `sort`); se `field` dado, retorna so aquele campo |
| `last` | `field` (opcional) | `object` ou `any` | Ultimo registro (conforme `sort`); se `field` dado, retorna so aquele campo |
| `push` | `field` (opcional) | `array` | Todos os registros (ou valores de campo) como array. Respeita `limit`. |
| `addToSet` | `field` | `array` | Valores unicos do campo |

---

## 5. Interface SQL (Subconjunto ANSI SQL)

### Gramatica Suportada

```
query := SELECT select_list FROM table_ref join_clause* where_clause? group_clause? having_clause? order_clause? limit_clause?

select_list := select_item (',' select_item)*
select_item := aggregate_fn '(' field_ref ')' (AS alias)?
             | field_ref (AS alias)?
             | '*'

aggregate_fn := COUNT | SUM | AVG | MIN | MAX | FIRST | LAST | PUSH | ADDTOSET

field_ref := module_name '.' field_path | field_path
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

### Traducao SQL para Relations

O parser SQL (`node-sql-parser`) produz uma AST que e traduzida para o IQR recursivo de relations:

1. Clausula `FROM` -> `document` (modulo primario)
2. Cada clausula `JOIN` -> entrada no array `relations`:
   - `JOIN ... ON a._id = b.contact._id` -> motor encontra o campo lookup `contact` no modulo `b` que aponta para `a`, define `lookup: "contact"`
   - Condicoes `WHERE` referenciando modulo de relation -> movidas para `filter` daquela relation
   - Condicoes `WHERE` referenciando modulo primario -> ficam no `filter` raiz
3. Funcoes de agregacao no `SELECT` -> `aggregators` na relation apropriada
4. Campos nao-agregados no `SELECT` -> `fields` na raiz ou nivel de relation
5. JOINs aninhados -> `relations` recursivas aninhadas

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
- **Traducao**: AST e percorrido para produzir a IQR, que e o formato recursivo de relations
- **Validacao whitelist**: `parser.whiteListCheck()` garante que somente tabelas permitidas (modulos Konecty) sao referenciadas
- **Seguranca**: Somente sentencas SELECT sao aceitas; qualquer DDL/DML dispara erro imediato
- **Inferencia de lookup**: O tradutor usa metadados do modulo para encontrar o campo `lookup` que conecta dois modulos

---

## 6. Estrategia de Execucao (Recursiva)

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
                    |  Auth (Camada 1)  |
                    |  getUserSafe()    |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  find() primario  |
                    |  Camadas 2-5      |
                    |  (DEVE autorizar) |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Lote registros   |
                    |  primarios        |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
    +---------v------+ +----v-------+ +----v-------+
    | Relation A     | | Relation B | | Relation C |
    | getAccessFor() | | (negado)   | | (ok)       |
    | -> find()      | | -> null    | | -> find()  |
    | -> agregar     | |            | | -> recursar|
    +----------------+ +------------+ +----+-------+
                                           |
                                    +------v-------+
                                    | Sub-relation |
                                    | C1: find()   |
                                    | -> agregar   |
                                    +--------------+
                             |
                    +--------v---------+
                    | Mesclar          |
                    | resultados dos   |
                    | agregadores      |
                    +--------+---------+
                             |
                    +--------v---------+
                    | Stream NDJSON    |
                    | Resposta         |
                    +------------------+
```

### Passos Detalhados

1. **Parse & validar** a consulta (JSON direto ou SQL -> AST -> IQR)
2. **Autenticar** o usuario (Camada 1, uma vez)
3. **Find do documento primario**: chamar `buildFindQuery()` com seguranca completa (Camadas 2-5), executar `findStream()` com preferencia de leitura no secundario
4. **Processamento em lote**: coletar registros primarios em lotes de `STREAM_BATCH_SIZE` (1000)
5. **Para cada relation** no nivel atual:
   - a. Chamar `getAccessFor(relation.document, user)`. Se **negado**: definir todos os campos de agregadores como `null` para este lote, registrar aviso, **pular** esta relation.
   - b. Extrair chaves de join do lote pai (ex: todos os valores `_id`)
   - c. Construir sub-query: `{ "contact._id": { "$in": [key1, key2, ...] } }` mesclado com `filter` da relation e `readFilter` do usuario via `$and`
   - d. Executar `findStream()` no documento da relation com seus proprios `fields`, `sort`, `limit`
   - e. Aplicar permissoes de campo + condicoes (Camadas 4-5) via Transform streams
   - f. Se relation tem **`relations` aninhadas**: recursar (passo 5) com resultados da relation atual como novo "pai"
   - g. Aplicar **agregadores** (`count`/`push`/`first`/etc.) para agrupar resultados por registro pai
   - h. Mesclar valores dos agregadores em cada registro pai
6. **Stream** resposta NDJSON com registros enriquecidos

### Estrategia `$in` em Lote

Para grandes datasets, o motor processa em lotes para evitar uso ilimitado de memoria (mesmo padrao de `pivotStream.ts` para popular campos de lookup).

---

## 7. Ponte Python para Processamento

### Padrao Estabelecido

O backend Konecty tem uma arquitetura de ponte Python comprovada documentada nas ADR-0006, ADR-0007 e ADR-0008, com tres implementacoes existentes:

| Implementacao | Script | Proposito |
|--------------|--------|-----------|
| `pivotStream.ts` | `pivot_table.py` (569 linhas) | Tabelas pivot com Polars |
| `graphStream.ts` | `graph_generator.py` (915 linhas) | Graficos SVG com Polars + Pandas/matplotlib |
| `kpiStream.ts` | `kpi_aggregator.py` (222 linhas) | Agregacoes KPI com Polars |

### Quando Usar a Ponte Python

A ponte Python e usada quando:

- O dataset e grande o suficiente para que processamento JS em memoria seria lento (> 10.000 registros)
- Agregacoes complexas sao necessarias (GROUP BY com multiplos agregadores)
- Processamento colunar do Polars fornece vantagem significativa de performance (3-10x conforme ADR-0008)

Para datasets menores ou agregacoes simples (`count`, `first`), o orquestrador Node.js trata tudo diretamente sem iniciar Python.

### Proposto: `cross_module_join.py`

Novo script em `src/scripts/python/cross_module_join.py` usando Polars para:

- **Receber multiplos datasets**: Dados de cada modulo chegam tagueados com campo `_dataset`
- **Realizar agregacoes**: GROUP BY com COUNT, SUM, AVG, MIN, MAX, PUSH (list), ADDTOSET (unique)
- **Retornar resultados**: NDJSON de volta para Node.js

### Protocolo Proposto

```
stdin linha 1:  {"jsonrpc":"2.0","method":"aggregate","params":{"config":{
  "parentDataset": "Contact",
  "relations": [
    {
      "dataset": "Opportunity",
      "parentKey": "_id",
      "childKey": "contact._id",
      "aggregators": {
        "activeOpportunities": {"aggregator":"count"},
        "opportunities": {"aggregator":"push"}
      }
    }
  ]
}}}

stdin linha 2:  {"_dataset":"Contact","_id":"c1","code":1001,"name":{"full":"Alice"}}\n
stdin linha 3:  {"_dataset":"Opportunity","_id":"o1","contact":{"_id":"c1"},"status":"Nova","code":5001}\n
stdin EOF

stdout linha 1: {"jsonrpc":"2.0","result":"ok"}
stdout linha 2: {"code":1001,"name":{"full":"Alice"},"activeOpportunities":1,"opportunities":[{"_id":"o1","status":"Nova","code":5001}]}\n
```

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
| `STREAM_BATCH_SIZE` | 1000 | Tamanho otimo de batch para streaming |
| `STREAM_MAX_TIME_MS` | 300.000 (5 min) | Tempo maximo de execucao da query |
| `allowDiskUse` | `true` | Habilita ordenacao em disco para grandes conjuntos |

### Gerenciamento de Memoria

| Estrategia | Implementacao |
|-----------|--------------|
| Processamento em lote | Registros primarios processados em lotes de 1000 |
| Limites por relation | Cada relation tem seu proprio `limit` (padrao: 1000) |
| Max configuravel | Variavel de ambiente `CROSS_QUERY_MAX_RECORDS` (padrao: 100.000) |
| Memoria Python | Polars usa formato colunar Apache Arrow (eficiente em memoria) |
| Limpeza | Matar processo Python em caso de erro (mesmo padrao do `pivotStream.ts`) |

### Avisos

A primeira linha `_meta` deve incluir avisos para:

- `RELATION_ACCESS_DENIED`: Usuario sem acesso a um modulo de relation (campos definidos como null)
- `LIMIT_REACHED`: Resultado truncado devido a `limit` ou `CROSS_QUERY_MAX_RECORDS`
- `MISSING_INDEX`: Campo de chave de lookup/join sem indice (query pode ser lenta)
- `LARGE_DATASET`: Um ou mais modulos retornaram > 50.000 registros

---

## 9. Exemplos Reais Detalhados

Todos os exemplos usam metadados reais de `src/private/metadata` e `foxter-metas/MetaObjects`. Cada exemplo mostra a consulta JSON (formato relations) e seu equivalente SQL.

### Exemplo 1: Product + ProductsPerOpportunities (agregador push)

**Caso de uso**: "Obter Product fFaJkGaWAdDhvcPH6 e todas as suas ofertas relacionadas"

**JSON**:

```json
{
  "document": "Product",
  "filter": {
    "match": "and",
    "conditions": [
      { "term": "_id", "operator": "equals", "value": "fFaJkGaWAdDhvcPH6" }
    ]
  },
  "fields": "code,type",
  "limit": 1,
  "relations": [
    {
      "document": "ProductsPerOpportunities",
      "lookup": "product",
      "fields": "status,situation,rating,contact",
      "sort": [{ "property": "_createdAt", "direction": "DESC" }],
      "limit": 100,
      "aggregators": {
        "offers": { "aggregator": "push" },
        "offerCount": { "aggregator": "count" }
      }
    }
  ]
}
```

**SQL**:

```sql
SELECT p.code, p.type,
       PUSH(ppo.*) AS offers,
       COUNT(ppo._id) AS offerCount
  FROM Product p
 INNER JOIN ProductsPerOpportunities ppo ON p._id = ppo.product._id
 WHERE p._id = 'fFaJkGaWAdDhvcPH6'
 GROUP BY p.code, p.type
 LIMIT 1
```

---

### Exemplo 2: Contact + Opportunity (agregador count)

**Caso de uso**: "Quantas oportunidades ativas cada contato tem?"

**JSON**:

```json
{
  "document": "Contact",
  "fields": "code,name",
  "sort": [{ "property": "name.full", "direction": "ASC" }],
  "limit": 1000,
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "contact",
      "filter": {
        "match": "and",
        "conditions": [
          { "term": "status", "operator": "in", "value": ["Nova", "Ofertando Imveis", "Em Visitacao"] }
        ]
      },
      "aggregators": {
        "activeOpportunities": { "aggregator": "count" }
      }
    }
  ]
}
```

**SQL**:

```sql
SELECT ct.code, ct.name,
       COUNT(o._id) AS activeOpportunities
  FROM Contact ct
 INNER JOIN Opportunity o ON ct._id = o.contact._id
 WHERE o.status IN ('Nova', 'Ofertando Imveis', 'Em Visitacao')
 GROUP BY ct.code, ct.name
 ORDER BY ct.name ASC
 LIMIT 1000
```

---

### Exemplo 3: Contact + Opportunity + ProductsPerOpportunities (relations recursivas, cadeia de 3 niveis)

**Caso de uso**: "Para cada contato, obter suas oportunidades com ofertas de produtos -- cadeia recursiva de 3 niveis"

**JSON**:

```json
{
  "document": "Contact",
  "filter": {
    "match": "and",
    "conditions": [
      { "term": "status", "operator": "equals", "value": "active" }
    ]
  },
  "fields": "code,name",
  "limit": 100,
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "contact",
      "filter": {
        "match": "and",
        "conditions": [
          { "term": "status", "operator": "in", "value": ["Nova", "Em Visitacao"] }
        ]
      },
      "fields": "code,status,label",
      "sort": [{ "property": "_createdAt", "direction": "DESC" }],
      "limit": 20,
      "aggregators": {
        "opportunities": { "aggregator": "push" },
        "opportunityCount": { "aggregator": "count" }
      },
      "relations": [
        {
          "document": "ProductsPerOpportunities",
          "lookup": "opportunity",
          "fields": "status,rating,product",
          "limit": 50,
          "aggregators": {
            "products": { "aggregator": "push" },
            "productCount": { "aggregator": "count" }
          }
        }
      ]
    }
  ]
}
```

---

### Exemplo 4: Activity + Product (com lookup null -- atividades sem produto)

**Caso de uso**: "Listar todas as atividades, incluindo aquelas sem produto vinculado"

**JSON**:

```json
{
  "document": "Activity",
  "filter": {
    "match": "and",
    "conditions": [
      { "term": "status", "operator": "in", "value": ["new", "in-progress"] }
    ]
  },
  "fields": "code,subject,status",
  "sort": [{ "property": "_createdAt", "direction": "DESC" }],
  "limit": 200,
  "relations": [
    {
      "document": "Product",
      "lookup": "product",
      "fields": "code,sale",
      "limit": 1,
      "aggregators": {
        "productCode": { "aggregator": "first", "field": "code" },
        "productSale": { "aggregator": "first", "field": "sale" }
      }
    }
  ]
}
```

**Resposta esperada** (atividades sem produto recebem `null` nos agregadores):

```json
{"code":8001,"subject":"Ligacao sobre apartamento","status":"in-progress","productCode":123,"productSale":{"value":450000,"currency":"BRL"}}
{"code":8002,"subject":"Email de follow-up","status":"new","productCode":null,"productSale":null}
```

---

### Exemplo 5: Campaign + Opportunity (count + first)

**Caso de uso**: "Para cada campanha, contar oportunidades e obter a mais recente"

**JSON**:

```json
{
  "document": "Campaign",
  "filter": {
    "match": "and",
    "conditions": [
      { "term": "status", "operator": "equals", "value": "Ativo" }
    ]
  },
  "fields": "code,name,type",
  "limit": 50,
  "relations": [
    {
      "document": "Opportunity",
      "lookup": "campaign",
      "sort": [{ "property": "_createdAt", "direction": "DESC" }],
      "aggregators": {
        "totalOpportunities": { "aggregator": "count" },
        "newestOpportunity": { "aggregator": "first" },
        "avgValue": { "aggregator": "avg", "field": "value" }
      }
    }
  ]
}
```

---

### Exemplo 6: Contact + Message (agregador max, espelha relations existentes)

**Caso de uso**: "Ultimo email enviado para cada contato"

**JSON**:

```json
{
  "document": "Contact",
  "fields": "code,name",
  "sort": [{ "property": "name.full", "direction": "ASC" }],
  "limit": 1000,
  "relations": [
    {
      "document": "Message",
      "lookup": "contact",
      "filter": {
        "match": "and",
        "conditions": [
          { "term": "type", "operator": "equals", "value": "Email" },
          { "term": "status", "operator": "equals", "value": "Enviada" }
        ]
      },
      "aggregators": {
        "lastEmailSentAt": { "aggregator": "max", "field": "_createdAt" },
        "totalEmailsSent": { "aggregator": "count" }
      }
    }
  ]
}
```

---

### Exemplo 7: Exemplo com Seguranca (Degradacao Graciosa)

**Caso de uso**: "Corretor consulta suas oportunidades com dados de produto -- mas nao tem acesso ao modulo Product"

**Cenario**:
- Usuario e corretor com perfil de acesso "Corretor"
- `Opportunity:access:Corretor` define `readFilter: { conditions: [{ term: "_user._id", operator: "equals", value: "$user" }] }`
- Usuario **nao tem acesso** ao modulo `Product` (`getAccessFor('Product', user)` retorna `false`)

**JSON**:

```json
{
  "document": "Opportunity",
  "fields": "code,status,label",
  "sort": [{ "property": "_createdAt", "direction": "DESC" }],
  "limit": 100,
  "relations": [
    {
      "document": "Product",
      "lookup": "product",
      "fields": "code,sale",
      "aggregators": {
        "productCode": { "aggregator": "first", "field": "code" },
        "productSale": { "aggregator": "first", "field": "sale" }
      }
    }
  ]
}
```

**O que acontece internamente**:

1. **Camada 1**: Usuario autenticado como "Corretor"
2. **Camada 2 (primario)**: `getAccessFor('Opportunity', user)` retorna acesso "Corretor" -- **OK, consulta prossegue**
3. **Camada 3**: `readFilter` da Opportunity e mesclado -- corretor so ve suas proprias oportunidades
4. **Camada 2 (relation)**: `getAccessFor('Product', user)` retorna `false` -- **relation ignorada, agregadores definidos como null**
5. **Aviso**: `_meta.warnings` inclui `{ "type": "RELATION_ACCESS_DENIED", "document": "Product" }`

**Resposta esperada** (corretor ve suas oportunidades; campos de produto sao null):

```json
{"_meta":{"document":"Opportunity","relations":["Product"],"warnings":[{"type":"RELATION_ACCESS_DENIED","document":"Product","message":"User lacks read access to Product"}]}}
{"code":5001,"status":"Nova","label":"Apt 301 - Centro","productCode":null,"productSale":null}
{"code":5002,"status":"Em Visitacao","label":"Casa 12 - Praia","productCode":null,"productSale":null}
```

**Contraste com comportamento anterior**: No design anterior da RFC, esta consulta teria sido **inteiramente rejeitada** porque o usuario nao tinha acesso a Product. Com degradacao graciosa, o corretor ainda recebe seus dados de oportunidade.

---

## 10. Fases de Implementacao

### Fase 1 (MVP)

- Endpoint de consulta JSON (`POST /rest/query/json`)
- Relations recursivas com joins inferidos por lookup
- Max 2 niveis de aninhamento, max 5 relations total
- Todos os agregadores: `count`, `sum`, `avg`, `min`, `max`, `first`, `last`, `push`, `addToSet`
- Seguranca completa com degradacao graciosa
- `filter`, `fields`, `sort`, `limit` por relation
- Ponte Python para grandes datasets
- Resposta streaming NDJSON
- Validacao Zod para entrada da consulta

### Fase 2

- Endpoint de consulta SQL (`POST /rest/query/sql`)
- Integracao `node-sql-parser`
- Traducao SQL para IQR de relations
- Profundidade de aninhamento ilimitada (configuravel)
- Suporte GROUP BY / HAVING na interface SQL

### Fase 3

- Suporte CROSS JOIN com avisos obrigatorios
- Subqueries (na clausula WHERE do SQL)
- Suporte UNION no SQL
- Ponte Python para agregacoes estatisticas complexas
- Timeout e cancelamento de consulta

### Fase 4

- Cache de plano de consulta
- Otimizador de consulta (otimizacao de ordem de relation baseada em cardinalidade)
- Avisos de sugestao de indice
- Pipeline `$lookup` do MongoDB como estrategia alternativa de execucao
- Dashboard de performance / analytics de consulta

---

## 11. Estrategia de Testes

Conforme ADR-0003 (Estrategia de Testes com Jest e Supertest):

### Testes Unitarios

- **Parser SQL**: Traducao de AST para IQR de relations
- **Validador de consulta JSON**: Validacao de schema Zod para consultas validas/invalidas
- **Resolucao de lookup**: Inferencia correta de condicao de join a partir dos metadados
- **Logica de agregadores**: Cada agregador produz resultados corretos
- **Extracao de filtro**: Divisao correta de filtro por modulo

### Testes de Integracao (com MongoDB Memory Server)

- **Execucao completa**: End-to-end com colecoes MongoDB reais
- **Testes de seguranca**: Verificar que campos de relations nao autorizadas sao null (nao erro), readFilters aplicados por modulo
- **Relations recursivas**: Cadeias de 2-3 niveis produzem resultados aninhados corretos
- **Corretude de agregacoes**: Todos os 9 agregadores produzem valores corretos

### Testes Python

- **`cross_module_join.py`**: Testes unitarios com pytest
- **Operacoes de agregacao**: Verificar que agregacao do Polars corresponde a resultados esperados
- **Casos limite**: Datasets vazios, chaves de grupo nulas

---

## 12. Referencias de Pesquisa para Implementadores

### Context7

1. **`node-sql-parser`**: "How to parse SQL SELECT with JOIN into AST in node-sql-parser"
2. **MongoDB Node.js Driver**: "How to use $lookup in aggregation pipeline with readPreference secondary"
3. **Zod**: "How to create recursive schemas with z.lazy for nested filter conditions"
4. **Fastify**: "How to stream NDJSON responses in Fastify with proper Content-Type"
5. **Polars (Python)**: "How to perform DataFrame aggregation with group_by in Polars"

### Pesquisas Perplexity

1. "node-sql-parser SQL to AST translation TypeScript examples 2026"
2. "MongoDB $lookup cross-collection security RBAC streaming best practices 2026"
3. "Node.js Transform stream backpressure cross-collection join patterns"
4. "Polars Python DataFrame aggregation group_by push list performance 2026"

---

## 13. Perguntas Abertas

1. **Profundidade maxima de aninhamento**: Devemos limitar a profundidade de relations recursivas a 3 niveis na Fase 1?
2. **Timeout de consulta**: A consulta cross-module deve ter um `maxTimeMS` diferente do findStream (atualmente 5 min)?
3. **Log de auditoria**: Devemos registrar o IQR completo para auditoria, ou somente os modulos e usuario?
4. **Rate limiting**: Os endpoints de consulta devem ter rate limits mais restritos que o find regular?
5. **Limiar do Python**: Em qual tamanho de dataset devemos alternar de agregacao JS para ponte Python?
6. **Relation sem agregador**: Devemos permitir uma relation com apenas sub-relations aninhadas e sem agregadores proprios (pass-through)?

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
- [Padrao Relations do MetaObject](../../src/private/metadata/Contact.json) (linhas 339-403)
- [Schema Relation](../../src/imports/model/Relation.ts)
- [node-sql-parser (npm)](https://www.npmjs.com/package/node-sql-parser)
- [Polars Documentation](https://pola.rs/)
- [Fastify Streaming](https://fastify.dev/docs/latest/Reference/Reply/#streams)

---

_Autores: Equipe Konecty_
_Data: 2026-02-13_
