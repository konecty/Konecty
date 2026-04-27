# SFTP: basename por hash, delete resolvido na classe, sem módulo `resolveUploadBaseName`

## Resumo

- **Upload:** o stem do ficheiro na `key` é só o **MD5 do conteúdo** + extensão (igual a `fs` / `s3` / `server`), sem regras específicas de documento/campo.
- **Delete (SFTP):** a leitura da `key` / `name` no Mongo e o fallback de path passam a viver em **`SFTPStorage.resolveDeleteTargetFromRecord`** (e `toFallbackDeleteTarget` privado), em vez de ficheiros em `src/imports/file/`.
- **Removido** o pacote `src/imports/file/resolveUploadBaseName/` (incl. `tryOfficeAgencyBrandingUploadBaseName`) e `resolveStorageBasenameForDelete.ts`.
- **ETag** em `sendFile`: continua a poder evitar recalcular MD5 do buffer quando o basename já traz o hash (incl. sufixo `-*-hash` em ficheiros antigos no SFTP).

## Arquivos afetados (atual)

- `src/imports/storage/SFTPStorage.ts` — `resolveDeleteTargetFromRecord`, `toFallbackDeleteTarget`, ETag
- `src/server/routes/rest/file/upload.ts`, `delete.ts`

## Leitura relacionada

- [2026-04-16 — SFTP no Namespace, etc.](./2026-04-16_sftp-storage-file-upload-delete.md)
