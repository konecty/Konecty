# SFTP: basename por hash, delete simples na rota, lógica de ficheiro real no `SFTPStorage`

## Resumo

- **Upload:** o stem do ficheiro na `key` é só o **MD5 do conteúdo** + extensão (igual a `fs` / `s3` / `server`), sem regras específicas de documento/campo.
- **Delete (rota REST):** fluxo do commit `144fe0d` (*feat: server file storage delete*): `fileRemove` → `path.join(document, recordId, fieldName)` → `fileStorage.delete` com o `fileName` do URL. Sem ramo especial na rota.
- **Delete (SFTP):** em `SFTPStorage.delete`, o basename usado para apagar no SFTP (e variantes) alinha com o ficheiro real: se o nome do URL não existir na pasta, lê a pasta e compara com os basenames ainda presentes nas `key`s do registo (após o `fileRemove` já ter removido o anexo), para escolher o ficheiro que ficou “órfão” no storage (ex. hash+ext em vez de `name` de exibição). Depois aplica `getDeletePathSuffixes` (principal, `thumbnail/`, `watermark/`) de forma análoga ao S3. As variantes listadas podem não existir todas (ex. `thumbnail` com a mesma extensão do original vs `.jpeg` forçado), por isso o SFTP pode logar `No such file` para um sufixo e ainda assim apagar os restantes.
- **Removido** o pacote `src/imports/file/resolveUploadBaseName/` (incl. `tryOfficeAgencyBrandingUploadBaseName`) e `resolveStorageBasenameForDelete.ts`.
- **ETag** em `sendFile`: continua a poder evitar recalcular MD5 do buffer quando o basename já traz o hash (incl. sufixo `-*-hash` em ficheiros antigos no SFTP).

## Arquivos afetados (atual)

- `src/imports/storage/SFTPStorage.ts` — `resolveDeleteBasename`, `getRemainingStorageBasenames`, `getDeletePathSuffixes`, ETag, etc.
- `src/server/routes/rest/file/upload.ts`, `delete.ts` (padrão simples; lógica de apagar por chave real no `SFTPStorage`)

## Leitura relacionada

- [2026-04-16 — SFTP no Namespace, etc.](./2026-04-16_sftp-storage-file-upload-delete.md)
