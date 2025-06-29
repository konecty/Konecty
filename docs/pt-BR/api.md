# Documentação da API Konecty

A Konecty oferece uma API RESTful para interação com sua plataforma. Esta documentação apresenta os principais métodos de autenticação e um conjunto representativo de endpoints para você começar.

## Autenticação

Todas as requisições que exigem autenticação devem incluir:

- Um cabeçalho `Authorization` com um token válido:
  ```http
  Authorization: <token>
  ```
- Ou um cookie chamado `_authTokenId` com o token de sessão:
  ```http
  Cookie: _authTokenId=<token>
  ```

Alguns endpoints (como login) não exigem autenticação.

---

## Visão Geral dos Endpoints

Abaixo está uma seleção dos principais endpoints. Para cada um, mostramos o método HTTP, URL, parâmetros e exemplos de respostas.

### 1. Autenticação

#### Login
- **POST** `/rest/auth/login`
- **Body:**
  ```json
  {
    "user": "usuario@exemplo.com",
    "password": "suaSenha"
  }
  ```
- **Resposta de Sucesso:**
  ```json
  {
    "success": true,
    "authId": "<token>",
    "user": { /* informações do usuário */ },
    "cookieMaxAge": 2592000
  }
  ```
- **Resposta de Falha:**
  ```json
  {
    "success": false,
    "errors": [
      { "message": "Credenciais inválidas" }
    ]
  }
  ```

#### Logout
- **GET** `/rest/auth/logout`
- **Headers:** Requer autenticação
- **Resposta de Sucesso:**
  ```json
  { "success": true }
  ```

#### Informações da Sessão
- **GET** `/rest/auth/info`
- **Headers:** Requer autenticação
- **Resposta de Sucesso:**
  ```json
  { "success": true, "user": { /* informações do usuário */ } }
  ```

---

### 2. Dados (CRUD)

#### Buscar Registro por ID
- **GET** `/rest/data/:document/:dataId`
- **Parâmetros:**
  - `:document` — Nome do módulo (ex: `Contact`)
  - `:dataId` — ID do registro
- **Headers:** Requer autenticação
- **Resposta de Sucesso:**
  ```json
  { "success": true, "data": { /* campos do registro */ } }
  ```
- **Resposta de Falha:**
  ```json
  { "success": false, "errors": [ { "message": "Não encontrado" } ] }
  ```

#### Buscar Registros (find)
- **GET** `/rest/data/:document/find`
- **Parâmetros:**
  - `:document` — Nome do módulo (ex: `Contact`)

- **Query String:**
  - `filter` — Filtro em formato JSON, exemplo: `{ "match": "and", "conditions": [] }`
  - `start` — Índice inicial dos resultados (padrão: 0)
  - `limit` — Quantidade máxima de registros a retornar (padrão: 25)
  - `sort` — Ordenação em formato JSON, exemplo: `[ { "property": "code", "direction": "DESC" } ]`

- **Exemplo de uso:**
  ```http
  GET /rest/data/Contact/find?filter={"match":"and","conditions":[]}&start=0&limit=25&sort=[{"property":"code","direction":"DESC"}]
  ```

- **Headers:** Requer autenticação
- **Resposta de Sucesso:**
  ```json
  { "success": true, "data": [{ /* campos do registro */ }, { /* campos do registro */  }, ...] }
  ```
- **Resposta de Falha:**
  ```json
  { "success": false, "errors": [ { "message": "Não encontrado" } ] }
  ```

#### Criar Registro

🚧 Em construção

#### Atualizar Registros

🚧 Em construção

#### Deletar Registros

🚧 Em construção

---

### 3. Histórico

#### Listar Histórico

🚧 Em construção

---

### 4. Comentários

#### Listar Comentários

🚧 Em construção

#### Adicionar Comentário

🚧 Em construção

---

### 5. Upload de Arquivo

#### Enviar Arquivo

🚧 Em construção

#### Deletar Arquivo

🚧 Em construção

---

### 6. Busca por Endereços

#### Buscar por CEP

🚧 Em construção

#### Buscar por Cidades de Estado

🚧 Em construção

#### Buscar por Bairros de Cidade

🚧 Em construção

#### Buscar por Ruas

🚧 Em construção

---

## Tratamento de Erros

Todos os endpoints retornam um booleano `success`. Se `success` for `false`, um array `errors` é fornecido com mensagens de erro.

---


