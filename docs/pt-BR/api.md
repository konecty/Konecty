# Documentação da API Konecty

A Konecty oferece uma API RESTful para interação com sua plataforma. Esta documentação apresenta os principais métodos de autenticação e um conjunto representativo de endpoints para você começar.

## Autenticação

Todas as requisições que exigem autenticação devem incluir:

-   Um cabeçalho `Authorization` com um token válido:
    ```http
    Authorization: <token>
    ```
-   Ou um cookie chamado `_authTokenId` com o token de sessão:
    ```http
    Cookie: _authTokenId=<token>
    ```

Alguns endpoints (como login) não exigem autenticação.

---

## Visão Geral dos Endpoints

Abaixo está uma seleção dos principais endpoints. Para cada um, mostramos o método HTTP, URL, parâmetros e exemplos de respostas.

### 1. Autenticação

#### Login

-   **POST** `/rest/auth/login`
-   **Body:**
    ```json
    {
    	"user": "usuario@exemplo.com",
    	"password": "suaSenha"
    }
    ```
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"authId": "<token>",
    	"user": {
    		/* informações do usuário */
    	},
    	"cookieMaxAge": 2592000
    }
    ```
-   **Resposta de Falha:**
    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Credenciais inválidas" }]
    }
    ```

#### Logout

-   **GET** `/rest/auth/logout`
-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    { "success": true }
    ```

#### Informações da Sessão

-   **GET** `/rest/auth/info`
-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"user": {
    		/* informações do usuário */
    	}
    }
    ```

---

### 2. Dados (CRUD)

#### Buscar Registro por ID

-   **GET** `/rest/data/:document/:dataId`
-   **Parâmetros:**
    -   `:document` — Nome do módulo (ex: `Contact`)
    -   `:dataId` — ID do registro
-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"data": {
    		/* campos do registro */
    	}
    }
    ```
-   **Resposta de Falha:**
    ```json
    { "success": false, "errors": [{ "message": "Não encontrado" }] }
    ```

#### Buscar Registros (find)

-   **GET** `/rest/data/:document/find`
-   **Parâmetros:**

    -   `:document` — Nome do módulo (ex: `Contact`)

-   **Query String:**

    -   `filter` — Filtro em formato JSON, exemplo: `{ "match": "and", "conditions": [] }`
    -   `start` — Índice inicial dos resultados (padrão: 0)
    -   `limit` — Quantidade máxima de registros a retornar (padrão: 25)
    -   `sort` — Ordenação em formato JSON, exemplo: `[ { "property": "code", "direction": "DESC" } ]`

-   **Exemplo de uso:**

    ```http
    GET /rest/data/Contact/find?filter={"match":"and","conditions":[]}&start=0&limit=25&sort=[{"property":"code","direction":"DESC"}]
    ```

-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    { "success": true, "data": [{ /* campos do registro */ }, { /* campos do registro */  }, ...] }
    ```
-   **Resposta de Falha:**
    ```json
    { "success": false, "errors": [{ "message": "Não encontrado" }] }
    ```

#### Criar Registro

-   **POST** `/rest/data/:document`
-   **Parâmetros:**
    -   `:document` — Nome do módulo (ex: `Activity`)
-   **Body:**
    Objeto JSON com os campos do registro a ser criado.

    ```json
    {
    	"contact": [
    		{
    			"_id": "xmGSwsyD9ivv69Ndm",
    			"type": "Cliente"
    		}
    	],
    	"priority": "Baixa",
    	"status": "Nova",
    	"description": "",
    	"location": "",
    	"private": null,
    	"realEstateInterest": null,
    	"reason": "testes",
    	"subject": "testes",
    	"type": "Comentario"
    }
    ```

-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"data": [
    		{
    			"_id": "MznGugx9fPXY4fiKa",
    			"contact": [
    				{
    					"_id": "xmGSwsyD9ivv69Ndm",
    					"code": 1663376,
    					"name": {
    						"full": "Dev Teste"
    					}
    				}
    			],
    			"priority": "Baixa",
    			"status": "Nova",
    			"reason": "testes",
    			"subject": "testes",
    			"type": "Comentario",
    			"_user": [
    				{
    					/* dados do usuário */
    				}
    			],
    			"code": 2690731,
    			"_createdAt": "2025-07-02T10:45:43.745-03:00",
    			"_createdBy": {
    				/* dados do usuário */
    			},
    			"_updatedAt": "2025-07-02T10:45:43.745-03:00",
    			"_updatedBy": {
    				/* dados do usuário */
    			}
    		}
    	]
    }
    ```
-   **Resposta de Falha:**

    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Descrição do erro" }]
    }
    ```

    **Possíveis mensagens de erro:**

    -   Campo obrigatório ausente:
        ```json
        { "message": "O campo 'name' é obrigatório." }
        ```
    -   Valor já existente:
        ```json
        { "message": "Já existe um registro com este e-mail." }
        ```
    -   Não autorizado:
        ```json
        { "message": "Não autorizado." }
        ```
    -   Erro interno:
        ```json
        { "message": "Erro interno do servidor." }
        ```

#### Atualizar Registros

-   **PUT** `/rest/data/:document`
-   **Parâmetros:**
    -   `:document` — Nome do módulo (ex: `Activity`)
-   **Body:**
    Objeto JSON com os campos a serem atualizados.  
    **É obrigatório informar o identificador do registro (`_id`) e o campo (`_updatedAt`).**

    Exemplo:

    ```json
    {
    	"data": {
    		"reason": "update",
    		"subject": "assunto teste"
    	},
    	"ids": [
    		{
    			"_id": "MznGugx9fPXY4fiKa",
    			"_updatedAt": { "$date": "2025-07-02T13:45:43.745Z" }
    		}
    	]
    }
    ```

-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"data": [
    		{
    			"_id": "MznGugx9fPXY4fiKa",
    			"contact": [
    				{
    					"_id": "xmGSwsyD9ivv69Ndm",
    					"code": 1663376,
    					"name": {
    						"full": "Dev Test"
    					}
    				}
    			],
    			"priority": "Baixa",
    			"status": "Nova",
    			"reason": "update 2",
    			"subject": "assunto teste doc",
    			"type": "Comentario",
    			"_user": [
    				/* dados do usuário */
    			],
    			"code": 2690731,
    			"_createdAt": "2025-07-02T10:45:43.745-03:00",
    			"_createdBy": {
    				/* dados do usuário */
    			},
    			"_updatedAt": "2025-07-02T10:54:37.489-03:00",
    			"_updatedBy": {
    				/* dados do usuário */
    			}
    		}
    	]
    }
    ```
-   **Resposta de Falha:**

    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Descrição do erro" }]
    }
    ```

    **Possíveis mensagens de erro:**

        ```json
        { "message": "Registro não encontrado." }
        ```

    -   Campo "\_updatedAt" ausente ou desatualizado:
        ```json
        { "message": "[Activity] Record MznGugx9fPXY4fiKa is out of date, field reason was updated at 2025-07-02T10:45:43.755-03:00 by Admin" }
        ```
    -   Campo obrigatório ausente:
        ```json
        { "message": "O campo '_id' é obrigatório." }
        ```
    -   Não autorizado:
        ```json
        { "message": "Não autorizado." }
        ```
    -   Erro interno:
        ```json
        { "message": "Erro interno do servidor." }
        ```

#### Deletar Registros

-   **DELETE** `/rest/data/:document`
-   **Parâmetros:**
    -   `:document` — Nome do módulo (ex: `Activity`)
-   **Body:**
    Objeto JSON com o identificador do registro a ser deletado.  
     **É obrigatório informar o identificador do registro (`_id`).**  
     Exemplo:
    ```json
    {
    	"ids": [
    		{
    			"_id": "MznGugx9fPXY4fiKa",
    			"_updatedAt": { "$date": "2025-07-02T10:54:37.489-03:00" }
    		}
    	]
    }
    ```
-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"data": ["MznGugx9fPXY4fiKa"]
    }
    ```
-   **Resposta de Falha:**

    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Descrição do erro" }]
    }
    ```

    **Possíveis mensagens de erro:**

    -   Registro não encontrado:
        ```json
        { "message": "Registro não encontrado." }
        ```
    -   Campo obrigatório ausente:
        ```json
        { "message": "O campo '_id' é obrigatório." }
        ```
    -   Não autorizado:
        ```json
        { "message": "Não autorizado." }
        ```
    -   Erro interno:
        ```json
        { "message": "Erro interno do servidor." }
        ```

---

### 3. Histórico

#### Listar Histórico

-   **GET** `/rest/data/:document/:dataId/history`
-   **Parâmetros:**
    -   `:document` — Nome do módulo (ex: `Activity`)
    -   `:dataId` — ID do registro
-   **Query String:**
    -   `fields` — (opcional) Campos específicos do histórico a serem retornados
-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"data": [
    		{
    			"_id": "256315c3-ea1a-4458-afc2-6eae8129063a",
    			"dataId": "MznGugx9fPXY4fiKa",
    			"createdAt": "2025-07-02T13:45:43.755Z",
    			"createdBy": {
    				/* dados do usuário */
    			},
    			"type": "create",
    			"diffs": {
    				"_id": {},
    				"contact": {
    					"to": [
    						{
    							"_id": "xmGSwsyD9ivv69Ndm",
    							"code": 1663376,
    							"name": {
    								"full": "Dev Test"
    							}
    						}
    					]
    				},
    				"priority": {
    					"to": "Baixa"
    				},
    				"status": {
    					"to": "Nova"
    				},
    				"reason": {
    					"to": "testes"
    				},
    				"subject": {
    					"to": "testes"
    				},
    				"type": {
    					"to": "Comentario"
    				},
    				"_user": {
    					"to": [
    						{
    							/* dados do usuário */
    						}
    					]
    				},
    				"code": {
    					"to": 2690731
    				}
    			}
    		},
    		{
    			"_id": "9f709270-5ccc-4e2d-a614-bb1e19947718",
    			"dataId": "MznGugx9fPXY4fiKa",
    			"createdAt": "2025-07-02T13:49:47.537Z",
    			"createdBy": {
    				/* dados do usuário */
    			},
    			"type": "update",
    			"diffs": {
    				"_id": {},
    				"reason": {
    					"to": "update"
    				},
    				"subject": {
    					"to": "assunto teste"
    				}
    			}
    		},
    		{
    			"_id": "a7fa7ee7-4df9-423d-9225-85c9f644db7f",
    			"dataId": "MznGugx9fPXY4fiKa",
    			"createdAt": "2025-07-02T13:54:37.497Z",
    			"createdBy": {
    				/* dados do usuário */
    			},
    			"type": "update",
    			"diffs": {
    				"_id": {},
    				"reason": {
    					"to": "update 2"
    				},
    				"subject": {
    					"to": "assunto teste doc"
    				}
    			}
    		}
    	]
    }
    ```
-   **Resposta de Falha:**

    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Descrição do erro" }]
    }
    ```

    **Possíveis mensagens de erro:**

    -   Registro não encontrado:
        ```json
        { "message": "Registro não encontrado." }
        ```
    -   Não autorizado:
        ```json
        { "message": "Não autorizado." }
        ```
    -   Erro interno:
        ```json
        { "message": "Erro interno do servidor." }
        ```

---

### 4. Comentários

#### Listar Comentários

-   **GET** `/rest/comment/:document/:dataId`
-   **Parâmetros:**
    -   `:document` — Nome do módulo (ex: `Contact`)
    -   `:dataId` — ID do registro ao qual os comentários pertencem
-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"data": [
    		{
    			"_id": "334j4qGh4SqTMci4b",
    			"dataId": "hMyiED7RiXmw63S8v",
    			"_createdAt": "2025-07-02T14:16:49.724Z",
    			"_createdBy": {
    				/* dados do usuário */
    			},
    			"text": "test"
    		}
    	]
    }
    ```
-   **Resposta de Falha:**

    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Descrição do erro" }]
    }
    ```

    **Possíveis mensagens de erro:**

    -   Registro não encontrado:
        ```json
        { "message": "Registro não encontrado." }
        ```
    -   Não autorizado:
        ```json
        { "message": "Não autorizado." }
        ```
    -   Erro interno:
        ```json
        { "message": "Erro interno do servidor." }
        ```

#### Adicionar Comentário

-   **POST** `/rest/comment/:document/:dataId`
-   **Parâmetros:**
    -   `:document` — Nome do módulo (ex: `Contact`)
    -   `:dataId` — ID do registro ao qual o comentário será adicionado
-   **Body:**
    ```json
    {
    	"text": "Este é um novo comentário"
    }
    ```
-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"data": {
    		"_id": "commentId2",
    		"dataId": "hMyiED7RiXmw63S8v",
    		"text": "Este é um novo comentário",
    		"createdAt": "2024-06-07T12:34:56.000Z",
    		"createdBy": {
    			/* dados do usuário */
    		}
    		// ... outros campos
    	}
    }
    ```
-   **Resposta de Falha:**

    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Descrição do erro" }]
    }
    ```

    **Possíveis mensagens de erro:**

    -   Campo obrigatório ausente:
        ```json
        { "message": "O campo 'text' é obrigatório." }
        ```
    -   Registro não encontrado:
        ```json
        { "message": "Registro não encontrado." }
        ```
    -   Não autorizado:
        ```json
        { "message": "Não autorizado." }
        ```
    -   Erro interno:
        ```json
        { "message": "Erro interno do servidor." }
        ```

---

### 5. Upload de Arquivo

#### Enviar Arquivo

-   **POST** `/rest/file/upload/:namespace/:accessId/:document/:recordId/:fieldName`
-   **POST** `/rest/file/upload/:accessId/:document/:recordId/:fieldName`
-   **POST** `/rest/file/upload/:document/:recordId/:fieldName`
-   **Parâmetros:**
    -   `:namespace` — (opcional) Namespace de armazenamento (ex: `default`)
    -   `:accessId` — (opcional) ID de acesso/contexto
    -   `:document` — Nome do módulo (ex: `Contact`)
    -   `:recordId` — ID do registro ao qual o arquivo será associado
    -   `:fieldName` — Nome do campo de arquivo no módulo
-   **Headers:** Requer autenticação, `Content-Type: multipart/form-data`
-   **Body:**  
    Arquivo enviado via multipart/form-data no campo padrão de upload.
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"key": "Contact/abc123/avatar/abcdef123456.jpg",
    	"kind": "image/jpeg",
    	"size": 123456,
    	"name": "avatar.jpg",
    	"coreResponse": {
    		/* resposta do armazenamento */
    	},
    	"_id": "fileId123",
    	"_updatedAt": "2024-06-07T13:00:00.000Z"
    }
    ```
-   **Resposta de Falha:**

    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Descrição do erro" }]
    }
    ```

    **Possíveis mensagens de erro:**

    -   Nenhum arquivo enviado:
        ```json
        { "message": "[Contact] No file sent" }
        ```
    -   Permissão negada para upload:
        ```json
        { "message": "[Contact] You don't have permission to upload files" }
        ```
    -   Permissão negada para o campo:
        ```json
        { "message": "[Contact] You don't have permission to update field avatar" }
        ```
    -   Não autorizado:
        ```json
        { "message": "Não autorizado." }
        ```
    -   Erro interno:
        ```json
        { "message": "Erro interno do servidor." }
        ```

#### Deletar Arquivo

-   **DELETE** `/rest/file/delete/:namespace/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName`
-   **DELETE** `/rest/file/delete/:accessId/:metaDocumentId/:recordId/:fieldName/:fileName`
-   **DELETE** `/rest/file/delete/:metaDocumentId/:recordId/:fieldName/:fileName`
-   **Parâmetros:**
    -   `:namespace` — (opcional) Namespace de armazenamento (ex: `default`)
    -   `:accessId` — (opcional) ID de acesso/contexto
    -   `:metaDocumentId` — Nome do módulo (ex: `Contact`)
    -   `:recordId` — ID do registro ao qual o arquivo está associado
    -   `:fieldName` — Nome do campo de arquivo no módulo
    -   `:fileName` — Nome do arquivo a ser deletado
-   **Headers:** Requer autenticação
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true
    }
    ```
-   **Resposta de Falha:**

    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Descrição do erro" }]
    }
    ```

    **Possíveis mensagens de erro:**

    -   Arquivo não encontrado:
        ```json
        { "message": "Arquivo não encontrado." }
        ```
    -   Permissão negada para deletar:
        ```json
        { "message": "[Contact] You don't have permission read records" }
        ```
    -   Não autorizado:
        ```json
        { "message": "Não autorizado." }
        ```
    -   Erro interno:
        ```json
        { "message": "Erro interno do servidor." }
        ```

---

### 6. Busca por Endereços

#### Buscar por CEP

-   **GET** `/rest/dne/cep/:cep`
-   **Parâmetros:**
    -   `:cep` — CEP a ser consultado (apenas números)
-   **Headers:** Não requer autenticação
-   **Resposta de Sucesso:**
    Quando encontrado em logradouros (places):
    ```json
    [
    	{
    		"_id": "63c83a1a3e51ef46111c65a1",
    		"cityAbbr": "Ituverava",
    		"type": "M",
    		"status": "0",
    		"postalCode": "14500000",
    		"city": "Ituverava",
    		"state": "SP",
    		"id": 9262,
    		"__v": 0
    	}
    ]
    ```
    Quando encontrado apenas em cidades:
    ```json
    [
    	{
    		"postalCode": "14500000",
    		"city": "Ituverava",
    		"state": "SP"
    	}
    ]
    ```
-   **Resposta de Falha:**
    ```json
    []
    ```

#### Buscar por Cidades de Estado

-   **GET** `/rest/dne/BRA/:state/:city`
-   **Parâmetros:**
    -   `:state` — Sigla do estado (ex: SP)
    -   `:city` — Nome da cidade (ou \* para todas as cidades do estado)
-   **Headers:** Não requer autenticação
-   **Resposta de Sucesso:**
    ```json
    [
    	{
    		"_id": "63c83a1a3e51ef46111c661b",
    		"cityAbbr": "Adamantina",
    		"type": "M",
    		"status": "0",
    		"postalCode": "17800000",
    		"city": "Adamantina",
    		"state": "SP",
    		"id": 8853,
    		"__v": 0
    	},
    	{
    		"_id": "63c83a1a3e51ef46111c661c",
    		"cityAbbr": "Adolfo",
    		"type": "M",
    		"status": "0",
    		"postalCode": "15230000",
    		"city": "Adolfo",
    		"state": "SP",
    		"id": 8854,
    		"__v": 0
    	}
    ]
    ```
-   **Resposta de Falha:**
    ```json
    []
    ```

#### Buscar por Bairros de Cidade

-   **GET** `/rest/dne/BRA/:state/:city/:district`
-   **Parâmetros:**
    -   `:state` — Sigla do estado (ex: SP)
    -   `:city` — Nome da cidade
    -   `:district` — Nome do bairro (ou \* para todos os bairros da cidade)
-   **Headers:** Não requer autenticação
-   **Resposta de Sucesso:**
    ```json
    [
    	{
    		"_id": "63c83a9f3e51ef46111cf4e9",
    		"districtAbbr": "A C Ind Empresarial/Alphaville.",
    		"district": "Alphaville Centro Industrial e Empresarial/Alphaville.",
    		"cityAbbr": "Barueri",
    		"city": "Barueri",
    		"state": "SP",
    		"id": 63354,
    		"__v": 0
    	},
    	{
    		"_id": "63c83ae03e51ef46111d470c",
    		"districtAbbr": "A C Apoio I",
    		"district": "Alphaville Centro de Apoio I",
    		"cityAbbr": "Barueri",
    		"city": "Barueri",
    		"state": "SP",
    		"id": 15331,
    		"__v": 0
    	}
    ]
    ```
-   **Resposta de Falha:**
    ```json
    []
    ```

#### Buscar por Ruas

-   **GET** `/rest/dne/BRA/:state/:city/:district/:place`
-   **Parâmetros:**
    -   `:state` — Sigla do estado (ex: SP)
    -   `:city` — Nome da cidade
    -   `:district` — Nome do bairro
    -   `:place` — Nome da rua/logradouro (ou \* para todos)
-   **Headers:** Não requer autenticação
-   **Resposta de Sucesso:**
    ```json
    [
    	{
    		"district": "Centro",
    		"postalCode": "12345678",
    		"placeType": "Rua",
    		"init": 1,
    		"end": 999,
    		"city": "São Paulo",
    		"state": "SP",
    		"place": "Rua Exemplo"
    	},
    	{
    		"district": "Jardins",
    		"postalCode": "87654321",
    		"placeType": "Avenida",
    		"init": 100,
    		"end": 200,
    		"city": "São Paulo",
    		"state": "SP",
    		"place": "Avenida Exemplo"
    	}
    ]
    ```
-   **Resposta de Falha:**
    ```json
    []
    ```

---

## Tratamento de Erros

Todos os endpoints retornam um booleano `success`. Se `success` for `false`, um array `errors` é fornecido com mensagens de erro.

---
