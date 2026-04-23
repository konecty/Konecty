# ADR-0005: Keep scriptAfterSave outside MongoDB transactions

## Status

Accepted

## Date

2026-03-20

## Context

The update flow currently includes transactional operations that must remain atomic, such as record updates, history creation, and Konsistent synchronization. The `scriptAfterSave` hook is a post-save extensibility point and can execute custom logic with variable execution time and external side effects.

When this hook runs inside `withTransaction`, transaction lifetime increases and the chance of aborted transactions also increases under contention or transient database conditions. In this scenario, downstream transactional calls can surface `NoSuchTransaction` errors, even when the root trigger was transaction abort timing.

The previous behavior in release 3.3.3 executed `scriptAfterSave` after a successful transaction commit, which reduced transactional exposure and isolated post-save custom logic from atomic write boundaries.

## Decision

`scriptAfterSave` must always execute outside the MongoDB transaction boundary in the update flow.

The transaction scope must remain limited to data consistency operations:

- Document update writes
- History creation
- Konsistent transactional synchronization
- Transactional message writes required for atomic persistence

After a successful commit, `scriptAfterSave` runs before event dispatch, using complete updated records and original record context.

## Alternatives considered

### Alternative 1: Keep scriptAfterSave inside transaction

This keeps strict rollback coupling with all update steps, but it increases transaction duration and raises abort risk for operations unrelated to core consistency.

Not selected because it creates avoidable operational fragility and couples custom post-save behavior to critical transactional paths.

### Alternative 2: Run scriptAfterSave asynchronously after response

This minimizes request latency but introduces eventual consistency in hook effects and makes operational traceability harder.

Not selected because current product behavior expects hook completion before response finalization and before event publication ordering.

## Consequences

### Positive

- Lower transaction duration and reduced abort exposure in update flows
- Clear separation between atomic persistence and post-commit customization
- Behavior aligned with historical stable flow from 3.3.3

### Negative

- Hook execution is no longer rollback-coupled to transaction failure
- Post-commit hook failures require explicit logging and operational monitoring

### Neutral

- API payload contract remains unchanged for update responses
- Event publishing order remains deterministic with hook execution before events

## Implementation plan

- Keep transactional scope restricted to atomic persistence and Konsistent transactional operations.
- Execute `scriptAfterSave` only after transaction success is confirmed.
- Ensure hook receives complete updated records and original records context.
- Maintain ordering: post-commit hook execution, then event dispatch.
- Validate update behavior in file removal and regular update flows.

## References

- Release comparison: 3.3.3 to 3.4.5 update flow refactor
- File: `src/imports/data/api/update.ts`
- Historical reference: `src/imports/data/data.js`
- Error pattern observed: `MongoServerError code 251 (NoSuchTransaction)`
