# ADR-0004: List and DocumentList schema – calendars field

## Status

**Accepted** – January 2026

## Context

The konecty-ui application implements a Calendar View for lists whose metadata define `calendars`. The backend receives and stores list metadata (e.g. from Activity.json) that already includes a `calendars` array. The Zod schemas used to validate list metadata (`ListSchema`, `DocumentListSchema`) did not include `calendars`, which could cause validation to strip or reject valid metadata when loading or saving list configs.

## Decision

Add an optional `calendars` field to both `ListSchema` (in `src/imports/model/List.ts`) and `DocumentListSchema` (in `src/imports/model/DocumentList.ts`) with the following shape:

- `name`: string (required in each item)
- `startAt`: string (required)
- `endAt`: string (optional)
- `title`: string (required)
- `descriminator`: string (optional)
- `label`: record (optional)
- `itemType`: `'event' | 'task'` (optional) – for future event vs task distinction
- `colorField`: string (optional) – for dynamic color per record

All new fields inside each calendar item are optional except the ones already used in existing metadata (`name`, `startAt`, `title`). The whole `calendars` array is optional so existing list configs without calendars remain valid.

## Consequences

- List metadata that includes `calendars` (e.g. Activity) is validated and preserved by the backend.
- Existing metadata without `calendars` is unchanged and remains valid.
- UI (konecty-ui) can rely on the same structure when consuming list schema from the API.
