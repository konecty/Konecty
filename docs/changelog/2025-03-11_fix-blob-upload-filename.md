# Changelog - Fix blob upload original filename

- **Resumo:** Preservar o nome original do arquivo em uploads via blob server (ServerStorage).
- **Motivação:** Ao usar uploader externo (blob), o nome do arquivo original era perdido porque o FormData enviava o `keyFileName` (hash MD5 + extensão) em vez do nome original.
- **O que mudou:** Em `ServerStorage.upload()`, o terceiro argumento de `fd.append('file', ...)` passou de `file.name` (hash) para `fileData.name` (nome original). O blob server continua gerando a `key` com hash MD5 do conteúdo; apenas o campo `name` exibido/persistido passa a ser o nome original.
- **Impacto técnico:** Apenas `src/imports/storage/ServerStorage.ts` alterado. Comportamento de FS e S3 inalterado.
- **Impacto externo:** Clientes que usam BLOB_URL passam a ver e baixar arquivos com o nome original; nenhuma mudança breaking.
- **Como validar:** Fazer upload de um arquivo com nome distinto (ex.: `relatorio-marco.pdf`) via blob; verificar que no registro o campo `name` do arquivo é `relatorio-marco.pdf` e que a `key` continua no formato `document/recordId/fieldName/<hash>.pdf`.
- **Arquivos afetados:** `src/imports/storage/ServerStorage.ts`
- **Existe migração?** Não.
