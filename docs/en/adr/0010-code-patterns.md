# ADR-0010: Code Patterns

> Code style conventions and patterns for the Konecty backend project

---

## Status

**Accepted**

Date: 2026-02

Origin: Adapted from frontend [ADR-0012 (konecty-ui)](https://github.com/konecty/konecty-ui/blob/main/docs/adr/0012-padroes-codigo.md) to apply consistently across the full stack. **Strict compliance** is required: code reviews and lint rules must verify conformance.

---

## Context

To maintain code quality and consistency, we needed to establish clear standards that:

1. Reduce common bugs
2. Improve readability
3. Facilitate maintenance
4. Align the team on common practices

### Identified Problems

- Inconsistent use of `let` vs `const`
- `for` loops that could be more functional
- Use of `while(true)` that hinders readability and maintenance
- Magic numbers scattered throughout the code
- Lack of control in asynchronous loops

---

## Decision

> We decided to adopt the following code patterns: prefer-const, functional programming (map/reduce/filter), no-magic-numbers, and p-limit for concurrency control in asynchronous loops (see ADR-0001 for Bluebird deprecation).

### Adopted Patterns

1. **prefer-const**: Always use `const`, never `let` (except when mutation is necessary)
2. **Functional Programming**: Use `map`, `reduce`, `filter`, `flatMap` instead of `for` loops
3. **Avoid `while(true)`**: Use recursive functions or explicit iterative patterns
4. **no-magic-numbers**: All numbers must be named constants
5. **Async concurrency control**: Use **p-limit** with parallelism limits for asynchronous iterations (Bluebird was deprecated; see [ADR-0001](../../../docs/adr/0001-deprecacao-bluebird.md))

---

## Alternatives Considered

### Alternative 1: Allow `let` and `for` loops

**Pros:**

- More flexibility
- Code more familiar to some developers

**Cons:**

- Higher chance of bugs (accidental mutation)
- Less readable
- Harder to debug

### Alternative 2: Allow magic numbers

**Pros:**

- Less code
- Faster to write

**Cons:**

- Hard to understand the meaning
- Complicated maintenance
- Easy to make value errors

### Alternative 3: Promise.all for async loops

**Pros:**

- Native JavaScript
- No dependencies

**Cons:**

- No parallelism control
- Can overload resources
- Hard to limit concurrency

---

## Consequences

### Positive

- **Fewer bugs**: `const` prevents accidental mutations
- **More readable code**: Functions like `map` are more expressive than `for` loops
- **Maintainability**: Named constants explain the purpose of values
- **Controlled performance**: p-limit allows limiting parallelism in async operations
- **Consistency**: The entire team follows the same patterns

### Negative

- **Learning curve**: Developers accustomed to `for` loops need to adapt
- **Dependency**: p-limit adds a dependency to the project (lightweight and maintained)
- **More verbose**: Named constants can make code longer

### Neutral

- Need to document patterns
- Code reviews must verify conformance

---

## Implementation

### 1. prefer-const

**Rule**: Always use `const`, never `let`.

**Example -- Wrong**:

```typescript
let options = [];
for (let i = 0; i < 24; i++) {
	options.push(createOption(i));
}
```

**Example -- Correct**:

```typescript
const HOURS_PER_DAY = 24;
const options = Array.from({ length: HOURS_PER_DAY }, (_, hour) => createOption(hour));
```

### 2. Functional Programming

**Rule**: Use `map`, `reduce`, `filter`, `flatMap` instead of `for` loops.

**Example -- Wrong**:

```typescript
let result = [];
for (let i = 0; i < items.length; i++) {
	if (items[i].active) {
		result.push(items[i].value);
	}
}
```

**Example -- Correct**:

```typescript
const result = items.filter(item => item.active).map(item => item.value);
```

### 3. Avoid `while(true)`

**Rule**: Never use `while(true)`. Prefer recursive functions or explicit iterative patterns.

**Example -- Wrong**:

```typescript
while (true) {
	const { done, value } = await reader.read();
	if (done) break;
	process(value);
}
```

**Example -- Correct (Recursive)**:

```typescript
const processStream = async (reader: ReadableStreamDefaultReader): Promise<void> => {
	const { done, value } = await reader.read();
	if (done) return;
	process(value);
	return processStream(reader);
};
```

**Example -- Correct (Iterative with explicit condition)**:

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

**Rule**: All numbers must be named constants.

**Example -- Wrong**:

```typescript
if (value < 0 || value > 86400000) {
	return null;
}
```

**Example -- Correct**:

```typescript
const MIN_TIME_MILLISECONDS = 0;
const MAX_TIME_MILLISECONDS = 86400000; // 24 hours

if (value < MIN_TIME_MILLISECONDS || value > MAX_TIME_MILLISECONDS) {
	return null;
}
```

### 5. Concurrency Control in Async Loops

**Rule**: Use **p-limit** to limit concurrency in asynchronous loops (Bluebird was deprecated; see [ADR-0001](../../../docs/adr/0001-deprecacao-bluebird.md)).

**Example -- Wrong**:

```typescript
for (const item of items) {
	await processItem(item);
}
```

**Example -- Correct**:

```typescript
import pLimit from 'p-limit';

const CONCURRENCY_LIMIT = 5;
const limit = pLimit(CONCURRENCY_LIMIT);

await Promise.all(
	items.map(item => limit(() => processItem(item))),
);
```

### Common Constants

Some common constants in the project:

```typescript
// Time
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MAX_TIME_MILLISECONDS = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

// Validation
const MIN_TIME_MILLISECONDS = 0;
const MAX_TIME_MILLISECONDS = 86400000;
```

### When to Use p-limit

Use p-limit when:

- Processing multiple items asynchronously
- Need to limit parallelism
- Avoid overloading resources (API, database)

Do not use p-limit when:

- Only one asynchronous operation
- No need to limit parallelism
- Operations are fast and do not block resources

### 6. Variable and parameter names

**Rule**: Prefer **descriptive names** over single-letter variables (e.g. `f`, `x`, `u`). Single letters are acceptable only in very limited scope and obvious context (e.g. loop indices `i`, `j`). In `map`, `filter`, `forEach` callbacks, use names that describe the element (e.g. `item`, `user`, `fieldToken`).

**Rationale**: Descriptive names improve readability and maintainability; callbacks like `.map(item => item.value)` make intent clear, whereas `.map(f => f.value)` forces the reader to infer meaning.

**Example — Avoid**:

```typescript
const existingFields = findParams.fields ? findParams.fields.split(',').map(f => f.trim()) : [];
const ids = items.map(x => x.id);
```

**Example — Prefer**:

```typescript
const existingFields = findParams.fields ? findParams.fields.split(',').map(fieldToken => fieldToken.trim()) : [];
const ids = items.map(item => item.id);
```

**Exception**: Loop indices (`i`, `j`, `k`) remain acceptable when scope is a few lines and context is obvious.

---

## Strict Compliance

- **Code reviews**: Must verify prefer-const, no magic numbers, functional style, p-limit usage in async loops, **no unused variables/imports**, and **descriptive names in callbacks** (avoid single-letter parameters like `f`, `x`, `u` except indices `i`, `j`).
- **Linting**: Use ESLint rules `prefer-const`, `no-magic-numbers` (or equivalent), and `@typescript-eslint/no-unused-vars` where applicable.
- **New code**: All new backend code must follow these patterns; legacy code should be updated when touched.

---

## References

- [ESLint prefer-const rule](https://eslint.org/docs/latest/rules/prefer-const)
- [ESLint no-magic-numbers rule](https://eslint.org/docs/latest/rules/no-magic-numbers)
- [ADR-0001: Bluebird Deprecation and Migration to p-limit](../../../docs/adr/0001-deprecacao-bluebird.md)
- [p-limit (npm)](https://www.npmjs.com/package/p-limit)
- [MDN Array Methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array)
- [MDN JavaScript code style guide](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Code_style_guide/JavaScript): descriptive names in callbacks
- Frontend ADR-0012: Code Patterns (konecty-ui) — source document for this ADR

---

_Authors: Konecty Team_
