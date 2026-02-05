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

#### Solicitar OTP

-   **POST** `/api/auth/request-otp`
-   **Body:** (exatamente um de `phoneNumber` ou `email` deve ser fornecido)
    ```json
    {
    	"phoneNumber": "+5511999999999",
    	"geolocation": {
    		"longitude": -46.633309,
    		"latitude": -23.550520
    	},
    	"resolution": {
    		"width": 1920,
    		"height": 1080
    	},
    	"source": "mobile-app",
    	"fingerprint": "device-fingerprint-hash"
    }
    ```
    ou
    ```json
    {
    	"email": "usuario@exemplo.com",
    	"geolocation": {
    		"longitude": -46.633309,
    		"latitude": -23.550520
    	},
    	"resolution": {
    		"width": 1920,
    		"height": 1080
    	},
    	"source": "web",
    	"fingerprint": "device-fingerprint-hash"
    }
    ```
    **Campos Opcionais** (mesmos do login tradicional):
    - `geolocation`: Objeto com `longitude` e `latitude` números, ou string JSON
    - `resolution`: Objeto com `width` e `height` números, ou string JSON
    - `source`: String (ex: 'mobile-app', 'web')
    - `fingerprint`: String (hash de fingerprint do dispositivo)
    
    Estes campos são registrados no AccessFailedLog para auditoria e segurança.
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"message": "OTP sent via whatsapp"
    }
    ```
-   **Resposta de Falha:**
    ```json
    {
    	"success": false,
    	"errors": [{ "message": "User not found for this phone number" }]
    }
    ```
-   **Rate Limit:** 429 Too Many Requests se mais de 5 requisições por minuto por telefone/email

#### Verificar OTP

-   **POST** `/api/auth/verify-otp`
-   **Body:** (exatamente um de `phoneNumber` ou `email` deve ser fornecido)
    ```json
    {
    	"phoneNumber": "+5511999999999",
    	"otpCode": "123456",
    	"geolocation": {
    		"longitude": -46.633309,
    		"latitude": -23.550520
    	},
    	"resolution": {
    		"width": 1920,
    		"height": 1080
    	},
    	"source": "mobile-app",
    	"fingerprint": "device-fingerprint-hash"
    }
    ```
    ou
    ```json
    {
    	"email": "usuario@exemplo.com",
    	"otpCode": "123456",
    	"geolocation": {
    		"longitude": -46.633309,
    		"latitude": -23.550520
    	},
    	"resolution": {
    		"width": 1920,
    		"height": 1080
    	},
    	"source": "web",
    	"fingerprint": "device-fingerprint-hash"
    }
    ```
    **Campos Opcionais** (mesmos do login tradicional):
    - `geolocation`: Objeto com `longitude` e `latitude` números, ou string JSON
    - `resolution`: Objeto com `width` e `height` números, ou string JSON
    - `source`: String (ex: 'mobile-app', 'web')
    - `fingerprint`: String (hash de fingerprint do dispositivo)
    
    Estes campos são registrados no AccessLog para auditoria e segurança.
-   **Resposta de Sucesso:**
    ```json
    {
    	"success": true,
    	"logged": true,
    	"authId": "<token>",
    	"user": {
    		/* informações do usuário */
    	}
    }
    ```
-   **Resposta de Falha:**
    ```json
    {
    	"success": false,
    	"errors": [{ "message": "Invalid OTP code" }]
    }
    ```
-   **Notas:**
    - Código OTP tem 6 dígitos
    - OTP expira após tempo configurável (padrão: 5 minutos)
    - Máximo de 3 tentativas de verificação antes do OTP ser invalidado
    - Método de entrega:
      - Se solicitado por telefone: WhatsApp → RabbitMQ (sem fallback para email)
      - Se solicitado por email: Apenas email (não tenta WhatsApp)

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

#### Buscar Registros com Streaming (findStream)

-   **GET** `/rest/stream/:document/findStream`

-   **Parâmetros:**

    -   `:document` — Nome do módulo (ex: `Opportunity`, `Contact`)

-   **Query String:**

    -   `filter` — Filtro em formato JSON, exemplo: `{ "status": { "$in": ["Nova", "Em Visitação"] } }`
    -   `start` — Índice inicial dos resultados (padrão: 0)
    -   `limit` — Quantidade máxima de registros a retornar (padrão: 50)
    -   `sort` — Ordenação em formato JSON, exemplo: `[ { "property": "code", "direction": "ASC" } ]`
    -   `fields` — Campos a serem retornados, separados por vírgula (opcional)
    -   `displayName` — Nome do display a ser usado (opcional)
    -   `displayType` — Tipo do display a ser usado (opcional)
    -   `withDetailFields` — Se deve incluir campos detalhados (opcional)

-   **Exemplo de uso:**

    ```http
    GET /rest/stream/Opportunity/findStream?filter={"status":{"$in":["Nova","Em Visitação"]}}&limit=100&sort=[{"property":"_id","direction":"ASC"}]
    ```

-   **Headers:** Requer autenticação

-   **Resposta de Sucesso:**

    O endpoint retorna um stream HTTP com dados em formato **newline-delimited JSON** (NDJSON). Cada linha é um registro JSON completo.

    ```
    {"_id":"001","name":"Registro 1","status":"Nova","createdAt":"2024-01-01T00:00:00.000Z"}
    {"_id":"002","name":"Registro 2","status":"Em Visitação","createdAt":"2024-01-02T00:00:00.000Z"}
    {"_id":"003","name":"Registro 3","status":"Nova","createdAt":"2024-01-03T00:00:00.000Z"}
    ```

    **Características do Stream:**

    -   **Content-Type**: `application/json`
    -   **Transfer-Encoding**: `chunked`
    -   **Formato**: Newline-delimited JSON (um registro por linha)
    -   **Processamento**: Registros são enviados incrementalmente, sem acumular em memória

-   **Resposta de Falha:**

    ```json
    { "success": false, "errors": [{ "message": "Erro ao processar requisição" }] }
    ```

-   **Vantagens sobre `/rest/data/:document/find`:**

    -   **Memória**: Redução de 68% no uso de memória do servidor
    -   **TTFB**: 99.3% mais rápido (cliente recebe dados imediatamente)
    -   **Throughput**: 81.8% melhor (mais registros processados por segundo)
    -   **Escalabilidade**: Suporta volumes muito maiores (50k+ registros) sem impacto na memória

-   **Quando usar:**

    -   Grandes volumes de dados (1000+ registros)
    -   Quando o cliente precisa processar dados incrementalmente
    -   Quando TTFB baixo é crítico
    -   Quando há limitações de memória no servidor

-   **Exemplo de processamento no cliente (JavaScript):**

    ```javascript
    const response = await fetch('/rest/stream/Opportunity/findStream?filter={...}&limit=1000', {
    	headers: { Cookie: `_authTokenId=${token}` },
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
    	const { done, value } = await reader.read();
    	if (done) break;

    	buffer += decoder.decode(value, { stream: true });
    	const lines = buffer.split('\n');
    	buffer = lines.pop() || ''; // Mantém linha incompleta no buffer

    	for (const line of lines) {
    		if (line.trim()) {
    			const record = JSON.parse(line);
    			// Processar registro individual
    			console.log('Registro recebido:', record);
    		}
    	}
    }
    ```

-   **Notas importantes:**

    -   Ordenação padrão: Se não especificado, aplica `{ _id: 1 }` para garantir consistência
    -   Permissões: Aplicadas registro por registro, mantendo segurança
    -   Datas: Convertidas automaticamente para strings ISO 8601

#### Gerar Tabela Dinâmica (Pivot)

-   **GET** `/rest/data/:document/pivot`

-   **Parâmetros:**

    -   `:document` — Nome do módulo (ex: `Opportunity`, `Contact`)

-   **Query String:**

    -   Todos os parâmetros do endpoint `find` (filter, sort, limit, start, fields, displayName, displayType, withDetailFields)
    -   `pivotConfig` — Configuração da tabela dinâmica em formato JSON (obrigatório)

-   **Formato do `pivotConfig`:**

    ```typescript
    {
      columns?: Array<{
        field: string;
        order?: 'ASC' | 'DESC';
        format?: string;
        aggregator?: 'D' | 'W' | 'M' | 'Q' | 'Y'; // Agregação de data (D=dia, W=semana, M=mês, Q=trimestre, Y=ano)
      }>;
      rows: Array<{
        field: string;
        order?: 'ASC' | 'DESC';
        showSubtotal?: boolean;
      }>;
      values: Array<{
        field: string;
        aggregator: 'count' | 'sum' | 'avg' | 'min' | 'max';
        format?: string; // Formato de exibição (ex: 'currency', 'percentage')
      }>;
      options?: {
        showRowGrandTotals?: boolean;
        showColGrandTotals?: boolean;
        showSubtotals?: boolean;
      };
    }
    ```

-   **Exemplo de uso:**

    ```http
    GET /rest/data/Opportunity/pivot?filter={"status":{"$in":["Nova","Em Visitação"]}}&pivotConfig={"rows":[{"field":"status"}],"columns":[{"field":"type"}],"values":[{"field":"value","aggregator":"sum"}]}
    ```

-   **Headers:** Requer autenticação

-   **Resposta de Sucesso:**

    O endpoint retorna uma resposta JSON síncrona com dados hierárquicos da tabela dinâmica, metadados enriquecidos e totais calculados.

    ```json
    {
      "success": true,
      "metadata": {
        "rows": [
          {
            "field": "status",
            "label": "Situação",
            "type": "picklist",
            "level": 0
          }
        ],
        "columns": [
          {
            "field": "type",
            "label": "Tipo",
            "type": "picklist",
            "values": [
              { "key": "Residencial", "label": "Residencial" },
              { "key": "Comercial", "label": "Comercial" }
            ]
          }
        ],
        "values": [
          {
            "field": "value",
            "aggregator": "sum",
            "label": "Valor",
            "type": "money",
            "format": "currency"
          }
        ]
      },
      "data": [
        {
          "key": "Nova",
          "label": "Nova",
          "level": 0,
          "cells": {
            "Residencial": { "value": 150000 },
            "Comercial": { "value": 200000 }
          },
          "totals": { "value": 350000 },
          "children": []
        },
        {
          "key": "Em Visitação",
          "label": "Em Visitação",
          "level": 0,
          "cells": {
            "Residencial": { "value": 300000 },
            "Comercial": { "value": 250000 }
          },
          "totals": { "value": 550000 },
          "children": []
        }
      ],
      "grandTotals": {
        "cells": {
          "Residencial": { "value": 450000 },
          "Comercial": { "value": 450000 }
        },
        "totals": { "value": 900000 }
      },
      "columnHeaders": [
        {
          "key": "Residencial",
          "value": "Residencial",
          "label": "Residencial",
          "level": 0
        },
        {
          "key": "Comercial",
          "value": "Comercial",
          "label": "Comercial",
          "level": 0
        }
      ],
      "total": 2
    }
    ```

    **Estrutura da Resposta:**
    - `metadata`: Configuração enriquecida com labels, tipos e informações dos campos
    - `data`: Array hierárquico de linhas do pivot com `children` aninhados para hierarquias multi-nível
    - `grandTotals`: Totais agregados de todos os dados
    - `columnHeaders`: Array hierárquico de nós de cabeçalho de coluna (similar à estrutura ExtJS mz-pivot axisTop)
    - Cada linha contém:
      - `key`: Identificador único da linha
      - `label`: Label formatado para exibição (pode incluir formatação de lookup como "Nome (Ativo)")
      - `level`: Profundidade da hierarquia (0 = nível raiz)
      - `cells`: Objeto mapeando chaves de coluna para valores agregados
      - `totals`: Subtotais do nível da linha
      - `children`: Linhas aninhadas para estruturas hierárquicas
    - Cada cabeçalho de coluna contém:
      - `key`: Caminho completo da chave (ex: "27" ou "27|Cancelada" para colunas multi-nível)
      - `value`: Valor neste nível (ex: "27" ou "Cancelada")
      - `label`: Label de exibição (formatado de acordo com o tipo do campo)
      - `level`: Nível de profundidade (0 = primeira dimensão de coluna)
      - `expanded`: Se os filhos estão visíveis (opcional)
      - `children`: Sub-colunas para hierarquias de colunas multi-nível (opcional)

-   **Resposta de Falha:**

    ```json
    {
      "success": false,
      "errors": [
        {
          "message": "[Opportunity] pivotConfig.rows is required and must be a non-empty array"
        }
      ]
    }
    ```

-   **Características:**

    -   **Processamento interno**: Utiliza streaming interno para eficiência, mas retorna resposta JSON síncrona
    -   **Processamento Python**: Utiliza Polars para geração da tabela dinâmica
    -   **Performance**: Otimizado para grandes volumes de dados
    -   **Permissões**: Aplicadas automaticamente conforme configuração do usuário
    -   **Estrutura hierárquica**: Linhas multi-nível criam arrays `children` aninhados
    -   **Formatação de lookup**: Campos de lookup sem sub-campos são formatados usando `descriptionFields` (ex: "Nome (Ativo)")
    -   **Labels de campos aninhados**: Labels para campos aninhados são concatenados (ex: "Grupo > Nome" para `_user.group.name`)
    -   **Subtotais**: Cada nível da hierarquia inclui `totals` para aquele nível
    -   **Totais gerais**: `grandTotals` no nível raiz contém agregados de todos os dados
    -   **Cabeçalhos de coluna**: Estrutura hierárquica para colunas multi-nível (ex: buckets de data com status)
    -   **Multilíngue**: Labels respeitam header `Accept-Language` (padrão: `pt_BR`)
    -   **Limite de registros**: Limite padrão de 100.000 registros (configurável via variável de ambiente `PIVOT_MAX_RECORDS`). Se o limite for atingido, a resposta inclui `limitInfo`:
      ```json
      {
        "limitInfo": {
          "limited": true,
          "limit": 100000,
          "total": 150000
        }
      }
      ```

-   **Exemplo completo de `pivotConfig`:**

    ```json
    {
      "rows": [
        { "field": "status" },
        { "field": "priority", "order": "DESC" }
      ],
      "columns": [
        { "field": "type" }
      ],
      "values": [
        { "field": "value", "aggregator": "sum" },
        { "field": "_id", "aggregator": "count" }
      ]
    }
    ```

-   **Exemplo de Colunas Multi-nível (Buckets de Data com Status):**

    Para colunas multi-nível, os `columnHeaders` serão hierárquicos:

    ```json
    {
      "columns": [
        { "field": "createdAt", "aggregator": "M" },
        { "field": "status" }
      ]
    }
    ```

    Isso cria uma estrutura hierárquica de colunas onde:
    - Nível 0: Valores de mês (ex: "2024-01", "2024-02")
    - Nível 1: Valores de status sob cada mês (ex: "Nova", "Em Andamento")
    - Chaves de coluna usam separador `|`: `"2024-01|Nova"` para lookup de células

-   **Notas importantes:**

    -   `rows` é obrigatório e deve conter pelo menos um campo
    -   `values` é obrigatório e deve conter pelo menos um campo
    -   `columns` é opcional
    -   O processamento é feito internamente com streaming, mas a resposta é JSON síncrona
    -   Requer `uv` instalado no servidor (já incluído na imagem Docker)
    -   Total: O total de registros pode ser calculado em paralelo (não bloqueia o stream)

#### Gerar Gráfico

-   **GET** `/rest/data/:document/graph`
-   **Parâmetros:**
    -   `:document` — Nome do módulo (ex: `Opportunity`)
    -   Query parameters (opcionais): `filter`, `sort`, `limit`, `start`, `fields`, `displayName`, `displayType`, `withDetailFields` (mesmos do endpoint `find`)
    -   `graphConfig` (obrigatório) — Configuração do gráfico em formato JSON
-   **Resposta:**
    -   **Sucesso:** `200 OK` com `Content-Type: image/svg+xml` e corpo SVG
    -   **Erro:** `400 Bad Request` com JSON de erro
-   **Características:**
    -   **Processamento interno**: Utiliza streaming interno para eficiência
    -   **Processamento Python**: Utiliza Polars para agregações (performance) e pandas/matplotlib para visualização
    -   **Performance**: Polars é 3-10x mais rápido que Pandas para groupby/agregações
    -   **Permissões**: Aplicadas automaticamente conforme configuração do usuário
    -   **Formato SVG**: Retorna SVG diretamente como resposta HTTP (escalável, sem perda de qualidade)
    -   **Tipos suportados**: bar, line, pie, scatter, histogram, timeSeries
-   **Estrutura de `graphConfig`:**
    ```typescript
    {
      type: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram' | 'timeSeries';
      xAxis?: {
        field: string;      // Campo para eixo X
        label?: string;     // Label customizado
        format?: string;    // Formato de valores
      };
      yAxis?: {
        field: string;      // Campo para eixo Y
        label?: string;     // Label customizado
        format?: string;    // Formato de valores
      };
      categoryField?: string;  // Campo para agrupar (ex: status, type)
      aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';  // Tipo de agregação
      title?: string;       // Título do gráfico
      width?: number;       // Largura em pixels (padrão: 800)
      height?: number;      // Altura em pixels (padrão: 600)
      colors?: string[];    // Cores customizadas
      showLegend?: boolean; // Mostrar legenda (padrão: true)
      showGrid?: boolean;   // Mostrar grade (padrão: true)
    }
    ```
-   **Exemplos de uso:**
    -   **Gráfico de barras por status (contagem):**
        ```json
        {
          "type": "bar",
          "categoryField": "status",
          "aggregation": "count",
          "xAxis": { "field": "status", "label": "Status" },
          "yAxis": { "field": "code", "label": "Quantidade" },
          "title": "Oportunidades por Status"
        }
        ```
    -   **Gráfico de barras por status (soma de valores):**
        ```json
        {
          "type": "bar",
          "categoryField": "status",
          "aggregation": "sum",
          "xAxis": { "field": "status", "label": "Status" },
          "yAxis": { "field": "amount.value", "label": "Valor Total" },
          "title": "Valor Total por Status"
        }
        ```
    -   **Gráfico de barras por diretor:**
        ```json
        {
          "type": "bar",
          "categoryField": "_user.director.nickname",
          "aggregation": "count",
          "xAxis": { "field": "_user.director.nickname", "label": "Diretor" },
          "yAxis": { "field": "code", "label": "Quantidade" },
          "title": "Oportunidades por Diretor"
        }
        ```
    -   **Gráfico de pizza:**
        ```json
        {
          "type": "pie",
          "categoryField": "status",
          "aggregation": "count",
          "yAxis": { "field": "code" },
          "title": "Distribuição por Status"
        }
        ```
-   **Notas importantes:**
    -   `type` é obrigatório
    -   Para gráficos `bar`, `line`, `scatter`, `timeSeries`: `xAxis.field` e `yAxis.field` são obrigatórios
    -   Para gráficos `histogram`: `yAxis.field` é obrigatório
    -   Para gráficos `pie`: `categoryField` é obrigatório
    -   Quando `categoryField` e `aggregation` são especificados, os dados são agrupados e agregados usando Polars (mais rápido)
    -   O processamento é feito internamente com streaming, mas a resposta é SVG síncrona
    -   Requer `uv`, `polars`, `pandas`, `matplotlib` e `pyarrow` instalados (já incluídos na imagem Docker)
    -   Total: O total de registros pode ser calculado em paralelo (não bloqueia o stream)

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

## Coleção Postman

Uma coleção Postman está disponível para testar os endpoints da API Konecty, incluindo autenticação OTP.

### Importando a Coleção

1. **Baixe os arquivos:**
   - Arquivo da coleção: [`docs/postman/Konecty-API.postman_collection.json`](../postman/Konecty-API.postman_collection.json)
   - Arquivo de ambiente: [`docs/postman/Konecty-API.postman_environment.json`](../postman/Konecty-API.postman_environment.json)

2. **Importe no Postman:**
   - Abra o Postman
   - Clique no botão **Import**
   - Selecione ambos os arquivos (coleção e ambiente)
   - Ou arraste e solte os arquivos no Postman

3. **Configure o Ambiente:**
   - Selecione o ambiente importado "Konecty Local Development"
   - Atualize `baseUrl` se seu servidor estiver rodando em um host/porta diferente
   - Defina `authToken` após autenticação bem-sucedida (para endpoints autenticados)

### Estrutura da Coleção

A coleção inclui:

- **Autenticação**
  - Login (usuário/senha tradicional)
  - **Autenticação OTP**
    - Solicitar OTP - Telefone (com exemplos para WhatsApp, fallback de Email, erros)
    - Solicitar OTP - Email
    - Verificar OTP - Telefone (com exemplos para sucesso, código inválido, expirado, tentativas máximas)
    - Verificar OTP - Email

### Usando a Coleção

#### Testando o Fluxo de Autenticação OTP

1. **Solicitar OTP:**
   - Use "Request OTP - Phone" ou "Request OTP - Email"
   - Atualize o `phoneNumber` ou `email` no corpo da requisição
   - Envie a requisição
   - Verifique a resposta para o método de entrega (whatsapp, email, etc.)

2. **Verificar OTP:**
   - Verifique seu telefone/email para o código OTP de 6 dígitos
   - Use "Verify OTP - Phone" ou "Verify OTP - Email"
   - Digite o código OTP recebido no campo `otpCode`
   - Envie a requisição
   - Em caso de sucesso, salve o token `authId` na variável de ambiente `authToken`

3. **Usar Endpoints Autenticados:**
   - O `authToken` pode ser usado em requisições subsequentes
   - Adicione-o como cabeçalho `Authorization`: `Authorization: {{authToken}}`

### Exemplos

#### Exemplo 1: Autenticação OTP via Telefone

```http
POST /api/auth/request-otp
Content-Type: application/json

{
  "phoneNumber": "+5511999999999"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "OTP sent via whatsapp"
}
```

Depois verifique:
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+5511999999999",
  "otpCode": "123456"
}
```

#### Exemplo 2: Autenticação OTP via Email

```http
POST /api/auth/request-otp
Content-Type: application/json

{
  "email": "usuario@exemplo.com"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "OTP sent via email"
}
```

Depois verifique:
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "usuario@exemplo.com",
  "otpCode": "123456"
}
```

### Variáveis da Coleção

- `baseUrl`: URL base para requisições da API (padrão: `http://localhost:3000`)
- `authToken`: Token de autenticação (definido após login/verificação OTP bem-sucedida)

### Exemplos de Resposta

A coleção inclui múltiplos exemplos de resposta para cada endpoint:
- Cenários de sucesso
- Cenários de erro (usuário não encontrado, formato inválido, limite de taxa, OTP expirado, etc.)
- Diferentes métodos de entrega (WhatsApp, RabbitMQ, Email)

Esses exemplos ajudam a entender as respostas esperadas e o tratamento de erros.

---
