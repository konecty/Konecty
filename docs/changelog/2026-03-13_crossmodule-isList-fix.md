# CrossModuleQuery: isList self-referential lookup fix

## Date
2026-03-13

## Summary
Fixed 4 chained bugs in the cross-module query engine that caused null values when using isList self-referential lookups (e.g. Contact.staff -> Contact), and ensured `_id` is always present in primary records.

## Motivation
Queries aggregating data through isList self-referential lookups (e.g. groupBy `staff.name.full` with aggregator `first` on `staff.email.address`) returned null for all relation-derived fields. The root cause was a chain of bugs: wrong join direction, missing fields in the primary query, flat extraction of array IDs, and single-element traversal in the Python join script.

## What Changed
- `crossModuleQueryValidator.ts`: `resolveRelationLookup` now detects `isList: true` on self-referential lookups and reverses parentKey/childKey direction (`staff._id` / `_id` instead of `_id` / `staff._id`)
- `crossModuleQuery.ts`: new `buildAugmentedFields()` auto-injects `_id` and top-level field prefixes from groupBy, root aggregators, and relation parentKeys into the primary findStream fields
- `crossModuleQuery.ts`: new `extractParentIds()` flattens isList arrays (e.g. `staff[*]._id`) instead of simple property access
- `cross_module_join.py`: new `extract_all_ids()` traverses arrays to collect all IDs; `process_relation` now always applies aggregators (returning `0`/`[]` for empty matches instead of `null`)

## Technical Impact
- Modified: `src/imports/data/api/crossModuleQueryValidator.ts`
- Modified: `src/imports/data/api/crossModuleQuery.ts`
- Modified: `src/scripts/python/cross_module_join.py`
- Modified: `src/imports/data/api/__tests__/crossModuleQuery.integration.test.ts`
- Modified: `src/scripts/python/cross_module_join.test.py`

## External Impact
- Queries using isList self-referential lookups (e.g. Contact.staff) now return correct data instead of nulls
- Primary records always include `_id` even when not explicitly requested in `fields`
- Empty isList arrays produce `0`/`[]` aggregation results instead of `null`

## How to Validate
1. Send the following query to `POST /rest/query/json`:
```json
{
  "document": "Contact",
  "relations": [{ "document": "Contact", "lookup": "staff", "fields": "name.full,email.address", "limit": 1000, "aggregators": { "_count": { "aggregator": "count" } } }],
  "includeTotal": true, "includeMeta": true,
  "filter": { "match": "and", "conditions": { "status:equals": { "term": "status", "operator": "equals", "value": "Ativo" } } },
  "fields": "name.full", "limit": 1000,
  "groupBy": ["name.full", "staff.name.full"],
  "aggregators": { "first_staff_email_address": { "aggregator": "first", "field": "staff.email.address" } }
}
```
2. Verify `staff.name.full` and `first_staff_email_address` are populated (not null) for contacts that have staff
3. Run TypeScript tests: `npx jest --testPathPattern crossModuleQuery.integration`
4. Run Python tests: `uvx pytest src/scripts/python/cross_module_join.test.py -v --import-mode=importlib`

## Affected Files
- `src/imports/data/api/crossModuleQueryValidator.ts`
- `src/imports/data/api/crossModuleQuery.ts`
- `src/scripts/python/cross_module_join.py`
- `src/imports/data/api/__tests__/crossModuleQuery.integration.test.ts`
- `src/scripts/python/cross_module_join.test.py`

## Migration Required?
No
