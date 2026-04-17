# SFTP em storage, resolução de caminho no delete e erros estruturados no upload

## Resumo

Inclui armazenamento de arquivos via **SFTP** junto aos modos já existentes (configuração **somente** pelo documento **Namespace** / `storage`, como `fs` e `s3`), corrige o delete físico quando o basename em `key` difere do parâmetro `fileName` da rota REST, gera nomes previsíveis para imagens do **Office** (`logo` / `pictures`) e devolve respostas `{ success: false, errors }` coerentes nas falhas de upload (incluindo exceções no `catch`), em vez de JSON inválido ou sucesso indevido.

## Motivação

- Permitir deploy de uploads em servidor SFTP (ex.: raiz de imagens do CMS) com o bloco `storage` no **Namespace** (Mongo ou `Namespace.json`), no mesmo padrão dos outros tipos de storage.
- Evitar arquivos órfãos (principal e `thumbnail/*.jpeg`) ao remover quando o cliente envia nome de exibição ou quando o identificador na URL (`code`) não coincide com o segmento de pasta gravado na `key`.
- Expor ao cliente da API a mensagem real de falha (SFTP, Sharp, permissão, falha no `fileUpload`/update), em vez de erro genérico só no front.

## O que mudou

- **Storage**
  - Nova classe `SFTPStorage` (conexão, `put`, `get`, `delete`, rollback se a gravação no banco falhar).
  - `FileStorage.fromNamespaceStorage` passa a tratar `type: 'sftp'`.
  - Schema Zod do `Namespace` inclui `SFTPStorageCfg` na união discriminada de `storage`.
  - `getFileStorageDeletePathSuffixes` concentra os sufixos: arquivo principal, `thumbnail/{basename}`, `thumbnail/{stem}.jpeg` e caminhos de watermark quando `wm` existe. O **SFTP** usa esse helper; **FS / S3 / Server** permanecem com o comportamento anterior (sem esse helper compartilhado nesses três).
- **Upload**
  - `resolveUploadBaseName` para `Office` + campos `logo` / `pictures`: prioriza `slug`, depois `name`; inclui `code` no padrão do basename quando houver; fallback com hash do conteúdo.
  - Após `fileStorage.upload`, se `fileUpload` retornar `{ success: false }` (array `errors` ou string legada `error`), a rota responde com `errorReturn(...)` em vez de `success: true`.
  - No `catch`, resposta com `errorReturn(mensagem)` em vez de `reply.send(error)` com objeto `Error`.
  - Uso de `getUserSafe` tipado com `KonectyResult<User>` (mesmo padrão da rota de delete de arquivo).
- **Delete**
  - `resolveStorageBasenameForDelete` resolve **diretório** (`dirname` da `key` do arquivo encontrado) e **basename**, alinhando pasta física ao upload quando a URL usa `code` e a `key` usa `_id`.
  - O pareamento de entrada tolera comparação só pelo basename da `key` quando fizer sentido.
- **`file.js`**
  - JSDoc em `fileRemove` documenta `contextUser` opcional para o TypeScript aceitar o usuário autenticado sem `as any`.

## Impacto técnico

- SFTP é configurado **apenas** via `Namespace.storage` (`type: 'sftp'`, `host`, `username`, `password`, `remoteRoot`, `port` opcional, mais opções comuns `wm` / `thumbnail` / etc.).
- Rotas de upload/delete dependem de `key` consistente nos campos arquivo; a resolução lê o registro atual no Mongo.

## Impacto externo

- Clientes que já interpretam `success: false` e `errors[].message` passam a receber texto útil nas falhas de upload.
- Credenciais SFTP passam a residir no **Namespace** (Mongo ou arquivo de metadata), como nos demais storages; ajustar deploy/Secret conforme a política de segredos do time.

## Como validar

1. Configurar no Namespace `storage` com `type: "sftp"`, `host`, `username`, `password`, `remoteRoot` e opções de imagem; reiniciar o Konecty.
2. Enviar imagem em `Office.pictures`; conferir caminhos no SFTP sob `remoteRoot` e o padrão do basename na `key` (`logo-agencia-...` quando houver slug/código).
3. Excluir o arquivo via REST/UI e verificar remoção do arquivo principal e de `thumbnail/{stem}.jpeg` no SFTP.
4. Forçar falha (senha errada, caminho somente leitura) e conferir corpo JSON `{ "success": false, "errors": [{ "message": "..." }] }` com mensagem não vazia.

## Arquivos afetados (lista não exaustiva)

- `src/imports/storage/SFTPStorage.ts`, `FileStorage.ts`
- `src/imports/storage/fileStorageDeleteSuffixes.ts`
- `src/imports/model/Namespace/Storage.ts`, `src/imports/model/Namespace/index.ts`
- `src/imports/file/resolveUploadBaseName.ts`, `resolveStorageBasenameForDelete.ts`
- `src/server/routes/rest/file/upload.ts`, `delete.ts`
- `src/imports/file/file.js`
- `src/imports/meta/loadMetaObjects.ts`, `src/server/app.ts`

## Existe migração?

**Para SFTP:** o Namespace deve trazer o bloco `storage` completo (`SFTPStorageCfg`). Quem usava apenas variáveis `KONECTY_STORAGE_TYPE` / `KONECTY_SFTP_*` no deploy precisa **copiar** host, porta, usuário, senha e `remoteRoot` para o documento Namespace (ou para o `Namespace.json` em modo filesystem) e remover essas envs do pod.

**Não** para quem mantém apenas `fs` / `s3` / `server`, exceto se quiser apenas os ajustes de rota (erros de upload e resolução de delete), que são retrocompatíveis com o contrato JSON existente.

## Repositório relacionado

- **`@konecty/sdk`:** em `verifyResponseStatus`, passa a tentar interpretar o corpo JSON em respostas HTTP `4xx`/`5xx` para expor `errors[].message` quando o servidor não retorna 200. Publicar nova versão do pacote (ou usar o workspace linkado) para que apps que consomem o npm recebam esse comportamento.
