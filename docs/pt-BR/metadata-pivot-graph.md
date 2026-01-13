# Configuração de Gráficos em Pivot Tables

## Visão Geral

Pivot tables podem incluir configurações de gráficos padrão que são automaticamente disponibilizadas quando o usuário alterna para visualização de gráfico. Esta funcionalidade permite que desenvolvedores pré-configurem visualizações gráficas úteis diretamente no metadata, proporcionando uma experiência rica aos usuários sem necessidade de configuração manual.

## Estrutura

A seção `graph` (singular) é um objeto único de configuração de gráfico dentro do metadata de pivot. Apenas **um** gráfico pré-configurado é suportado por pivot.

### Estrutura JSON Base

```json
{
  "_id": "Document:pivot:ViewName",
  "type": "pivot",
  "rows": [...],
  "columns": {...},
  "values": [...],
  "graph": {
    "type": "bar|line|pie|scatter|histogram|timeSeries",
    "xAxis": {
      "field": "...",
      "bucket": "year|quarter|month|week|day|hour"
    },
    "yAxis": {
      "field": "..."
    },
    "categoryField": "...",
    "aggregation": "count|sum|avg|min|max",
    "series": [...],
    "title": {
      "en": "...",
      "pt_BR": "..."
    },
    "showLegend": true,
    "showGrid": true,
    "width": 800,
    "height": 600
  }
}
```

**Nota Importante**: Labels dos campos (`yAxis.label`, `xAxis.label`, etc.) são enriquecidos automaticamente pelo backend usando `graphMetadata.ts`. Por isso, não é necessário especificá-los no JSON - o backend irá buscar as traduções do metadata do documento.

## Tipos de Gráficos

### 1. Bar Chart (Gráfico de Barras)

**Uso**: Comparar valores entre categorias discretas.

**Campos Requeridos**:
- `type: "bar"`
- `xAxis.field`: Campo categórico (eixo X)
- `yAxis.field` + `aggregation` OU `series`: Valores numéricos (eixo Y)

**Exemplo**: Atividades por usuário

```json
{
  "graph": {
    "type": "bar",
    "xAxis": {
      "field": "_user"
    },
    "yAxis": {
      "field": "code"
    },
    "aggregation": "count",
    "title": {
      "en": "Activities by User",
      "pt_BR": "Atividades por Usuário"
    },
    "showLegend": true,
    "showGrid": true
  }
}
```

**Exemplo com múltiplas séries**:

```json
{
  "graph": {
    "type": "bar",
    "xAxis": {
      "field": "_user"
    },
    "series": [
      {
        "field": "value",
        "aggregation": "sum"
      },
      {
        "field": "code",
        "aggregation": "count"
      }
    ],
    "title": {
      "en": "Activities Summary by User",
      "pt_BR": "Resumo de Atividades por Usuário"
    },
    "showLegend": true,
    "showGrid": true
  }
}
```

### 2. Pie Chart (Gráfico de Pizza)

**Uso**: Mostrar proporções de um todo, distribuição percentual.

**Campos Requeridos**:
- `type: "pie"`
- `categoryField`: Campo para categorias (fatias)
- `yAxis.field`: Campo para valores
- `aggregation`: Como agregar os valores

**Exemplo**: Distribuição de atividades por status

```json
{
  "graph": {
    "type": "pie",
    "categoryField": "status",
    "yAxis": {
      "field": "code"
    },
    "aggregation": "count",
    "title": {
      "en": "Activities by Status",
      "pt_BR": "Atividades por Situação"
    },
    "showLegend": true,
    "showGrid": false
  }
}
```

### 3. Line Chart (Gráfico de Linha)

**Uso**: Mostrar tendências ao longo do tempo ou sequências ordenadas.

**Campos Requeridos**:
- `type: "line"`
- `xAxis.field`: Campo temporal ou sequencial
- `xAxis.bucket` (opcional): Agregação temporal (year, quarter, month, week, day, hour)
- `yAxis.field` + `aggregation` OU `series`: Valores

**Exemplo**: Vendas ao longo dos meses

```json
{
  "graph": {
    "type": "line",
    "xAxis": {
      "field": "_createdAt",
      "bucket": "month"
    },
    "yAxis": {
      "field": "value"
    },
    "aggregation": "sum",
    "title": {
      "en": "Sales Over Time",
      "pt_BR": "Vendas ao Longo do Tempo"
    },
    "showLegend": true,
    "showGrid": true
  }
}
```

**Exemplo com múltiplas séries temporais**:

```json
{
  "graph": {
    "type": "line",
    "xAxis": {
      "field": "_createdAt",
      "bucket": "month"
    },
    "series": [
      {
        "field": "value",
        "aggregation": "sum",
        "color": "#3b82f6"
      },
      {
        "field": "cost",
        "aggregation": "sum",
        "color": "#ef4444"
      }
    ],
    "title": {
      "en": "Revenue vs Cost",
      "pt_BR": "Receita vs Custo"
    },
    "showLegend": true,
    "showGrid": true
  }
}
```

### 4. Scatter Plot (Gráfico de Dispersão)

**Uso**: Visualizar correlação entre duas variáveis numéricas.

**Campos Requeridos**:
- `type: "scatter"`
- `xAxis.field`: Variável numérica X
- `yAxis.field`: Variável numérica Y
- `categoryField` (opcional): Campo para categorizar pontos por cor

**Exemplo**: Relação entre valor e desconto

```json
{
  "graph": {
    "type": "scatter",
    "xAxis": {
      "field": "value"
    },
    "yAxis": {
      "field": "discount"
    },
    "categoryField": "status",
    "title": {
      "en": "Value vs Discount",
      "pt_BR": "Valor vs Desconto"
    },
    "showLegend": true,
    "showGrid": true
  }
}
```

### 5. Histogram (Histograma)

**Uso**: Distribuição de frequência de valores numéricos em intervalos (bins).

**Campos Requeridos**:
- `type: "histogram"`
- `yAxis.field`: Campo numérico
- `histogram.binWidth` OU `histogram.binCount`: Configuração de bins

**Exemplo**: Distribuição de valores de venda

```json
{
  "graph": {
    "type": "histogram",
    "yAxis": {
      "field": "value"
    },
    "histogram": {
      "binCount": 20,
      "underflow": true,
      "overflow": true
    },
    "title": {
      "en": "Sales Value Distribution",
      "pt_BR": "Distribuição de Valores de Venda"
    },
    "showLegend": false,
    "showGrid": true
  }
}
```

### 6. Time Series (Série Temporal)

**Uso**: Gráfico de linha especializado para dados temporais contínuos.

**Campos Requeridos**:
- `type: "timeSeries"`
- `xAxis.field`: Campo de data/hora
- `xAxis.bucket`: Agregação temporal
- `series` ou `yAxis.field`: Valores ao longo do tempo

**Exemplo**: Atividades criadas por dia

```json
{
  "graph": {
    "type": "timeSeries",
    "xAxis": {
      "field": "_createdAt",
      "bucket": "day"
    },
    "yAxis": {
      "field": "code"
    },
    "aggregation": "count",
    "title": {
      "en": "Activities Created Daily",
      "pt_BR": "Atividades Criadas por Dia"
    },
    "showLegend": false,
    "showGrid": true
  }
}
```

## Mapeamento de Campos

O mapeamento entre a estrutura da pivot table e o gráfico geralmente segue estas convenções:

| Pivot Field | Graph Field | Uso |
|-------------|-------------|-----|
| `rows[0]` | `xAxis.field` ou `categoryField` | Agrupamento principal no eixo X ou categorias |
| `columns` | `categoryField` | Agrupamento secundário (categorização) |
| `values` | `yAxis.field` + `aggregation` ou `series` | Valores a serem plotados |

### Exemplo de Mapeamento Completo

Pivot com esta estrutura:
- **Rows**: `_user` (usuário)
- **Columns**: `status` (situação)
- **Values**: `code` (contador de atividades)

Pode ser mapeada para um gráfico de barras:

```json
{
  "graph": {
    "type": "bar",
    "xAxis": {
      "field": "_user"
    },
    "categoryField": "status",
    "yAxis": {
      "field": "code"
    },
    "aggregation": "count",
    "title": {
      "en": "Activities by User and Status",
      "pt_BR": "Atividades por Usuário e Situação"
    },
    "showLegend": true,
    "showGrid": true
  }
}
```

## Campos de Configuração

### Campos Obrigatórios

- `type`: Tipo do gráfico (bar, line, pie, scatter, histogram, timeSeries)

### Campos do Eixo X (`xAxis`)

- `field`: Nome do campo no documento
- `label`: (Opcional) Label customizado - se não fornecido, será buscado do metadata
- `bucket`: (Opcional) Para campos de data: year, quarter, month, week, day, hour
- `format`: (Opcional) Formato de exibição

### Campos do Eixo Y (`yAxis`)

- `field`: Nome do campo no documento
- `label`: (Opcional) Label customizado - se não fornecido, será buscado do metadata
- `format`: (Opcional) Formato de exibição (ex: "0,0.00" para números)

### Campo de Categoria (`categoryField`)

Campo para agrupamento secundário ou categorização de dados. Útil para:
- Gráficos de pizza: define as fatias
- Gráficos de barras/linha: cria múltiplas séries
- Scatter plots: categoriza pontos por cor

### Agregação (`aggregation`)

Define como os valores são agregados. Opções:
- `count`: Contagem de registros
- `sum`: Soma dos valores
- `avg`: Média dos valores
- `min`: Valor mínimo
- `max`: Valor máximo

### Séries (`series`)

Array de séries para gráficos multi-série. Cada série tem:
- `field`: Campo do documento
- `label`: (Opcional) Label da série
- `aggregation`: Tipo de agregação (count, sum, avg, min, max)
- `color`: (Opcional) Cor da série em hexadecimal
- `bucket`: (Opcional) Bucket temporal se o campo for data

**Nota**: `series` e `yAxis.field` são mutuamente exclusivos. Use `series` para múltiplas séries, ou `yAxis.field` + `aggregation` para série única.

### Título (`title`)

Objeto com traduções do título:
```json
{
  "title": {
    "en": "English Title",
    "pt_BR": "Título em Português"
  }
}
```

Se não fornecido, o sistema gera automaticamente baseado no documento e campos.

### Configurações Visuais

- `showLegend` (boolean): Mostrar legenda (default: true)
- `showGrid` (boolean): Mostrar grid (default: true)
- `width` (number): Largura em pixels (default: 800)
- `height` (number): Altura em pixels (default: 600)
- `colors` (string[]): Array de cores em hexadecimal para séries/categorias

### Configuração de Histograma (`histogram`)

Apenas para `type: "histogram"`:
```json
{
  "histogram": {
    "binWidth": 100,      // OU
    "binCount": 20,       // Usar apenas um dos dois
    "underflow": true,    // Incluir valores abaixo do primeiro bin
    "overflow": true      // Incluir valores acima do último bin
  }
}
```

## Validação

O sistema valida automaticamente:

1. **Tipo requerido**: `type` deve estar presente
2. **Campos requeridos por tipo**:
   - Bar/Line/Scatter: `xAxis.field` + (`yAxis.field` ou `series`)
   - Pie: `categoryField` + `yAxis.field` + `aggregation`
   - Histogram: `yAxis.field` + configuração de bins
3. **Bins exclusivos**: `binWidth` e `binCount` não podem ser usados simultaneamente
4. **Séries vs yAxis**: Não usar ambos simultaneamente

## Exemplo Completo: Activity.json

```json
{
  "_id": "Activity:pivot:Default",
  "type": "pivot",
  "document": "Activity",
  "rows": [
    {
      "name": "_user.group",
      "linkField": "_user.group",
      "visible": true
    },
    {
      "name": "_user",
      "linkField": "_user",
      "visible": true
    }
  ],
  "columns": {
    "status": {
      "name": "status",
      "linkField": "status",
      "visible": true,
      "minWidth": 150
    }
  },
  "values": [
    {
      "linkField": "code",
      "visible": true,
      "minWidth": 50,
      "aggregator": "count",
      "name": "code"
    }
  ],
  "graph": {
    "type": "pie",
    "categoryField": "status",
    "yAxis": {
      "field": "code"
    },
    "aggregation": "count",
    "title": {
      "en": "Activities by Status",
      "pt_BR": "Atividades por Situação"
    },
    "showLegend": true,
    "showGrid": false
  }
}
```

## Fluxo de Processamento

1. **Frontend**: Carrega metadata do pivot
2. **Frontend**: Extrai configuração do gráfico via `getGraphFromMeta()`
3. **Frontend**: Aplica título automático se não fornecido
4. **Frontend**: Envia `graphConfig` completo para backend via query parameter
5. **Backend**: Processa dados do pivot com filtros aplicados
6. **Backend**: Enriquece labels usando metadata do documento
7. **Backend**: Gera gráfico SVG usando Python (Polars + Pandas + Matplotlib)
8. **Frontend**: Renderiza SVG recebido

## Salvamento de Preferências

Usuários podem customizar:
- Configuração da pivot table (rows, columns, values)
- Configuração do gráfico (tipo, campos, título, etc.)
- Filtros aplicados

Preferências são salvas com o padrão:
```
{Document}:pivot:{PivotName}:Display:{PreferenceName}
```

E aparecem no submenu do módulo com o formato:
```
{PreferenceName} ({PivotLabel})
```

## Boas Práticas

### 1. Escolha do Tipo de Gráfico

- **Bar**: Comparações entre categorias (usuários, status, tipos)
- **Line**: Tendências temporais (vendas mensais, atividades diárias)
- **Pie**: Proporções de um total (distribuição por status, por tipo)
- **Scatter**: Correlações entre duas variáveis numéricas
- **Histogram**: Distribuição de valores numéricos (faixas de preço, idade)

### 2. Títulos Descritivos

Forneça títulos claros que descrevem o que o gráfico mostra:
```json
{
  "title": {
    "en": "Monthly Sales Revenue",
    "pt_BR": "Receita de Vendas Mensal"
  }
}
```

### 3. Agregação Temporal

Para dados temporais, use `bucket` apropriado:
- `hour`: Dados intradiários
- `day`: Dados diários/semanais
- `week`: Análise semanal
- `month`: Tendências mensais
- `quarter`: Visão trimestral
- `year`: Análise anual

### 4. Cores Consistentes

Defina cores consistentes para categorias importantes:
```json
{
  "colors": ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"]
}
```

### 5. Simplicidade

- Evite gráficos muito complexos com muitas séries
- Para múltiplas métricas, considere criar múltiplos pivots/gráficos
- Use `showLegend: false` quando há apenas uma série óbvia

## Resolução de Problemas

### Gráfico não aparece

- Verifique se o campo `graph` está no nível correto do metadata (mesmo nível de `rows`, `values`)
- Confirme que todos os campos requeridos estão presentes
- Verifique console do navegador para erros de validação

### Labels não traduzidos

- Certifique-se de que os campos existem no metadata do documento
- Verifique se as traduções (`label.en`, `label.pt_BR`) estão definidas no documento

### Dados não agregam corretamente

- Confirme que o `aggregation` é compatível com o tipo de campo
- Use `count` para campos não numéricos
- Use `sum`, `avg`, `min`, `max` apenas para campos numéricos

### Buckets temporais não funcionam

- Verifique se o campo é do tipo `date` ou `dateTime`
- Confirme que há dados suficientes para o bucket escolhido (ex: dados mensais para `bucket: "month"`)

## Referências

- ADR-0016: Processamento de Pivot no Backend
- ADR-0008: Internacionalização (i18n)
- Frontend: `/src/features/views/graphConfigUtils.ts`
- Frontend: `/src/features/views/pivotConfigUtils.ts`
- Backend: `/src/imports/data/api/graphMetadata.ts`
- Backend: `/src/imports/data/api/graphStream.ts`
- Python: `/src/scripts/pivot/graph_generator.py`
