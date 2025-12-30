# ADR-0004: Default Sorting for Consistency

## Status
Accepted

## Context
When no sorting is specified by the client, MongoDB may return results in non-deterministic order, especially with `readPreference: 'secondaryPreferred'`. This causes:
- Different results between executions
- Inability to compare results between endpoints
- Problems in confidence tests

## Decision
Apply default sort `{ _id: 1 }` when no sorting is specified by the client.

## Implementation Details

### Sorting Rules
1. If `sort` is provided by client: uses specified sort
2. If `sort` is not provided: applies `{ _id: 1 }` as default
3. If `limit > 1000`: forces `{ _id: 1 }` (same behavior as original find.ts)

### Location
- Implemented in `findUtils.ts` in the `buildFindQuery()` function
- Applied before aggregation pipeline construction
- Ensures `aggregateStages` always has `$sort` when needed

## Consequences

### Positive
- **Consistency**: Results always in the same order between executions
- **Testability**: Confidence tests can compare results exactly
- **Predictability**: Deterministic behavior facilitates debugging
- **Performance**: Sorting by `_id` is efficient (primary index)

### Negative
- Minimal sorting overhead (acceptable given the benefit)
- May not be the desired sort by client (but client can specify)

### Mitigated Risks
- **Performance**: `_id` is indexed, sorting is fast
- **Compatibility**: Behavior aligned with find.ts when `limit > 1000`

## Alternatives Considered

1. **No default sort**: Non-deterministic results, test problems
2. **Sort by creation date**: Requires additional field, may not exist
3. **Random sort**: Doesn't meet consistency need

## References
- Implementation: `src/imports/data/api/findUtils.ts` (lines 270-278)
- Confidence test: `__test__/data/api/runFindStreamConfidenceTest.ts`

