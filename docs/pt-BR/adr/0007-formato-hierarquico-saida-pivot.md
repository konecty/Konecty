# ADR-0007: Formato Hierárquico de Saída do Pivot

## Status
Aceito

## Contexto
O endpoint inicial de tabela dinâmica retornava uma estrutura de array "flat" com nomes técnicos de campos e valores brutos. Isso dificultava para aplicações frontend:
- Renderizar tabelas dinâmicas hierárquicas com linhas expansíveis/colapsáveis
- Exibir labels amigáveis ao invés de nomes técnicos de campos
- Mostrar subtotais em cada nível da hierarquia
- Formatar valores de lookup de acordo com seus `descriptionFields`
- Lidar com campos de lookup aninhados com concatenação adequada de labels

## Decisão
Implementaremos um formato de resposta JSON hierárquico que inclui:
1. **Metadados enriquecidos**: Labels, tipos e informações de campos extraídos de `MetaObject.Meta`
2. **Estrutura de dados hierárquica**: Arrays `children` aninhados para hierarquias de linhas multi-nível
3. **Subtotais por nível**: Cada nível da hierarquia inclui seus próprios `totals`
4. **Totais gerais**: Agregados no nível raiz para todos os dados
5. **Formatação de lookup**: Formatação automática de valores de lookup usando `formatPattern` baseado em `descriptionFields`
6. **Labels de campos aninhados**: Labels concatenados para campos aninhados (ex: "Grupo > Nome" para `_user.group.name`)

## Estrutura

### Formato de Resposta
```json
{
  "success": true,
  "metadata": {
    "rows": [
      {
        "field": "_user.director.nickname",
        "label": "Diretor > Apelido",
        "type": "text",
        "level": 0
      }
    ],
    "columns": [...],
    "values": [...]
  },
  "data": [
    {
      "key": "ANTONIOBRUM",
      "label": "ANTONIOBRUM",
      "level": 0,
      "cells": {...},
      "totals": {...},
      "children": [...]
    }
  ],
  "grandTotals": {
    "cells": {...},
    "totals": {...}
  }
}
```

### Regras de Formatação de Lookup
- Quando um campo de lookup é usado sem sub-campo (ex: `_user`), formatar usando `descriptionFields`:
  - Separar campos simples de campos aninhados
  - Usar primeiro campo simples como valor principal
  - Adicionar outros campos simples entre parênteses, separados por `-`
  - Exemplo: `descriptionFields: ["name", "active"]` → `"Fulano (Sim)"`

- Para campos aninhados, concatenar labels dos pais:
  - `_user.group.name` → `"Grupo > Nome"`

## Consequências

### Positivas
- Frontend pode renderizar tabelas hierárquicas diretamente sem processamento adicional
- Labels amigáveis melhoram UX
- Subtotais e totais gerais calculados no servidor reduzem computação no cliente
- Formatação consistente de valores de lookup em toda a aplicação
- Metadados incluídos na resposta reduzem necessidade de chamadas adicionais à API

### Negativas
- Breaking change: Formato de resposta mudou de array flat para estrutura hierárquica
- Payload de resposta ligeiramente maior devido à inclusão de metadados
- Lógica de processamento Python mais complexa necessária

### Mitigação
- A estrutura hierárquica é mais intuitiva e fácil de trabalhar
- Metadados podem ser cacheados pelo frontend para reduzir requisições subsequentes
- Processamento Python é eficiente usando biblioteca Polars

## Detalhes de Implementação

### Enriquecimento de Metadados
- `enrichPivotConfig()` extrai metadados de `MetaObject.Meta[document]`
- Navega recursivamente campos de lookup para resolver metadados de campos aninhados
- Concatena labels dos pais para campos aninhados
- Extrai opções de picklist com labels traduzidos

### Processamento Python
- Recebe config enriquecido com metadados
- Aplica `formatPattern` a valores de lookup
- Constrói estrutura hierárquica com arrays `children`
- Calcula subtotais em cada nível
- Calcula totais gerais

### Suporte Multilíngue
- Extrai header `Accept-Language` da requisição
- Padrão para `pt_BR` se não fornecido
- Usa idioma para selecionar labels apropriados dos metadados

## Referências
- ADR-0006: Integração Python para Tabelas Dinâmicas
- ADR-0001: HTTP Streaming para Busca de Dados

