# WIP recente (complemento)

Resumo do que foi concluído nesta sessão, em complemento a trabalhos em WIP commitados localmente por outros agentes.

## Variáveis dinâmicas de data — `$monthsFromNow:N`

- **`src/imports/data/filterUtils.js`**
  - JSDoc: adicionada variável `$monthsFromNow:N` — N months from now at 00:00:00.000
  - Parser: bloco `monthsFwdMatch` que faz match de `$monthsFromNow:(\d+)`, soma N meses à data atual e retorna 00:00:00.000 (mesmo padrão de `$daysFromNow`)
- **`__test__/data/filterUtils/parseConditionValue.test.js`**
  - Novo `describe('Dynamic date variable: $monthsFromNow:N')` com teste que valida retorno daqui 1 mês com hora zerada
- **Documentação**
  - `docs/pt-BR/filters.md`: `$monthsFromNow:N` na frase introdutória da seção de datas relativas no futuro; nova linha na tabela "Relativas paramétricas (futuro)"
  - `docs/en/filters.md`: idem em inglês
  - `docs/en/internal/filter.md`: `$monthsFromNow:N` na lista de dicas e na tabela de variáveis dinâmicas

Total de variáveis paramétricas de data no backend: **15** (incluindo `$monthsFromNow:N`).

## Backend cache for Chart and Table widgets (ADR-0049)

Extended the dual-layer cache system (ADR-0045) to cover Chart (graph SVG) and Table (pivot JSON) widgets, following KISS/DRY/SOLID principles.

### `src/imports/dashboards/dashboardCache.ts`
- Added optional `blob?: string` field to `CacheEntry` — stores SVG or serialized JSON without modifying existing KPI functions (Open/Closed)
- New `BlobCacheEntry` interface — typed return for blob cache operations
- `generateBlobEtag(data: string)` — SHA-256 truncated hash for blob data, same pattern as `generateEtag`
- `getCachedBlob(cacheKey)` — retrieves a cached blob entry with defensive TTL check
- `setCachedBlob(userId, document, operation, field, filter, blob, ttlSeconds)` — stores/updates a blob cache entry via upsert; reuses `buildCacheKey`, `hashFilter`, and existing indexes

### `src/imports/dashboards/dashboardCache.test.ts`
- New `describe('generateBlobEtag')` — tests for quoted output, determinism, uniqueness (SVG vs SVG, SVG vs JSON)
- New `describe('buildCacheKey with blob operations')` — tests graph vs pivot key differentiation, config hash differentiation

### `src/server/routes/rest/data/dataApi.ts`
- Shared constants: `HASH_ALGORITHM`, `HASH_ENCODING` (ADR-0012 no-magic-numbers)
- `withBlobCache(opts)` helper (DRY) — encapsulates cache check → ETag/304 → compute callback → store → HTTP headers; eliminates cache pattern duplication across endpoints
- `hashConfig(config)` helper — deterministic hash of graph/pivot config for use as cache key field
- **Graph endpoint** (`GET /rest/data/:document/graph`): accepts `cacheTTL` query param; wraps `graphStream` in `withBlobCache` with `operation: 'graph'`; returns HTTP 304 on ETag match
- **Pivot endpoint** (`GET /rest/data/:document/pivot`): accepts `cacheTTL` query param; wraps `pivotStream` in `withBlobCache` with `operation: 'pivot'`; returns HTTP 304 on ETag match

### List widget — explicitly excluded
The List widget uses the generic `find` endpoint and is paginated/frequently-mutated. Backend caching was explicitly excluded (documented in ADR-0049). Frontend Redux TTL cache remains sufficient.
