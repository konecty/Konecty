# Changelog - Fix server storage original filename

- **Summary:** Align backend-forwarded server storage multipart payload with the UI upload format and improve code quality.
- **Motivation:** Blob uploads expected a multipart part with `name="fileName"`, image content-type, base64 transfer encoding, and original filename, but backend forwarding used default `FormData` behavior.
- **What changed:** 
  - `ServerStorage.upload()` now builds multipart body manually with `Content-Disposition: form-data; name="fileName"; filename="<original>"`, `Content-Type: <fileData.kind>`, and `Content-Transfer-Encoding: base64`, using an auto-generated numeric multipart boundary.
  - Extracted magic numbers to named constants (`BOUNDARY_RANDOM_MAX`, `BOUNDARY_PADDING_LENGTH`, `HTTP_CLIENT_ERROR_MIN`).
  - Added structured logging with Pino for upload success, failure, and decode errors.
  - Improved error handling with proper context logging in upload and delete operations.
- **Technical impact:** Backend forwarding now matches the same multipart contract used by UI uploads for `storage.type = server`. Code follows clean code principles (no magic numbers, structured logging, better error handling).
- **External impact:** Users see the original filename in file metadata after uploads performed through backend routes. Better operational observability through structured logs.
- **How to validate:** Upload an image via Konecty backend route using `storage.type = server`, then verify file metadata stores human-readable `name` (for example `placeholder.jpg`) while image retrieval remains functional. Check logs for structured trace/error messages.
- **Affected files:** `src/imports/storage/ServerStorage.ts`, `docs/changelog/2026-03-23_fix-server-storage-original-filename.md`, `docs/changelog/README.md`
- **Migration required?** No.
