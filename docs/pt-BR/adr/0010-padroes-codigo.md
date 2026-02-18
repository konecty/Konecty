# ADR-0010: Padrões de Código

> Convenções de estilo e padrões de código para o projeto Konecty backend

---

## Status

**Aceito**

Data: 2026-02

Origem: Adaptado do [ADR-0012 do frontend (konecty-ui)](https://github.com/konecty/konecty-ui/blob/main/docs/adr/0012-padroes-codigo.md) para aplicar consistentemente em todo o stack. **Cumprimento estrito** é exigido: revisões de código e regras de lint devem verificar conformidade.

---

## Contexto

Para manter a qualidade e consistência do código, precisávamos estabelecer padrões claros que:

1. Reduzam bugs comuns
2. Melhorem a legibilidade
3. Facilitem a manutenção
4. Alinhem o time em práticas comuns

### Problemas Identificados

-   Uso inconsistente de `let` vs `const`
-   Loops `for` que poderiam ser mais funcionais
-   Uso de `while(true)` que dificulta leitura e manutenção
-   Números mágicos espalhados pelo código
-   Falta de controle em loops assíncronos

---

## Decisão

> Decidimos adotar os seguintes padrões de código: prefer-const, programação funcional (map/reduce/filter), no-magic-numbers, e p-limit para controle de concorrência em loops assíncronos (ver ADR-0001 para deprecação do Bluebird).

### Padrões Adotados

1. **prefer-const**: Sempre usar `const`, nunca `let` (exceto quando mutação é necessária)
2. **Programação Funcional**: Usar `map`, `reduce`, `filter`, `flatMap` ao invés de `for` loops
3. **Evitar `while(true)`**: Usar funções recursivas ou padrões iterativos explícitos
4. **no-magic-numbers**: Todos os números devem ser constantes nomeadas
5. **Controle de concorrência em async**: Usar **p-limit** com limite de paralelismo para iterações assíncronas (Bluebird foi deprecado; ver [ADR-0001](../../../docs/adr/0001-deprecacao-bluebird.md))

---

## Alternativas Consideradas

### Alternativa 1: Permitir `let` e `for` loops

**Prós:**

-   Mais flexibilidade
-   Código mais familiar para alguns desenvolvedores

**Contras:**

-   Maior chance de bugs (mutação acidental)
-   Menos legível
-   Mais difícil de debugar

### Alternativa 2: Números mágicos permitidos

**Prós:**

-   Menos código
-   Mais rápido de escrever

**Contras:**

-   Difícil de entender o significado
-   Manutenção complicada
-   Fácil de errar valores

### Alternativa 3: Promise.all para async loops

**Prós:**

-   Nativo do JavaScript
-   Sem dependências

**Contras:**

-   Sem controle de paralelismo
-   Pode sobrecarregar recursos
-   Difícil limitar concorrência

---

## Consequências

### Positivas

-   **Menos bugs**: `const` previne mutações acidentais
-   **Código mais legível**: Funções como `map` são mais expressivas que `for` loops
-   **Manutenibilidade**: Constantes nomeadas explicam o propósito dos valores
-   **Performance controlada**: p-limit permite limitar paralelismo em operações assíncronas
-   **Consistência**: Todo o time segue os mesmos padrões

### Negativas

-   **Curva de aprendizado**: Desenvolvedores acostumados com `for` loops precisam se adaptar
-   **Dependência**: p-limit adiciona uma dependência ao projeto (leve e mantida)
-   **Mais verboso**: Constantes nomeadas podem tornar o código mais longo

### Neutras

-   Necessidade de documentar padrões
-   Code reviews devem verificar conformidade

---

## Implementação

### 1. prefer-const

**Regra**: Sempre usar `const`, nunca `let`.

**Exemplo -- Errado**:

```typescript
let options = [];
for (let i = 0; i < 24; i++) {
	options.push(createOption(i));
}
```

**Exemplo -- Correto**:

```typescript
const HOURS_PER_DAY = 24;
const options = Array.from({ length: HOURS_PER_DAY }, (_, hour) => createOption(hour));
```

### 2. Programação Funcional

**Regra**: Usar `map`, `reduce`, `filter`, `flatMap` ao invés de `for` loops.

**Exemplo -- Errado**:

```typescript
let result = [];
for (let i = 0; i < items.length; i++) {
	if (items[i].active) {
		result.push(items[i].value);
	}
}
```

**Exemplo -- Correto**:

```typescript
const result = items.filter(item => item.active).map(item => item.value);
```

### 3. Evitar `while(true)`

**Regra**: Nunca usar `while(true)`. Preferir funções recursivas ou padrões iterativos explícitos.

**Exemplo -- Errado**:

```typescript
while (true) {
	const { done, value } = await reader.read();
	if (done) break;
	process(value);
}
```

**Exemplo -- Correto (Recursivo)**:

```typescript
const processStream = async (reader: ReadableStreamDefaultReader): Promise<void> => {
	const { done, value } = await reader.read();
	if (done) return;
	process(value);
	return processStream(reader);
};
```

**Exemplo -- Correto (Iterativo com condição explícita)**:

```typescript
let done = false;
while (!done) {
	const result = await reader.read();
	done = result.done;
	if (!done) {
		process(result.value);
	}
}
```

### 4. no-magic-numbers

**Regra**: Todos os números devem ser constantes nomeadas.

**Exemplo -- Errado**:

```typescript
if (value < 0 || value > 86400000) {
	return null;
}
```

**Exemplo -- Correto**:

```typescript
const MIN_TIME_MILLISECONDS = 0;
const MAX_TIME_MILLISECONDS = 86400000; // 24 horas

if (value < MIN_TIME_MILLISECONDS || value > MAX_TIME_MILLISECONDS) {
	return null;
}
```

### 5. Controle de Concorrência em Async Loops

**Regra**: Usar **p-limit** para limitar concorrência em loops assíncronos (Bluebird foi deprecado; ver [ADR-0001](../../../docs/adr/0001-deprecacao-bluebird.md)).

**Exemplo -- Errado**:

```typescript
for (const item of items) {
	await processItem(item);
}
```

**Exemplo -- Correto**:

```typescript
import pLimit from 'p-limit';

const CONCURRENCY_LIMIT = 5;
const limit = pLimit(CONCURRENCY_LIMIT);

await Promise.all(
	items.map(item => limit(() => processItem(item))),
);
```

### Constantes Comuns

Algumas constantes comuns no projeto:

```typescript
// Tempo
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MAX_TIME_MILLISECONDS = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

// Validação
const MIN_TIME_MILLISECONDS = 0;
const MAX_TIME_MILLISECONDS = 86400000;
```

### Quando Usar p-limit

Use p-limit quando:

-   Processar múltiplos itens assincronamente
-   Precisar limitar paralelismo
-   Evitar sobrecarregar recursos (API, banco de dados)

Não use p-limit quando:

-   Apenas uma operação assíncrona
-   Não há necessidade de limitar paralelismo
-   Operações são rápidas e não bloqueiam recursos

### 6. Nomes de variáveis e parâmetros

**Regra**: Preferir **nomes descritivos** a variáveis de uma letra (ex.: `f`, `x`, `u`). Letras únicas são aceitáveis apenas em escopo muito limitado e contexto óbvio (ex.: índices `i`, `j` em laços `for`). Em callbacks de `map`, `filter`, `forEach`, etc., usar nomes que descrevam o elemento (ex.: `item`, `user`, `fieldToken`).

**Motivação**: Nomes descritivos melhoram leitura e manutenção; callbacks como `.map(item => item.value)` deixam a intenção clara, enquanto `.map(f => f.value)` obriga o leitor a inferir o significado.

**Exemplo -- Evitar**:

```typescript
const existingFields = findParams.fields ? findParams.fields.split(',').map(f => f.trim()) : [];
const ids = items.map(x => x.id);
```

**Exemplo -- Preferir**:

```typescript
const existingFields = findParams.fields ? findParams.fields.split(',').map(fieldToken => fieldToken.trim()) : [];
const ids = items.map(item => item.id);
```

**Exceção**: Índices em laços numéricos (`i`, `j`, `k`) continuam aceitáveis quando o escopo é de poucas linhas e o contexto é óbvio.

---

## Cumprimento Estrito

-   **Code reviews**: Devem verificar prefer-const, ausência de números mágicos, estilo funcional, uso de p-limit em loops assíncronos, **ausência de variáveis/imports não utilizados** e **nomes descritivos em callbacks** (evitar parâmetros de uma letra como `f`, `x`, `u` exceto índices `i`, `j`).
-   **Linting**: Usar regras ESLint:
    -   `prefer-const` e `no-magic-numbers` (ou equivalente) quando aplicável.
    -   **`@typescript-eslint/no-unused-vars`**: Nenhuma variável, parâmetro ou import pode ser definido e não utilizado; remover ou usar. Em tipos, preferir `import type` apenas quando o tipo for referenciado no arquivo.
-   **Código novo**: Todo código novo no backend deve seguir estes padrões; código legado deve ser atualizado quando alterado.

---

## Referências

-   [ESLint prefer-const rule](https://eslint.org/docs/latest/rules/prefer-const)
-   [ESLint no-magic-numbers rule](https://eslint.org/docs/latest/rules/no-magic-numbers)
-   [@typescript-eslint/no-unused-vars](https://typescript-eslint.io/rules/no-unused-vars): garantir que variáveis, parâmetros e imports não fiquem não utilizados.
-   [ADR-0001: Deprecação Bluebird e Migração para p-limit](../../../docs/adr/0001-deprecacao-bluebird.md)
-   [p-limit (npm)](https://www.npmjs.com/package/p-limit)
-   [MDN Array Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
-   [MDN JavaScript code style guide](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Code_style_guide/JavaScript): nomes descritivos em callbacks
-   Frontend ADR-0012: Padrões de Código (konecty-ui) — documento de origem deste ADR

---

_Autores: Equipe Konecty_
