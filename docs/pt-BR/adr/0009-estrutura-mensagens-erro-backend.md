# ADR-0009: Estrutura Centralizada de Mensagens de Erro no Backend

> Decisão sobre como estruturar mensagens de erro amigáveis e reutilizáveis no backend

---

## Status

**Aceito**

Data: 2026-01-08

---

## Contexto

Mensagens de erro no backend estavam hardcoded e espalhadas pelo código, resultando em:

- **Inconsistência** de tom e formato entre diferentes endpoints
- **Mensagens técnicas demais** para usuários finais (ex: "HTTP error! status: 400")
- **Dificuldade de manutenção** e padronização
- **Falta de códigos de erro** padronizados para suporte técnico
- **Duplicação** de mensagens similares em diferentes partes do código

Ao implementar a funcionalidade de gráficos, identificamos a necessidade de padronizar mensagens de erro para melhorar a experiência do usuário e facilitar a manutenção.

---

## Decisão

Criar estrutura centralizada de mensagens de erro em `/src/imports/utils/graphErrors.ts` com:

- Função `getGraphErrorMessage()` para obter mensagens amigáveis e padronizadas
- Códigos de erro padronizados para suporte técnico (ex: `GRAPH_CONFIG_MISSING`)
- Mensagens em inglês (padrão do backend)
- Estrutura preparada para possível extensão futura com múltiplos idiomas
- Interface TypeScript para garantir tipagem correta

**Padrão de uso**:

```typescript
import { getGraphErrorMessage } from '/imports/utils/graphErrors';

const error = getGraphErrorMessage('GRAPH_CONFIG_MISSING', { document: 'Activity' });
return errorReturn([{ 
  message: error.message,  // User-friendly message in English
  code: error.code,         // Technical code for support
  details: error.details    // Optional technical details
}]);
```

---

## Alternativas Consideradas

### Alternativa 1: Manter mensagens hardcoded

**Prós:**
- Nenhum overhead de importação
- Mensagens próximas ao código que as usa

**Contras:**
- Inconsistência entre diferentes partes do código
- Difícil manutenção e atualização
- Sem padrão para códigos de erro
- Mensagens técnicas demais para usuários

### Alternativa 2: Implementar i18n completo no backend

**Prós:**
- Backend poderia retornar mensagens já traduzidas

**Contras:**
- Complexidade desnecessária (frontend já faz tradução via react-i18next)
- Duplicação de esforço de tradução
- Backend não possui infraestrutura de i18n para mensagens de erro
- Violaria o princípio de responsabilidade única (frontend já cuida de i18n)

### Alternativa 3: Estrutura centralizada com suporte a múltiplos idiomas desde o início

**Prós:**
- Preparado para futuro

**Contras:**
- Complexidade desnecessária no momento (YAGNI)
- Backend não precisa traduzir (frontend faz isso)
- Overhead de implementação sem necessidade imediata

**Decisão**: Implementar estrutura simples em inglês, mas preparada para extensão futura (comentários no código indicam como adicionar múltiplos idiomas se necessário).

---

## Consequências

### Positivas

- **Reutilização**: Estrutura pode ser usada em outros pontos do código além de gráficos
- **Consistência**: Todas as mensagens seguem o mesmo padrão e tom
- **Fácil manutenção**: Mensagens centralizadas em um único arquivo
- **Códigos padronizados**: Facilita suporte técnico e debugging
- **Tipagem**: Interface TypeScript garante estrutura correta
- **Preparado para futuro**: Estrutura pode ser estendida para múltiplos idiomas se necessário
- **Separação de responsabilidades**: Backend fornece mensagens amigáveis em inglês, frontend traduz

### Negativas

- **Requer importação**: Precisa importar utilitário (impacto mínimo)
- **Inicialmente apenas inglês**: Mas frontend traduz, então não é um problema real

### Neutras

- Estrutura pode ser generalizada para outros tipos de erro além de gráficos no futuro
- Se necessário, pode ser estendida para suportar múltiplos idiomas sem quebrar código existente

---

## Detalhes da Implementação

### Estrutura do Arquivo

```typescript
// graphErrors.ts
export interface GraphErrorResponse {
  message: string;
  code: string;
  details?: string;
}

export function getGraphErrorMessage(
  errorCode: string,
  details?: Record<string, string>
): GraphErrorResponse {
  // Implementação com substituição de placeholders
}

const ERROR_MESSAGES: Record<string, string> = {
  GRAPH_CONFIG_MISSING: "Graph configuration not found...",
  // ... outras mensagens
};
```

### Códigos de Erro Definidos

- `GRAPH_CONFIG_MISSING`: Configuração do gráfico não encontrada
- `GRAPH_CONFIG_INVALID`: Configuração incompleta
- `GRAPH_CONFIG_TYPE_MISSING`: Tipo de gráfico não especificado
- `GRAPH_CONFIG_AXIS_MISSING`: Eixos não configurados
- `GRAPH_CONFIG_AXIS_X_MISSING`: Eixo X não configurado
- `GRAPH_CONFIG_AXIS_Y_MISSING`: Eixo Y não configurado
- `GRAPH_CONFIG_CATEGORY_MISSING`: Campo de categoria não configurado
- `GRAPH_FILTER_INVALID`: Filtros inválidos
- `GRAPH_PROCESSING_ERROR`: Erro genérico de processamento
- `GRAPH_TIMEOUT`: Timeout na geração
- `GRAPH_DATA_ERROR`: Erro ao carregar dados

### Exemplos de Uso

**Uso básico**:
```typescript
const error = getGraphErrorMessage('GRAPH_CONFIG_MISSING');
return errorReturn([{ message: error.message, code: error.code }]);
```

**Com detalhes (placeholders)**:
```typescript
const error = getGraphErrorMessage('GRAPH_CONFIG_AXIS_X_MISSING', { type: 'bar' });
// Message: "X axis not configured. Please configure the X axis for bar charts."
return errorReturn([{ 
  message: error.message, 
  code: error.code, 
  details: error.details 
}]);
```

---

## Referências

- [Código: graphErrors.ts](../../src/imports/utils/graphErrors.ts)
- [Endpoint: dataApi.ts](../../src/server/routes/rest/data/dataApi.ts)
- [Stream: graphStream.ts](../../src/imports/data/api/graphStream.ts)
- [ADR-0008: Endpoint de Gráficos com Polars e Pandas](./0008-graph-endpoint-com-polars-pandas.md)

---

## Notas de Implementação

- Esta estrutura foi inicialmente criada para mensagens de erro de gráficos, mas pode ser reutilizada para outros tipos de erro no futuro
- O frontend mapeia os códigos de erro para chaves de tradução (ex: `GRAPH_CONFIG_MISSING` → `graph.error.graph-config-missing`)
- Mensagens são sempre em inglês no backend; o frontend é responsável pela tradução usando react-i18next
- A estrutura está preparada para extensão futura com múltiplos idiomas, mas isso não é necessário no momento (YAGNI)
