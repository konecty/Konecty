# Documentação das Funções

## `update`

### Utilidade
Atualiza registros em um documento específico no banco de dados.

### Parâmetros
- `authTokenId` (string): ID do token de autenticação.
- `document` (string): Nome do documento a ser atualizado.
- `data` (object): Dados a serem atualizados, incluindo uma lista de IDs e os campos a serem atualizados.
- `contextUser` (object, opcional): Usuário no contexto da operação.
- `tracingSpan` (object, opcional): Span de rastreamento para telemetria.

### Regras Principais
- Verifica permissões de acesso e atualização.
- Valida os dados e os IDs fornecidos.
- Executa scripts de validação antes e depois da atualização.
- Retorna um erro se os dados ou permissões forem inválidos.

## `getNextUserFromQueue`

### Utilidade
Obtém o próximo usuário da fila para um documento específico.

### Parâmetros
- `authTokenId` (string): ID do token de autenticação.
- `document` (string): Nome do documento.
- `queueId` (string): ID da fila.
- `contextUser` (object, opcional): Usuário no contexto da operação.

### Regras Principais
- Verifica permissões de acesso.
- Retorna um erro se o usuário não tiver permissão.

## `find`

### Utilidade
Busca registros em um documento específico com base em filtros e critérios de ordenação.

### Parâmetros
- `authTokenId` (string, opcional): ID do token de autenticação.
- `document` (string): Nome do documento.
- `filter` (string | object): Filtro para a busca.
- `fields` (string, opcional): Campos a serem retornados.
- `sort` (string, opcional): Critérios de ordenação.
- `limit` (number, opcional): Limite de registros retornados (padrão: 50).
- `start` (number, opcional): Índice inicial (padrão: 0).
- `getTotal` (boolean, opcional): Se deve retornar o total de registros.
- `withDetailFields` (boolean, opcional): Se deve incluir campos detalhados.
- `contextUser` (object, opcional): Usuário no contexto da operação.
- `transformDatesToString` (boolean, opcional): Se deve transformar datas em strings (padrão: true).
- `tracingSpan` (object, opcional): Span de rastreamento para telemetria.

### Regras Principais
- Verifica permissões de leitura.
- Aplica filtros e critérios de ordenação.
- Retorna um erro se os dados ou permissões forem inválidos.

## `saveLead`

### Utilidade
Salva uma lead com os dados fornecidos, atualizando se a lead já existir.

### Parâmetros
- `authTokenId` (string): ID do token de autenticação.
- `lead` (object): Dados da lead.
- `save` (array, opcional): Relações a serem salvas.
- `contextUser` (object, opcional): Usuário no contexto da operação.

### Regras Principais
- Verifica permissões de acesso.
- Valida a presença de email ou telefone.
- Busca contato existente e atualiza dados conforme necessário.
- Retorna um erro se os dados ou permissões forem inválidos.

## `findById`

### Utilidade
Busca um registro específico por ID em um documento.

### Parâmetros
- `authTokenId` (string, opcional): ID do token de autenticação.
- `document` (string): Nome do documento.
- `fields` (string, opcional): Campos a serem retornados.
- `dataId` (string): ID do registro.
- `withDetailFields` (boolean, opcional): Se deve incluir campos detalhados.
- `contextUser` (object, opcional): Usuário no contexto da operação.

### Regras Principais
- Verifica permissões de leitura.
- Valida o ID do registro.
- Retorna um erro se os dados ou permissões forem inválidos.

## `deleteData`

### Utilidade
Deleta registros em um documento específico.

### Parâmetros
- `authTokenId` (string): ID do token de autenticação.
- `document` (string): Nome do documento.
- `data` (object): Dados contendo IDs dos registros a serem deletados.
- `contextUser` (object, opcional): Usuário no contexto da operação.

### Regras Principais
- Verifica permissões de exclusão.
- Valida os IDs dos registros.
- Retorna um erro se os dados ou permissões forem inválidos.

## `create`

### Utilidade
Cria um novo registro em um documento específico.

### Parâmetros
- `authTokenId` (string): ID do token de autenticação.
- `document` (string): Nome do documento.
- `data` (object): Dados do novo registro.
- `contextUser` (object, opcional): Usuário no contexto da operação.
- `upsert` (boolean, opcional): Se deve fazer upsert.
- `updateOnUpsert` (boolean, opcional): Se deve atualizar no upsert.
- `ignoreAutoNumber` (boolean, opcional): Se deve ignorar auto-numeração.
- `tracingSpan` (object, opcional): Span de rastreamento para telemetria.

### Regras Principais
- Verifica permissões de criação.
- Valida os dados fornecidos.
- Executa scripts de validação antes e depois da criação.
- Retorna um erro se os dados ou permissões forem inválidos.

## `historyFind`

### Utilidade
Busca o histórico de um registro específico por ID em um documento.

### Parâmetros
- `authTokenId` (string): ID do token de autenticação.
- `document` (string): Nome do documento.
- `dataId` (string): ID do registro.
- `fields` (string, opcional): Campos a serem retornados.
- `contextUser` (object, opcional): Usuário no contexto da operação.

### Regras Principais
- Verifica permissões de leitura.
- Valida o ID do registro.
- Retorna um erro se os dados ou permissões forem inválidos.

## `relationCreate`

### Utilidade
Cria uma relação para um campo específico em um documento.

### Parâmetros
- `authTokenId` (string): ID do token de autenticação.
- `document` (string): Nome do documento.
- `fieldName` (string): Nome do campo de relação.
- `data` (object): Dados da relação.
- `preview` (boolean, opcional): Se deve fazer um preview da relação.
- `contextUser` (object, opcional): Usuário no contexto da operação.

### Regras Principais
- Verifica permissões de acesso.
- Valida os dados e a relação fornecidos.
- Retorna um erro se os dados ou permissões forem inválidos.

## `findByLookup`

### Utilidade
Busca registros em um documento específico com base em um campo de lookup.

### Parâmetros
- `authTokenId` (string): ID do token de autenticação.
- `document` (string): Nome do documento.
- `fieldName` (string): Nome do campo de lookup.
- `search` (string): Termo de busca.
- `extraFilter` (object, opcional): Filtro adicional.
- `start` (number, opcional): Índice inicial.
- `limit` (number, opcional): Limite de registros retornados.
- `useChangeUserFilter` (boolean, opcional): Se deve usar o filtro de mudança de usuário.

### Regras Principais
- Verifica permissões de leitura.
- Aplica filtros e critérios de busca.
- Retorna um erro se os dados ou permissões forem inválidos.
