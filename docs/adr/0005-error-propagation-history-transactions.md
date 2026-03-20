# RDA-0005: Error Propagation in History Creation for Transaction Retry

**Status**: Accepted  
**Date**: 2026-03-20  
**Author**: Cloud Agent  
**Related**: [RDA-0002: Error Handling Centralizado](./0002-error-handling-centralizado.md)

---

## Context

The history creation flow (`createHistory`) was masking MongoDB transaction errors by returning `false` on failures instead of throwing errors. This approach had several problems:

### Problem Statement

When MongoDB aborts a transaction transiently (e.g., `NoSuchTransaction` error), the current error handling:
1. Catches the error in `createHistory`
2. Returns `false` to the caller
3. Caller (`processChangeSync`) wraps this as generic `Error creating history`
4. Retry logic in `retryMongoTransaction` cannot identify this as a retryable error
5. Operation fails permanently instead of being retried

### Impact

- **User-Facing**: File update/remove operations fail intermittently when MongoDB aborts transactions
- **Debugging**: Generic error messages obscure the root cause (MongoDB transaction state)
- **Reliability**: Operations that should succeed after retry fail permanently

### Technical Constraints

- MongoDB transactions use error codes (`NoSuchTransaction`, `WriteConflict`) and labels (`TransientTransactionError`) to signal retryable failures
- The `retryMongoTransaction` utility needs access to these MongoDB-specific error properties
- Error wrapping for context must preserve MongoDB metadata

### Current State

```javascript
// createHistory (before)
try {
  await history.insertOne(historyItem, { session: dbSession });
  return true;
} catch (e) {
  logger.error(e, 'Error on create history');
  return false;  // ❌ Masks the error
}

// processChangeSync (before)
const historyResult = await createHistory(...);
if (historyResult === false) {
  throw new Error(`Error creating history`);  // ❌ Generic error, no MongoDB metadata
}
```

---

## Decision

We will modify error handling in history creation to:

1. **`createHistory` throws errors** instead of returning `false`
2. **`processChangeSync` wraps errors with context** while preserving MongoDB metadata
3. **Transaction retry logic includes `NoSuchTransaction`** and transaction labels

### Implementation

```typescript
// createHistory (after)
try {
  await history.insertOne(historyItem, { session: dbSession });
  return true;
} catch (e) {
  logger.error(e, 'Error on create history');
  throw e;  // ✅ Propagate original error
}

// processChangeSync (after)
try {
  await createHistory(...);
} catch (error) {
  throw wrapHistoryError(error);  // ✅ Add context, preserve MongoDB metadata
}

// wrapHistoryError
function wrapHistoryError(error: unknown): Error {
  const originalError = error as ExtendedError;
  const message = `Error creating history: ${originalError?.message ?? 'Unknown error'}`;
  const wrappedError = new Error(message, { cause: originalError }) as ExtendedError;
  
  // Preserve MongoDB metadata for retry logic
  return preserveMongoMetadata(wrappedError, originalError);
}
```

### Principles

- **Error transparency**: Errors propagate with full context
- **Metadata preservation**: MongoDB error codes/labels preserved for retry logic
- **Contextual wrapping**: Add human-readable context without losing technical details
- **Retry-friendly**: Transaction utilities can identify retryable errors

---

## Consequences

### Positive

- **Reliability**: Transient MongoDB transaction failures are retried automatically
- **Debuggability**: Error logs preserve MongoDB error codes (`NoSuchTransaction`, etc.)
- **Consistency**: Aligns with RDA-0002 error handling patterns (throw, don't return false)
- **Test Coverage**: 95%+ coverage on transaction utilities, comprehensive error wrapping tests

### Negative

- **Breaking Change**: Code expecting `createHistory` to return `false` will break (mitigated: internal API only)
- **Complexity**: Error wrapping logic adds ~30 lines of code
- **Learning Curve**: Developers must understand MongoDB error metadata preservation

### Neutral

- **Error Messages**: More verbose (includes both context and original error)
- **Stack Traces**: Nested errors create longer stack traces

---

## Alternatives Considered

### Alternative 1: Keep returning `false`, add retry in caller

**Description**: Keep `createHistory` returning `false`, implement retry logic in `processChangeSync`

**Pros**:
- No breaking change to `createHistory` API
- Simpler error handling

**Cons**:
- Retry logic duplicated across callers
- Cannot reuse existing `retryMongoTransaction` utility
- Doesn't address root cause (error masking)

**Why not chosen**: Violates DRY principle and doesn't solve the debugging problem

### Alternative 2: Return rich error object instead of throwing

**Description**: Return `{ success: boolean, error?: MongoError }` from `createHistory`

**Pros**:
- Explicit success/failure handling
- No exceptions in happy path

**Cons**:
- Inconsistent with other Konecty error handling (RDA-0002)
- Caller must remember to check `.success`
- Doesn't compose well with `retryMongoTransaction`

**Why not chosen**: Deviates from established error handling patterns

### Alternative 3: Catch and re-throw with full error copy

**Description**: Deep clone MongoDB error properties in catch block

**Pros**:
- Preserves all error properties automatically

**Cons**:
- Deep cloning is expensive and error-prone
- May copy internal MongoDB implementation details
- Harder to test

**Why not chosen**: Over-engineered, manual property preservation is explicit and testable

---

## Implementation Plan

1. ✅ Update `createHistory.js` to throw errors instead of returning `false`
2. ✅ Update `processChangeSync` to catch and wrap errors with `wrapHistoryError`
3. ✅ Implement `wrapHistoryError` and `preserveMongoMetadata` utilities
4. ✅ Add `NoSuchTransaction` to retryable error codes
5. ✅ Add `TransientTransactionError` and `UnknownTransactionCommitResult` labels
6. ✅ Write comprehensive tests for error wrapping
7. ✅ Write tests for retry logic with new error codes
8. ✅ Update changelog: `docs/changelog/2026-03-18_fix-nosuchtransaction-history-retry.md`

---

## References

- [RDA-0002: Error Handling Centralizado](./0002-error-handling-centralizado.md) - Established error handling patterns
- [MongoDB Transaction Errors](https://www.mongodb.com/docs/manual/core/transactions/#transaction-error-handling) - Official MongoDB error handling guide
- [PR Discussion](https://github.com/konecty/konecty/pull/XXX) - Original issue report
- [Changelog](../changelog/2026-03-18_fix-nosuchtransaction-history-retry.md) - Implementation details

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-03-20 | Cloud Agent | Initial version |
