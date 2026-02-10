# Filtros no Konecty

Este guia foi desenvolvido para ajudar você a começar a criar filtros no Konecty de forma rápida e eficiente.

## O que são Filtros?

Filtros no Konecty são estruturas que permitem buscar e filtrar dados de acordo com critérios específicos. Eles são usados em várias partes do sistema, como:
- Listagens
- Relatórios
- Automações
- Regras de negócio

## Estrutura Básica

Todo filtro no Konecty segue esta estrutura básica:

```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "campo",
            "value": "valor"
        }
    ]
}
```

Onde:
- `match`: Define como múltiplas condições se relacionam ("and" ou "or")
- `conditions`: Lista de condições do filtro
- Cada condição tem:
  - `operator`: O tipo de comparação
  - `term`: O campo a ser comparado
  - `value`: O valor para comparação

## Filtros Aninhados

O Konecty suporta filtros aninhados, permitindo criar lógicas mais complexas combinando múltiplos filtros:

```json
{
    "match": "or",           // Operador lógico entre os filtros: "or" ou "and"
    "filters": [             // Array de sub-filtros
        {
            "match": "and",  // Operador lógico entre as condições
            "conditions": [   // Array de condições
                {
                    "term": "status",    // Campo a ser filtrado
                    "value": [           // Valor ou array de valores
                        "Nova",
                        "Em Andamento"
                    ],
                    "operator": "in"     // Operador de comparação
                }
            ]
        },
        {
            "match": "and",
            "conditions": [
                {
                    "term": "_user._id", // Campos aninhados usando ponto
                    "value": "$user",    // Valores especiais começam com $
                    "operator": "equals"
                }
            ]
        }
    ]
}
```

### Características dos Filtros Aninhados

1. **Níveis de Aninhamento**
   - Você pode aninhar filtros em múltiplos níveis
   - Cada nível pode ter seu próprio operador lógico (`match`)
   - Não há limite teórico para o número de níveis

2. **Combinação de Condições**
   - Use `match: "and"` quando todas as condições devem ser verdadeiras
   - Use `match: "or"` quando qualquer condição pode ser verdadeira
   - Misture `and` e `or` em diferentes níveis para lógicas complexas

3. **Estrutura**
   - `filters`: Array de sub-filtros
   - Cada sub-filtro pode conter:
     - `match`: Operador lógico
     - `conditions`: Condições diretas
     - `filters`: Mais sub-filtros

### Exemplo Prático de Filtro Aninhado

Buscar oportunidades que:
- São novas ou em andamento
- E pertencem ao usuário atual
- Ou têm valor maior que 10000

```json
{
    "match": "or",
    "filters": [
        {
            "match": "and",
            "conditions": [
                {
                    "term": "status",
                    "value": ["Nova", "Em+Andamento"],
                    "operator": "in"
                },
                {
                    "term": "_user._id",
                    "value": "$user",
                    "operator": "equals"
                }
            ]
        },
        {
            "match": "and",
            "conditions": [
                {
                    "term": "value.value",
                    "value": 10000,
                    "operator": "greater_than"
                }
            ]
        }
    ]
}
```

## Primeiros Passos

### 1. Filtro Simples
Vamos começar com um filtro simples que busca contatos ativos:

```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "status",
            "value": "Ativo"
        }
    ]
}
```

### 2. Combinando Condições
Agora, vamos buscar contatos ativos que são do estado de São Paulo:

```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "status",
            "value": "Ativo"
        },
        {
            "operator": "equals",
            "term": "address.state",
            "value": "SP"
        }
    ]
}
```

### 3. Usando OR
Buscar contatos que são do Rio de Janeiro OU São Paulo:

```json
{
    "match": "or",
    "conditions": [
        {
            "operator": "equals",
            "term": "address.state",
            "value": "SP"
        },
        {
            "operator": "equals",
            "term": "address.state",
            "value": "RJ"
        }
    ]
}
```

## Operadores Comuns

### Igualdade
```json
{
    "operator": "equals",
    "term": "name",
    "value": "João Silva"
}
```

### Contém Texto
```json
{
    "operator": "contains",
    "term": "name",
    "value": "Silva"
}
```

### Maior/Menor que
```json
{
    "operator": "greater_than",
    "term": "age",
    "value": 18
}
```

### Lista de Valores
```json
{
    "operator": "in",
    "term": "status",
    "value": ["Ativo", "Pendente", "Em Análise"]
}
```

## Exemplos Práticos

### 1. Buscar Oportunidades Recentes
```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "greater_than",
            "term": "_createdAt",
            "value": {
                "$date": "2024-01-01T00:00:00.000Z"
            }
        },
        {
            "operator": "in",
            "term": "status",
            "value": ["Nova", "Em Andamento"]
        }
    ]
}
```

### 2. Filtrar Contatos por Telefone e Email
```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "exists",
            "term": "email",
            "value": true
        },
        {
            "operator": "starts_with",
            "term": "phone.phoneNumber",
            "value": "11"
        }
    ]
}
```

### 3. Buscar por Responsável
```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "_user._id",
            "value": "$user"
        }
    ]
}
```

## Dicas e Truques

### Valores Especiais
- Use `$user` para referenciar o usuário atual
- Use `$now` para a data e hora atual
- Use `$group` para o grupo do usuário atual
- Use `$groups` para os grupos do usuário atual
- Use `$allgroups` para todos os grupos do usuário atual
- Use `$today`, `$yesterday`, `$startOfMonth`, etc. para limites dinâmicos de data
- Use `$endOfDay`, `$endOfMonth`, etc. para limites de fim de período
- Use `$daysAgo:N`, `$hoursAgo:N`, `$monthsAgo:N` para datas relativas no passado
- Use `$hoursFromNow:N`, `$daysFromNow:N`, `$monthsFromNow:N` para datas relativas no futuro

### Campos Aninhados
Para acessar campos dentro de objetos, use ponto:
- `address.city`
- `contact.name.first`
- `opportunity.value.currency`

### Filtros de Data
Sempre use o formato ISO para datas:
```json
{
    "operator": "equals",
    "term": "birthDate",
    "value": {
        "$date": "1990-01-01T00:00:00.000Z"
    }
}
```

## Problemas Comuns

### 1. Formato de Data Incorreto
❌ Errado:
```json
{
    "value": "2024-01-01"
}
```

✅ Correto:
```json
{
    "value": {
        "$date": "2024-01-01T00:00:00.000Z"
    }
}
```

### 2. Operador Inválido para o Tipo
❌ Errado:
```json
{
    "operator": "contains",
    "term": "age",
    "value": "2"
}
```

✅ Correto:
```json
{
    "operator": "equals",
    "term": "age",
    "value": 2
}
```

### 3. Campo Inexistente
❌ Errado:
```json
{
    "term": "endereco.cidade"
}
```

✅ Correto:
```json
{
    "term": "address.city"
}
```

## Próximos Passos

1. Experimente criar filtros simples e vá aumentando a complexidade
2. Use o console do navegador para testar os filtros
3. Verifique a documentação completa para casos específicos
4. Pratique combinando diferentes operadores

## Referências Rápidas

### Todos os Operadores

| Operador | Descrição |
|----------|-----------|
| `equals` | Igual a |
| `not_equals` | Diferente de |
| `contains` | Contém (substring) |
| `not_contains` | Não contém |
| `starts_with` | Começa com |
| `end_with` | Termina com |
| `less_than` | Menor que |
| `greater_than` | Maior que |
| `less_or_equals` | Menor ou igual a |
| `greater_or_equals` | Maior ou igual a |
| `between` | Entre dois valores |
| `in` | Está na lista |
| `not_in` | Não está na lista |
| `exists` | Campo existe (true) ou não existe (false) |
| `current_user` | Campo é o usuário atual |
| `not_current_user` | Campo não é o usuário atual |
| `current_user_group` | Campo é o grupo do usuário atual |
| `not_current_user_group` | Campo não é o grupo do usuário atual |
| `current_user_groups` | Campo está nos grupos do usuário atual |

### Operadores por Tipo de Campo

#### Texto (`text`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### URL (`url`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Email (`email.address`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Número (`number`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Auto-Número (`autoNumber`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Percentual (`percentage`)
`exists`, `equals`, `not_equals`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Data (`date`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Data e Hora (`dateTime`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Hora (`time`)
`exists`, `equals`, `not_equals`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Dinheiro — Moeda (`money.currency`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Dinheiro — Valor (`money.value`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Booleano (`boolean`)
`exists`, `equals`, `not_equals`

#### Picklist (`picklist`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Lookup (`lookup`)
`exists`

#### Lookup ID (`lookup._id`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### ObjectId
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Endereço — País (`address.country`)
`exists`, `equals`, `not_equals`

#### Endereço — Cidade (`address.city`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Endereço — Estado (`address.state`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Endereço — Bairro (`address.district`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Endereço — Logradouro (`address.place`)
`exists`, `equals`, `not_equals`, `contains`

#### Endereço — Número (`address.number`)
`exists`, `equals`, `not_equals`

#### Endereço — CEP (`address.postalCode`)
`exists`, `equals`, `not_equals`, `contains`

#### Endereço — Complemento (`address.complement`)
`exists`, `equals`, `not_equals`, `contains`

#### Endereço — Geolocalização (`address.geolocation.0`, `address.geolocation.1`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `less_than`, `greater_than`, `less_or_equals`, `greater_or_equals`, `between`

#### Nome de Pessoa (`personName.first`, `personName.last`, `personName.full`)
`exists`, `equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Telefone — Número (`phone.phoneNumber`)
`exists`, `equals`, `not_equals`, `in`, `not_in`, `contains`, `not_contains`, `starts_with`, `end_with`

#### Telefone — Código do País (`phone.countryCode`)
`exists`, `equals`, `not_equals`, `in`, `not_in`

#### Criptografado (`encrypted`)
`exists`, `equals`, `not_equals`

#### Filtro (`filter`)
`exists`

#### Texto Rico (`richText`)
`exists`, `contains`

#### Arquivo (`file`)
`exists`

### Campos Comuns
- `_id`: ID do registro
- `_createdAt`: Data de criação
- `_updatedAt`: Data de atualização
- `_user`: Usuário responsável
- `status`: Status do registro
- `name`: Nome
- `email`: Email
- `phone`: Telefone

### Variáveis Especiais ($)

O Konecty oferece variáveis especiais que podem ser usadas nos filtros para referências dinâmicas:

- **`$user`**: ID do usuário atual
  ```json
  {
      "operator": "equals",
      "term": "responsavel._id",
      "value": "$user"
  }
  ```

- **`$group`**: ID do grupo principal do usuário atual
  ```json
  {
      "operator": "equals",
      "term": "grupo._id",
      "value": "$group"
  }
  ```

- **`$groups`**: Array com IDs dos grupos secundários do usuário atual
  ```json
  {
      "operator": "in",
      "term": "grupos._id",
      "value": "$groups"
  }
  ```

- **`$allgroups`**: Array com todos os grupos (principal e secundários) do usuário atual
  ```json
  {
      "operator": "in",
      "term": "grupos._id",
      "value": "$allgroups"
  }
  ```

- **`$now`**: Data e hora atual
  ```json
  {
      "operator": "less_than",
      "term": "dataVencimento",
      "value": "$now"
  }
  ```

- **`$user.campo`**: Acesso a campos específicos do usuário atual
  ```json
  {
      "operator": "equals",
      "term": "filial._id",
      "value": "$user.filial._id"
  }
  ```

#### Variáveis Dinâmicas de Data

O Konecty oferece variáveis dinâmicas de data que são resolvidas no momento da consulta. Essas variáveis funcionam em todos os contextos de filtro: listagens, tabelas dinâmicas, gráficos, widgets KPI e campos de filtro em formulários.

**Início de período (00:00:00.000):**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `$today` | Início do dia atual | `00:00:00.000` de hoje |
| `$yesterday` | Início do dia anterior | `00:00:00.000` de ontem |
| `$startOfWeek` | Segunda-feira da semana atual | Segunda às `00:00:00.000` |
| `$startOfMonth` | Primeiro dia do mês atual | Dia 1 às `00:00:00.000` |
| `$startOfYear` | 1º de janeiro do ano atual | 1/jan às `00:00:00.000` |

**Fim de período (23:59:59.999):**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `$endOfDay` | Fim do dia atual | `23:59:59.999` de hoje |
| `$endOfWeek` | Domingo da semana atual | Domingo às `23:59:59.999` |
| `$endOfMonth` | Último dia do mês atual | Último dia às `23:59:59.999` |
| `$endOfYear` | 31 de dezembro do ano atual | 31/dez às `23:59:59.999` |

**Relativas paramétricas (passado):**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `$hoursAgo:N` | N horas atrás a partir de agora | `$hoursAgo:3` = 3 horas atrás |
| `$daysAgo:N` | N dias atrás às `00:00:00.000` | `$daysAgo:7` = 7 dias atrás |
| `$monthsAgo:N` | N meses atrás às `00:00:00.000` | `$monthsAgo:1` = mês passado |

**Relativas paramétricas (futuro):**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `$hoursFromNow:N` | Daqui N horas | `$hoursFromNow:3` = daqui 3 horas |
| `$daysFromNow:N` | Daqui N dias às `00:00:00.000` | `$daysFromNow:1` = amanhã |
| `$monthsFromNow:N` | Daqui N meses às `00:00:00.000` | `$monthsFromNow:1` = daqui 1 mês |

##### Exemplos

Registros criados neste mês:
```json
{
    "operator": "greater_or_equals",
    "term": "_createdAt",
    "value": "$startOfMonth"
}
```

Registros com vencimento até o fim de hoje:
```json
{
    "operator": "less_or_equals",
    "term": "dataVencimento",
    "value": "$endOfDay"
}
```

Registros criados nos últimos 7 dias:
```json
{
    "operator": "greater_or_equals",
    "term": "_createdAt",
    "value": "$daysAgo:7"
}
```

Registros atualizados nas últimas 3 horas:
```json
{
    "operator": "greater_or_equals",
    "term": "_updatedAt",
    "value": "$hoursAgo:3"
}
```

#### Exemplo Combinando Variáveis Especiais

Buscar registros que pertencem ao grupo do usuário atual e foram criados neste mês:

```json
{
    "match": "and",
    "conditions": [
        {
            "operator": "equals",
            "term": "grupo._id",
            "value": "$group"
        },
        {
            "operator": "greater_or_equals",
            "term": "_createdAt",
            "value": "$startOfMonth"
        }
    ]
}
``` 