# ADR-0011: Avoid Technocentrism in User-Facing Communication

> Architectural decision on empathetic, non-technical language in API responses and messages that may reach end users

---

## Status

**Accepted**

Date: 2026-02

Origin: Adapted from frontend [ADR-0024 (konecty-ui)](https://github.com/konecty/konecty-ui/blob/main/docs/adr/0024-evitar-tecnocentrismo-comunicacao.md) for backend API and error messages.

---

## Context

API responses and error messages from the backend are often consumed by the frontend and shown to end users, or exposed to integrations. Technical or jargon-heavy wording can create barriers and confusion.

### Problem Identified

- **Technocentrism**: Terms like "validation failed", "invalid payload", "query execution error" are clear to developers but not to end users
- **Lack of empathy**: Messages that state what went wrong without explaining what the user can do
- **Inconsistency**: Mix of technical and user-friendly messages across endpoints
- **Support friction**: End users cannot describe the issue clearly when messages are too technical

### Example

**Before (Technocentric)**:
```json
{ "success": false, "errors": [{ "message": "Zod validation failed at relations.0.aggregators" }] }
```

**After (User-friendly, with code for support)**:
```json
{ "success": false, "errors": [{ "message": "Invalid query. Please check that each relation has at least one aggregator defined.", "code": "CROSS_QUERY_VALIDATION" }] }
```

---

## Decision

Adopt an **empathetic and clear** approach for all user-facing communication from the backend:

1. **Avoid technical jargon in API response messages**: Use plain language that explains what is wrong or what the user can do
2. **Use error codes for support**: Keep a stable `code` (e.g. `CROSS_QUERY_VALIDATION`) for technical support and logging; message is for the user
3. **Logs may stay technical**: Internal logs and `details` can use technical terms for debugging
4. **Consistency with ADR-0009**: Follow the centralized error structure (user-friendly message, code, optional details) and extend it to all new endpoints
5. **Single language in backend**: Messages in English (backend standard); frontend or client is responsible for translation when needed

### Implementation

- **Error returns**: Use `errorReturn([{ message, code?, details? }])` with a user-friendly `message` and a stable `code`. Put technical context in `details` or in logs only.
- **Validation errors**: Instead of exposing schema paths (e.g. "relations.0.aggregators"), return a short, actionable message and a code.
- **Generic failures**: Avoid raw stack traces or "Internal server error" without a code; use a generic but clear message and a code for support to correlate with logs.

---

## Consequences

### Positive

- Better experience for end users and integrators
- Clearer support and debugging via stable codes
- Consistency with ADR-0009 and frontend ADR-0024
- Backend stays responsible for clarity; frontend for translation and presentation

### Negative

- Requires discipline to write messages in two “voices”: user-facing (plain) and logs (technical)
- Some legacy endpoints may still return technical messages until updated

### Neutral

- ADR-0009 already provides the structure; this ADR adds the principle (avoid technocentrism) and extends it to all user-facing text

---

## References

- [ADR-0009: Error Messages Structure Backend](./0009-error-messages-structure-backend.md)
- [graphErrors.ts](../../src/imports/utils/graphErrors.ts) — example of user-friendly messages and codes
- Frontend ADR-0024: Evitar tecnocentrismo na comunicação (konecty-ui) — source document

---

_Authors: Konecty Team_
