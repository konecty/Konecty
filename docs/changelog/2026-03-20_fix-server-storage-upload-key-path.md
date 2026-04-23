# Changelog - Fix server storage upload key path

- **Summary:** Restore blob multipart filename behavior so the remote uploader stores files using the technical hashed key path.
- **Motivation:** `ServerStorage.upload()` started sending the original display filename in multipart (`placeholder.jpg`), which caused the remote bucket object key to diverge from the persisted `key`.
- **What changed:** `ServerStorage.upload()` now sends `filesToSave[0].name` (hashed filename + extension) as multipart filename again, preserving the expected remote storage path.
- **Technical impact:** Keeps DB `key` and bucket object key aligned for `type: server` storage mode; removes the decode helper that is no longer needed in this upload flow.
- **External impact:** Image URLs based on persisted hashed keys resolve correctly again in the bucket-backed preview/download flow.
- **How to validate:** Upload a file in `Product.pictures`, verify DB `key` and bucket object key both use `Product/<recordId>/pictures/<hash>.jpg`, and confirm image retrieval works through existing file/image routes.
- **Affected files:** `src/imports/storage/ServerStorage.ts`, `docs/changelog/2026-03-20_fix-server-storage-upload-key-path.md`, `docs/changelog/README.md`
- **Migration required?** No.
