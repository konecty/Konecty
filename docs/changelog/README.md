# Changelog

Registro de alterações relevantes do projeto. Cada entrada segue o formato `YYYY-MM-DD_slug.md`.

## Entradas

- [2026-04-27 — SFTP: hash+ext, delete na rota estilo 144fe0d, basename real e variantes no `SFTPStorage`, fim de `resolveUploadBaseName`](./2026-04-27_refactor-sftp-file-upload-delete.md)
- [2026-04-16 — Storage SFTP (Namespace), resolução de delete, erros de upload e nomes Office](./2026-04-16_sftp-storage-file-upload-delete.md)
- [2026-03-26 — findByLookup: conditionFields no metadata do lookup](./2026-03-26_findbylookup-conditionfields.md)
- [2026-03-23 — Fix server storage original filename](./2026-03-23_fix-server-storage-original-filename.md)
- [2026-03-20 — MCP: Paginação em records_find e agregação cross-module em query_json](./2026-03-20_mcp-pagination-aggregation-prompts.md)
- [2026-03-20 — MCP: Redesign de prompts, erros e campos de controle](./2026-03-20_mcp-prompts-error-redesign.md)
- [2026-03-20 — Fix server storage upload key path](./2026-03-20_fix-server-storage-upload-key-path.md)
- [2026-03-20 — ADR: scriptAfterSave fora da transação](./2026-03-20_adr-scriptaftersave-outside-transaction.md)
- [2026-03-19 — Build reliability for MCP widgets in CI](./2026-03-19_esbuild-widgets-ci-resolution.md)
- [2026-03-18 — MCP: E.164 phone OTP e validação de filtro](./2026-03-18_mcp-e164-filter-validation.md)
- [2026-03-18 — MCP Servers (User & Admin)](./2026-03-18_mcp-servers.md)
- [2026-03-13 — CrossModuleQuery: isList self-referential lookup fix](./2026-03-13_crossmodule-isList-fix.md)
- [2026-03-11 — Data Explorer Backend: module metadata, saved queries CRUD, data export](./2026-03-11_data-explorer-backend.md)
- [2026-03-11 — Docker build retry e correção de checkout no workflow develop](./2026-03-11_docker-build-retry-registry-500.md)
- [2026-03-10 — Graph axis limits (xAxisLimit / yAxisLimit)](./2026-03-10_graph-axis-limits.md)
- [2025-03-11 — Fix blob upload original filename](./2025-03-11_fix-blob-upload-filename.md)
- [2025-03-02 — Documentação do operador exists e arrays vazios](./2025-03-02_exists-operator-empty-array-documentation.md)

Entries are in `docs/changelog/` as `YYYY-MM-DD_slug.md`.

| Date       | Slug                        | Summary |
|-----------|-----------------------------|--------|
| 2026-04-27 | refactor-sftp-file-upload-delete | MD5+ext no upload; delete simples na rota; SFTP apaga por basename real + variantes; fim de `resolveUploadBaseName` |
| 2026-04-16 | sftp-storage-file-upload-delete | Storage SFTP via Namespace, delete pela `key`, basename Office, erros estruturados no upload |
| 2026-03-26 | findbylookup-conditionfields | Apply lookup field conditionFields in findByLookup MongoDB filter |
| 2026-03-23 | fix-server-storage-original-filename | Align backend-forwarded server storage multipart payload with UI upload format |
| 2026-03-20 | fix-server-storage-upload-key-path | Restore hashed multipart filename for server storage uploads |
| 2026-03-20 | adr-scriptaftersave-outside-transaction | ADR-0005 formalizes scriptAfterSave outside transaction boundary |
| 2025-03-11 | fix-blob-upload-filename   | Preserve original filename on blob server uploads |