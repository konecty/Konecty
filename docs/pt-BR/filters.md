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
- Use `$now` para a data atual
- Use `$group` para o grupo do usuário atual
- Use `$groups` para os grupos do usuário atual
- Use `$allgroups` para todos os grupos do usuário atual

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

### Operadores por Tipo de Campo

#### Texto
- `equals`
- `not_equals`
- `contains`
- `starts_with`
- `end_with`

#### Números
- `equals`
- `greater_than`
- `less_than`
- `between`

#### Datas
- `equals`
- `greater_than`
- `less_than`
- `between`

#### Booleanos
- `equals`
- `not_equals`

#### Listas
- `in`
- `not_in`

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

#### Exemplo Combinando Variáveis Especiais

Buscar registros que pertencem ao grupo do usuário atual e foram criados hoje:

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
            "term": "deliveryDate",
            "value": "$now"
        }
    ]
}
```
``` 