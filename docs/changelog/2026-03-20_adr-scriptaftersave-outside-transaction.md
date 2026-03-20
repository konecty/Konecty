# Changelog - ADR for scriptAfterSave transaction boundary

- **Summary:** Added ADR-0005 to formalize that `scriptAfterSave` must run outside MongoDB transactions.
- **Motivation:** Prevent long transaction windows caused by post-save custom hooks from increasing abort frequency and surfacing `NoSuchTransaction` errors in transactional paths.
- **What changed:** Added architectural decision record `docs/adr/0005-scriptaftersave-outside-transaction.md` with context, decision, alternatives, consequences, implementation plan, and references.
- **Technical impact:** Documentation-only change; no runtime behavior is introduced by this entry itself.
- **External impact:** Clarifies and standardizes expected backend hook execution policy for maintainers and reviewers.
- **How to validate:** Confirm ADR-0005 exists and states that `scriptAfterSave` executes post-commit and outside transaction boundaries.
- **Affected files:** `docs/adr/0005-scriptaftersave-outside-transaction.md`, `docs/changelog/2026-03-20_adr-scriptaftersave-outside-transaction.md`, `docs/changelog/README.md`
- **Is there a migration?** No.
