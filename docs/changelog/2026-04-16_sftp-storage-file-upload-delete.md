# SFTP em storage, resolução de caminho no delete e erros estruturados no upload

## Resumo

Inclui armazenamento de arquivos via **SFTP** junto aos modos já existentes, **merge opcional** de credenciais SFTP a partir de variáveis de ambiente sobre o `Namespace.storage`, corrige o delete físico quando o basename em `key` difere do parâmetro `fileName` da rota REST, gera nomes previsíveis para imagens do **Office** (`logo` / `pictures`) e devolve respostas `{ success: false, errors }` coerentes nas falhas de upload (incluindo exceções no `catch`), em vez de JSON inválido ou sucesso indevido.

## Motivação

- Permitir deploy de uploads em servidor SFTP (ex.: raiz de imagens do CMS) mantendo no documento **Namespace** as opções de thumbnail, JPEG, marca d’água e tamanhos, com possibilidade de **injetar host/usuário/senha/root por env** (K8s/Secret) sem gravar segredos no Mongo.
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
- **Configuração**
  - Novo módulo `resolveStorageConfigFromEnv.ts` com `applyStorageEnvOverride()`: quando `KONECTY_STORAGE_TYPE=sftp` e estão definidos `KONECTY_SFTP_HOST`, `KONECTY_SFTP_USER`, `KONECTY_SFTP_REMOTE_ROOT` (e opcionalmente `KONECTY_SFTP_PORT`, `KONECTY_SFTP_PASSWORD`), o runtime **sobrescreve** `MetaObject.Namespace.storage` com `type: 'sftp'` e esses campos, **preservando** do documento Namespace já carregado: `wm`, `thumbnail`, `jpeg`, `imageSizes`, `maxFileSize`. Se faltar host/usuário/root, o override é ignorado com log de aviso.
  - Chamadas a `applyStorageEnvOverride()` após carga do Namespace: ao final de `dbLoad` em `loadMetaObjects`, ao atualizar o Namespace via change stream, ao recarregar `Namespace.json` (watcher), e uma vez após `loadMetaObjects()` em `app.ts`.

## Impacto técnico

- SFTP pode ser configurado **só no Namespace** (Mongo/metadata) ou **híbrido**: opções de imagem no Namespace + conexão SFTP por env quando o override estiver ativo e completo.
- Rotas de upload/delete dependem de `key` consistente nos campos arquivo; a resolução lê o registro atual no Mongo.

## Impacto externo

- Clientes que já interpretam `success: false` e `errors[].message` passam a receber texto útil nas falhas de upload.
- Em Kubernetes ou Docker, é possível manter segredos só em **Secret**/env e ainda assim usar SFTP, desde que as variáveis obrigatórias do override estejam presentes.

## Como validar

1. **Só Namespace:** configurar `storage` com `type: "sftp"`, `host`, `username`, `password`, `remoteRoot` e opções de imagem; reiniciar o Konecty.
2. **Override por env:** deixar no Namespace apenas opções de imagem (ou `type` diferente) e exportar `KONECTY_STORAGE_TYPE=sftp` + `KONECTY_SFTP_HOST`, `KONECTY_SFTP_USER`, `KONECTY_SFTP_REMOTE_ROOT` (e demais); reiniciar e confirmar nos logs a mensagem de override aplicado e upload funcionando.
3. Enviar imagem em `Office.pictures`; conferir caminhos no SFTP sob `remoteRoot` e o padrão do basename na `key` (`logo-agencia-...` quando houver slug/código).
4. Excluir o arquivo via REST/UI e verificar remoção do arquivo principal e de `thumbnail/{stem}.jpeg` no SFTP.
5. Forçar falha (senha errada, caminho somente leitura) e conferir corpo JSON `{ "success": false, "errors": [{ "message": "..." }] }` com mensagem não vazia.

## Arquivos afetados (lista não exaustiva)

- `src/imports/storage/SFTPStorage.ts`, `FileStorage.ts`
- `src/imports/storage/fileStorageDeleteSuffixes.ts`
- `src/imports/model/Namespace/Storage.ts`, `src/imports/model/Namespace/index.ts`
- `src/imports/file/resolveUploadBaseName.ts`, `resolveStorageBasenameForDelete.ts`
- `src/server/routes/rest/file/upload.ts`, `delete.ts`
- `src/imports/file/file.js`
- `src/imports/storage/resolveStorageConfigFromEnv.ts`
- `src/imports/meta/loadMetaObjects.ts`, `src/server/app.ts` (chamadas a `applyStorageEnvOverride`)

## Existe migração?

**Para SFTP:** ou o Namespace já traz o bloco `storage` completo (`SFTPStorageCfg`), ou o ambiente define `KONECTY_STORAGE_TYPE=sftp` e as variáveis `KONECTY_SFTP_*` obrigatórias para o override (mantendo no Namespace ao menos thumbnail/jpeg/wm etc., se desejado).

**Não** para quem mantém apenas `fs` / `s3` / `server`, exceto se quiser apenas os ajustes de rota (erros de upload e resolução de delete), que são retrocompatíveis com o contrato JSON existente.

## Repositório relacionado

- **`@konecty/sdk`:** em `verifyResponseStatus`, passa a tentar interpretar o corpo JSON em respostas HTTP `4xx`/`5xx` para expor `errors[].message` quando o servidor não retorna 200. Publicar nova versão do pacote (ou usar o workspace linkado) para que apps que consomem o npm recebam esse comportamento.
