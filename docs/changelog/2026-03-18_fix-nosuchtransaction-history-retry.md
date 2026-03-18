# Changelog - Fix transaction retry on history creation

- **Summary:** Preserved MongoDB transactional error context during history writes so retry logic can correctly handle transient transaction aborts.
- **Motivation:** The update flow was masking transaction failures (`NoSuchTransaction`) as a generic `Error creating history`, preventing retry handling and making root-cause diagnosis harder.
- **What changed:** `createHistory` now rethrows original failures instead of returning `false`; `processChangeSync` now adds explicit context (`Error creating history: ...`) while preserving MongoDB error metadata; transaction retry detection now includes `NoSuchTransaction` and retryable transaction labels (`TransientTransactionError`, `UnknownTransactionCommitResult`).
- **Technical impact:** Affected transaction error propagation and retry behavior in history creation flows used by update and file removal paths.
- **External impact:** Users should see fewer intermittent failures on file update/remove operations when MongoDB aborts a transaction transiently; error logs now preserve the original MongoDB failure context.
- **How to validate:** Run `__test__/utils/transaction.test.ts` and execute a file removal/update flow that previously failed with `NoSuchTransaction`; verify retries occur and logs keep MongoDB error metadata.
- **Affected files:** `src/imports/konsistent/createHistory.js`, `src/imports/konsistent/index.ts`, `src/imports/utils/transaction.ts`, `__test__/utils/transaction.test.ts`
- **Migration required?** No.
