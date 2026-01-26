---
name: codigo-limpo
description: Princípios e padrões de código limpo para o projeto Konecty backend. Aplica KISS, YAGNI, DRY, SOLID, prefer-const, programação funcional, p-limit para concorrência e error handling centralizado. Use ao gerar ou revisar código Node.js/TypeScript backend.
---

# Código Limpo - Konecty Backend

## Princípios Fundamentais

### KISS (Keep It Simple, Stupid)
**Mantenha simples.** Simplicidade é a maior sofisticação.

- Funções com uma responsabilidade clara
- Lógica direta e fácil de entender
- Evite abstrações prematuras
- Se parece complexo, provavelmente está errado

### YAGNI (You Aren't Gonna Need It)
**Não implemente o que não precisa agora.**

- Resolva o problema atual, não problemas futuros hipotéticos
- Adicionar complexidade só quando comprovadamente necessária
- É mais fácil adicionar depois do que remover agora

### DRY (Don't Repeat Yourself)
**Não se repita.**

- Extraia lógica duplicada em funções/módulos
- Use middlewares para lógica compartilhada
- Constantes em arquivos de configuração

### SOLID
**Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion**

- **S**: Um módulo/função = uma responsabilidade
- **O**: Aberto para extensão, fechado para modificação
- **L**: Subtipos devem ser substituíveis por seus tipos base
- **I**: Interfaces pequenas e específicas
- **D**: Dependa de abstrações, não de implementações concretas

---

## Regras de Código

### 1. prefer-const
**Sempre use `const`, nunca `let`** (exceto quando mutação é necessária).

```typescript
// ❌ Errado
let users = [];
for (let i = 0; i < results.length; i++) {
  users.push(results[i]);
}

// ✅ Correto
const users = results.map(result => result);
```

**Por quê?**
- Previne mutações acidentais
- Código mais previsível
- Facilita debugging

### 2. Programação Funcional
**Use `map`, `reduce`, `filter`, `flatMap` ao invés de `for` loops.**

```typescript
// ❌ Errado
let activeUsers = [];
for (let i = 0; i < users.length; i++) {
  if (users[i].active) {
    activeUsers.push(users[i].id);
  }
}

// ✅ Correto
const activeUsers = users
  .filter(user => user.active)
  .map(user => user.id);
```

**Por quê?**
- Mais expressivo e declarativo
- Menos propenso a erros
- Melhor para composição

### 3. Evitar while(true)
**Nunca use `while(true)`.** Prefira recursão ou condições explícitas.

```typescript
// ❌ Errado
while (true) {
  const job = await queue.getNext();
  if (!job) break;
  await processJob(job);
}

// ✅ Correto (Recursivo)
const processQueue = async (): Promise<void> => {
  const job = await queue.getNext();
  if (!job) return;
  await processJob(job);
  return processQueue();
};

// ✅ Correto (Iterativo com condição explícita)
let hasMoreJobs = true;
while (hasMoreJobs) {
  const job = await queue.getNext();
  hasMoreJobs = job !== null;
  if (hasMoreJobs) {
    await processJob(job);
  }
}
```

### 4. no-magic-numbers
**Todos os números devem ser constantes nomeadas.**

```typescript
// ❌ Errado
if (users.length > 100) {
  await sendEmail(admin, 'Too many users');
}
setTimeout(retry, 5000);

// ✅ Correto
const MAX_USERS_BEFORE_ALERT = 100;
const RETRY_DELAY_MS = 5000;

if (users.length > MAX_USERS_BEFORE_ALERT) {
  await sendEmail(admin, 'Too many users');
}
setTimeout(retry, RETRY_DELAY_MS);
```

**Constantes Comuns:**
```typescript
// Tempo
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

// Database
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CONNECTION_POOL_SIZE = 10;

// API
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RATE_LIMIT_PER_MINUTE = 60;
```

### 5. Controle de Concorrência Assíncrona

> ⚠️ **Nota**: Bluebird está deprecated em 2026. Use alternativas modernas abaixo.

**Problema**: Executar múltiplas operações assíncronas com controle de paralelismo.

#### Opção 1: p-limit (Recomendada)

```typescript
import pLimit from 'p-limit';

const API_CONCURRENCY = 5;

const sendEmails = async (users: User[]): Promise<void> => {
  const limit = pLimit(API_CONCURRENCY);
  
  await Promise.all(
    users.map(user => limit(() => sendEmail(user)))
  );
};
```

**Vantagens**: Simples, mantido, funcional puro.

#### Opção 2: Chunking Funcional (Sem Dependências)

```typescript
const chunk = <T>(array: T[], size: number): T[][] =>
  Array.from(
    { length: Math.ceil(array.length / size) },
    (_, index) => array.slice(index * size, (index + 1) * size)
  );

const DB_BATCH_SIZE = 10;

const processDocuments = async (docs: Document[]): Promise<void> => {
  const chunks = chunk(docs, DB_BATCH_SIZE);
  
  await chunks.reduce(
    async (previousBatch, currentChunk) => {
      await previousBatch;
      return Promise.all(currentChunk.map(processDoc));
    },
    Promise.resolve([])
  );
};
```

**Vantagens**: Sem dependências, funcional.

#### Opção 3: Bluebird (Legado - Deprecated)

```typescript
// ⚠️ NÃO USE EM CÓDIGO NOVO - Apenas para manutenção de código legado
import Bluebird from 'bluebird';

const CONCURRENCY_LIMIT = 5;
await Bluebird.map(users, sendEmail, { concurrency: CONCURRENCY_LIMIT });
```

#### Limites de Concorrência Recomendados

```typescript
// Operações de Banco de Dados
const DB_CONCURRENCY = 10;

// Chamadas de API Externa
const API_CONCURRENCY = 5;

// Operações de I/O (arquivos)
const IO_CONCURRENCY = 3;

// Processamento Pesado (CPU-bound)
const CPU_CONCURRENCY = 2;
```

#### Comparação

| Opção | Prós | Contras | Quando Usar |
|-------|------|---------|-------------|
| **p-limit** | Simples, mantido | Dependência externa | Padrão para novo código |
| **Chunking** | Sem deps, funcional | Mais verbose | Projetos sem dependências extras |
| **Bluebird** | - | Deprecated | Apenas código legado |

**Quando aplicar controle de concorrência:**
- ✅ Processar múltiplos documentos do DB
- ✅ Fazer múltiplas chamadas HTTP
- ✅ Processar múltiplos arquivos
- ❌ Operações muito rápidas (< 10ms)
- ❌ Já existe controle no destino (pool do DB)

---

## Padrões Node.js/TypeScript Backend

### Async/Await
**Sempre prefira async/await sobre callbacks.**

```typescript
// ❌ Evite callbacks
db.find({ active: true }, (err, users) => {
  if (err) return handleError(err);
  processUsers(users);
});

// ✅ Use async/await
const findActiveUsers = async (): Promise<User[]> => {
  try {
    const users = await db.find({ active: true });
    return users;
  } catch (error) {
    handleError(error);
    throw error;
  }
};
```

### Interfaces e Types
**Sempre defina tipos para parâmetros e retornos.**

```typescript
// ❌ Sem tipagem
const processUser = async (id, options) => { ... }

// ✅ Com tipagem completa
interface ProcessUserOptions {
  sendEmail?: boolean;
  updateCache?: boolean;
}

const processUser = async (
  id: string,
  options: ProcessUserOptions = {}
): Promise<User> => { ... }
```

### Error Handling Centralizado

**Use `express-async-errors` + hierarquia de errors + middleware centralizado.**

#### 1. Instalar Dependência

```bash
npm install express-async-errors
```

#### 2. Criar Hierarquia de Errors

```typescript
// types/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: string[]
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: string[] = []) {
    super(message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}
```

#### 3. Middleware de Error Handling

```typescript
// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors';
import { logger } from '../lib/logger';

const HTTP_INTERNAL_ERROR = 500;
const HTTP_BAD_REQUEST = 400;

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = HTTP_INTERNAL_ERROR;
  let message = 'Internal Server Error';
  let details: string[] | undefined;

  // AppError e subclasses
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } 
  // Mongoose ValidationError
  else if (err.name === 'ValidationError') {
    statusCode = HTTP_BAD_REQUEST;
    message = 'Validation failed';
    details = Object.values((err as any).errors).map((e: any) => e.message);
  } 
  // Mongoose CastError
  else if (err.name === 'CastError') {
    statusCode = HTTP_BAD_REQUEST;
    message = 'Invalid ID format';
  }
  // MongoDB Duplicate Key
  else if ((err as any).code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
    const field = Object.keys((err as any).keyPattern)[0];
    details = [`${field} already exists`];
  }

  // Log estruturado
  logger.error({
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    statusCode,
    path: req.path,
    method: req.method,
    body: req.body,
    userId: (req as any).user?.id,
  }, 'Request error');

  // Resposta padronizada
  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};
```

#### 4. Setup no App

```typescript
// app.ts
import 'express-async-errors';  // ⚠️ IMPORTANTE: importar NO TOPO
import express from 'express';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json());

// ... suas rotas aqui ...

// ⚠️ CRÍTICO: errorHandler deve ser o ÚLTIMO middleware
app.use(errorHandler);

export default app;
```

#### 5. Uso nas Rotas

```typescript
// routes/users.ts
import { NotFoundError, ValidationError } from '../types/errors';

const HTTP_CREATED = 201;

// Com express-async-errors, não precisa try-catch manual
export const createUser = async (req: Request, res: Response): Promise<void> => {
  // Validação com Zod
  const validatedInput = CreateUserSchema.parse(req.body); // Lança erro se inválido
  
  // Verificações de negócio
  const existingUser = await User.findOne({ email: validatedInput.email });
  if (existingUser) {
    throw new ConflictError('Email already in use');
  }
  
  const user = await User.create(validatedInput);
  
  res.status(HTTP_CREATED).json({
    success: true,
    data: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
  });
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    throw new NotFoundError(`User ${req.params.id} not found`);
  }
  
  res.json({
    success: true,
    data: user,
  });
};
```

**Vantagens do Error Handling Centralizado:**
- Consistência em todas as respostas de erro
- Menos código duplicado
- Logging automático de todos os errors
- Fácil adicionar novos tipos de erro
- Async errors capturados automaticamente

---

## Padrões Async Modernos

### for-await-of para Streams e Iterables

**Use para processar streams assíncronos.**

```typescript
// Processar stream de dados
const processStream = async (stream: AsyncIterable<Chunk>): Promise<void> => {
  const results: Result[] = [];
  
  for await (const chunk of stream) {
    const processed = await processChunk(chunk);
    results.push(processed);
  }
  
  return results;
};

// Async generator
async function* fetchPaginated(endpoint: string): AsyncGenerator<User[]> {
  const PAGE_SIZE = 100;
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await api.get(`${endpoint}?page=${page}&size=${PAGE_SIZE}`);
    yield response.data;
    hasMore = response.data.length === PAGE_SIZE;
    page++;
  }
}

// Uso
const allUsers: User[] = [];
for await (const userBatch of fetchPaginated('/users')) {
  allUsers.push(...userBatch);
}
```

### Promise.allSettled para Operações Independentes

**Use quando algumas operações podem falhar sem afetar outras.**

```typescript
// ✅ Promise.allSettled - continua mesmo com falhas
const sendNotifications = async (users: User[]): Promise<void> => {
  const results = await Promise.allSettled(
    users.map(user => sendEmail(user))
  );
  
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  logger.info({ succeeded, failed }, 'Notifications sent');
  
  // Log apenas os que falharam
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error({ 
        userId: users[index].id, 
        error: result.reason 
      }, 'Failed to send email');
    }
  });
};

// ❌ Promise.all - falha tudo se um falhar
const sendNotificationsBad = async (users: User[]): Promise<void> => {
  await Promise.all(users.map(sendEmail)); // Um erro para tudo
};
```

**Quando usar cada um:**

| Método | Quando Usar | Comportamento |
|--------|-------------|---------------|
| `Promise.all` | Todas devem suceder | Rejeita no primeiro erro |
| `Promise.allSettled` | Independentes, algumas podem falhar | Sempre resolve, retorna status de cada |
| `Promise.race` | Primeiro a completar vence | Resolve/rejeita com primeiro resultado |
| `Promise.any` | Qualquer sucesso serve | Resolve com primeiro sucesso |

### Logging Estruturado
**Use Pino para logging estruturado.**

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// ✅ Log estruturado
logger.info({ userId, action: 'login' }, 'User logged in');
logger.error({ error, userId }, 'Failed to process user');

// ❌ Evite console.log
console.log('User logged in:', userId);
```

---

## Estrutura de Arquivos

### Organização por Feature
```
src/
├── imports/
│   ├── auth/
│   │   ├── login.ts
│   │   ├── otp.ts
│   │   └── types.ts
│   ├── data/
│   │   └── api/
│   │       ├── find.ts
│   │       ├── create.ts
│   │       └── update.ts
│   └── utils/
│       ├── dateUtils.ts
│       └── validators.ts
└── server/
    ├── routes/
    │   └── api/
    └── middleware/
```

### Nomenclatura
- **Módulos/Arquivos**: camelCase (`userService.ts`)
- **Classes**: PascalCase (`UserService`)
- **Funções**: camelCase (`findUserById`)
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase (`UserDocument`, `ApiResponse`)

---

## Validação e Type Safety

### Zod para Validação
**Use Zod para validar dados de entrada.**

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().positive().optional(),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const createUser = async (input: unknown): Promise<User> => {
  const validatedInput = CreateUserSchema.parse(input);
  // validatedInput é tipado como CreateUserInput
  return db.users.create(validatedInput);
};
```

### TypeScript Strict Mode
**Sempre use strict mode.**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "esModuleInterop": true
  }
}
```

---

## Database (MongoDB)

### Mongoose com TypeScript
**Defina schemas e types corretamente.**

```typescript
import { Schema, model, Document } from 'mongoose';

interface IUser extends Document {
  name: string;
  email: string;
  active: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const User = model<IUser>('User', UserSchema);
```

### Queries Eficientes
```typescript
// ✅ Use lean() para leitura quando não precisa de document
const users = await User.find({ active: true }).lean();

// ✅ Use select para buscar apenas campos necessários
const userEmails = await User.find({ active: true })
  .select('email')
  .lean();

// ✅ Use indexes apropriados
UserSchema.index({ email: 1 });
UserSchema.index({ active: 1, createdAt: -1 });
```

---

## API Design

### Middleware Pattern
**Use middlewares para lógica compartilhada.**

```typescript
// Middleware de autenticação
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }
    
    const decoded = await verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

// Uso
router.get('/protected', authenticate, async (req, res) => {
  res.json({ user: req.user });
});
```

### Error Handling Middleware
**Centralize tratamento de erros.**

```typescript
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error({ error, path: req.path }, 'Request error');
  
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
  });
};
```

### Response Patterns
**Padronize respostas da API.**

```typescript
// Success
interface SuccessResponse<T> {
  success: true;
  data: T;
}

// Error
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// Helper
const sendSuccess = <T>(res: Response, data: T) => {
  res.json({ success: true, data });
};

const sendError = (res: Response, statusCode: number, message: string) => {
  res.status(statusCode).json({ success: false, error: message });
};
```

---

## Performance

### Connection Pooling
**Use connection pooling para database.**

```typescript
const MONGODB_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
};

await mongoose.connect(MONGODB_URI, MONGODB_OPTIONS);
```

### Caching com Redis
**Cache operações custosas.**

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
});

const CACHE_TTL_SECONDS = 300; // 5 minutes

const getCachedUser = async (id: string): Promise<User | null> => {
  const cached = await redis.get(`user:${id}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const user = await User.findById(id).lean();
  if (user) {
    await redis.setex(`user:${id}`, CACHE_TTL_SECONDS, JSON.stringify(user));
  }
  
  return user;
};
```

### Graceful Shutdown
**Implemente shutdown gracioso.**

```typescript
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  // Pare de aceitar novas conexões
  server.close();
  
  // Aguarde requisições em andamento
  await Promise.all([
    mongoose.connection.close(),
    redis.quit(),
  ]);
  
  logger.info('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## Segurança

### Input Validation
**Sempre valide entrada do usuário.**

```typescript
// Use Zod para validação
const input = InputSchema.parse(req.body);
```

### Environment Variables
**Use variáveis de ambiente para configuração sensível.**

```typescript
// .env (não commitar)
DATABASE_URL=mongodb://...
JWT_SECRET=...
API_KEY=...

// Uso
import dotenv from 'dotenv';
dotenv.config();

const config = {
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
};
```

### Rate Limiting
**Implemente rate limiting.**

```typescript
import rateLimit from 'express-rate-limit';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 100;

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: MAX_REQUESTS_PER_WINDOW,
  message: 'Too many requests from this IP',
});

app.use('/api/', limiter);
```

---

## Testes

### Unit Tests
**Teste lógica de negócio isoladamente.**

```typescript
import { findActiveUsers } from './userService';

describe('userService', () => {
  describe('findActiveUsers', () => {
    it('should return only active users', async () => {
      const users = await findActiveUsers();
      
      expect(users).toHaveLength(2);
      expect(users.every(u => u.active)).toBe(true);
    });
  });
});
```

### Integration Tests
**Teste fluxos completos.**

```typescript
describe('POST /api/users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        name: 'Test User',
        email: 'test@example.com',
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('id');
  });
});
```

---

## Checklist Rápido

Antes de commitar código, verifique:

- [ ] Usou `const` ao invés de `let`?
- [ ] Evitou `for` loops (usou `map/filter/reduce`)?
- [ ] Não tem números mágicos?
- [ ] Usou p-limit ou chunking para loops assíncronos com +3 itens?
- [ ] Evitou `while(true)`?
- [ ] Importou `express-async-errors` no app.ts?
- [ ] Errors customizados (ValidationError, NotFoundError, etc)?
- [ ] Logging estruturado com Pino?
- [ ] Validação de input com Zod?
- [ ] Tipos TypeScript para funções e interfaces?
- [ ] Código segue KISS/YAGNI/DRY/SOLID?
- [ ] Middlewares para lógica compartilhada?
- [ ] ErrorHandler é o último middleware?
- [ ] Testes cobrem casos principais?

---

## Recursos Adicionais

- [examples/](examples/) - Exemplos práticos de cada padrão
- Bluebird: http://bluebirdjs.com/docs/api-reference.html
- Pino: https://getpino.io
- Zod: https://zod.dev

---

**Lembre-se**: Código limpo não é sobre seguir regras cegamente, mas sobre escrever código que é fácil de entender, manter e modificar. Use bom senso!
