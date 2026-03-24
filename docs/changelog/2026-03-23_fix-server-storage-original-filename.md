# Changelog - Fix server storage original filename

- **Summary:** Align backend-forwarded server storage multipart payload with the UI upload format.
- **Motivation:** Blob uploads expected a multipart part with `name="fileName"`, image content-type, base64 transfer encoding, and original filename, but backend forwarding used default `FormData` behavior.
- **What changed:** `ServerStorage.upload()` now builds multipart body manually with `Content-Disposition: form-data; name="fileName"; filename="<original>"`, `Content-Type: <fileData.kind>`, and `Content-Transfer-Encoding: base64`, using an auto-generated numeric multipart boundary.
- **Technical impact:** Backend forwarding now matches the same multipart contract used by UI uploads for `storage.type = server`.
- **External impact:** Users see the original filename in file metadata after uploads performed through backend routes.
- **How to validate:** Upload an image via Konecty backend route using `storage.type = server`, then verify file metadata stores human-readable `name` (for example `placeholder.jpg`) while image retrieval remains functional.
- **Affected files:** `src/imports/storage/ServerStorage.ts`, `docs/changelog/2026-03-23_fix-server-storage-original-filename.md`, `docs/changelog/README.md`
- **Migration required?** No.
