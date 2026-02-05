# ADR-0002: Common Logic Extraction to findUtils

## Status
Accepted

## Context
The `find()` and `findStream()` functions shared most of their logic:
- MongoDB query construction
- Filter and permission application
- Access condition calculation
- Aggregation pipeline construction

Code duplication violated the DRY (Don't Repeat Yourself) principle.

## Decision
Extract all common logic to `findUtils.ts` with the `buildFindQuery()` function, which returns:
- Constructed MongoDB query
- Aggregation pipeline
- Access conditions
- Condition keys
- Query options (sort, limit, skip, projection)
- Necessary metadata (metaObject, user, access, collection)

## Implementation Details

### Extracted Helper Functions
1. **`buildSortOptions()`**: Builds sort options considering special types (money, personName, $textScore)
2. **`buildAccessConditionsForField()`**: Calculates access conditions for a specific field
3. **`buildAccessConditionsMap()`**: Builds access conditions map for all fields
4. **`calculateConditionsKeys()`**: Calculates condition keys based on projection

### Consistency with Original find.ts
- Replicated behavior from `find.ts` line 129 to ensure compatibility
- Same query construction and filter application logic
- Ensures both endpoints return exactly the same data

## Consequences

### Positive
- **DRY**: Eliminates code duplication
- **Maintainability**: Query logic changes in a single place
- **Testability**: Common logic can be tested in isolation
- **Consistency**: Ensures both endpoints use exactly the same logic

### Negative
- Additional file to maintain
- Dependency between `find.ts`, `findStream.ts` and `findUtils.ts`

### Mitigated Risks
- **Breaking changes**: Confidence test validates behavior hasn't changed
- **Complexity**: Well-named and documented helper functions

## Alternatives Considered

1. **Keep duplication**: Would violate DRY and make maintenance difficult
2. **Refactor original find.ts**: Risk of breaking existing functionality
3. **Shared class**: Unnecessary overhead for functional operations

## References
- Implementation: `src/imports/data/api/findUtils.ts`
- Usage in find: `src/imports/data/api/find.ts` (not modified)
- Usage in findStream: `src/imports/data/api/findStream.ts`

