# RDA-0002: Error Handling Centralizado com express-async-errors

## Status
**Aceito** - Janeiro 2026

## Contexto

O backend Konecty possui tratamento de erros inconsistente e distribuído:

1. **Try-Catch Manual**: Cada rota tem seu próprio try-catch
2. **Duplicação**: Lógica de resposta de erro repetida
3. **Inconsistência**: Formatos de erro diferentes entre rotas
4. **Async Errors**: Erros assíncronos não capturados causam crashes
5. **Logging**: Logs de erro despadronizados

### Problemas Atuais

```typescript
// ❌ Problema 1: Try-catch manual em cada rota
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// ❌ Problema 2: Formato de resposta inconsistente
router.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).send('Not found'); // Formato diferente!
    }
    res.json(post);
  } catch (error) {
    res.status(500).send(error.message); // Expõe stack trace!
  }
});

// ❌ Problema 3: Errors não capturados
router.post('/process', async (req, res) => {
  const data = await fetchExternalAPI(); // Se falhar, crash!
  res.json(data);
});
```

## Decisão

**Implementar error handling centralizado usando `express-async-errors` + hierarquia de errors + middleware global.**

### Arquitetura da Solução

```
Request → Route Handler → Business Logic
   ↓           ↓              ↓
   ↓       Throw Error    Throw AppError
   ↓           ↓              ↓
   └───────────┴──────────────┘
                ↓
       errorHandler Middleware (último na stack)
                ↓
         Log + Response Padronizada
```

### Componentes da Solução

#### 1. Hierarquia de Errors

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
```

#### 2. Middleware Centralizado

```typescript
// middleware/errorHandler.ts
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: string[] | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  }

  logger.error({
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    statusCode,
    path: req.path,
    method: req.method,
  }, 'Request error');

  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
    timestamp: new Date().toISOString(),
    path: req.path,
  });
};
```

#### 3. Setup com express-async-errors

```typescript
// app.ts
import 'express-async-errors';  // ⚠️ NO TOPO!
import express from 'express';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// ... middlewares e rotas ...

// ⚠️ ÚLTIMO middleware
app.use(errorHandler);
```

### Uso Simplificado

```typescript
// ✅ Solução: Sem try-catch, apenas throw
router.get('/users/:id', async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    throw new NotFoundError(`User ${req.params.id} not found`);
  }
  
  res.json({ success: true, data: user });
});

// ✅ Errors assíncronos capturados automaticamente
router.post('/process', async (req: Request, res: Response) => {
  const data = await fetchExternalAPI(); // Errors são capturados!
  res.json({ success: true, data });
});
```

## Alternativas

### Alternativa 1: Try-Catch Manual em Cada Rota ❌

```typescript
router.get('/users/:id', async (req, res) => {
  try {
    // ... lógica
  } catch (error) {
    // ... tratamento
  }
});
```

**Rejeitado:**
- Verbose e repetitivo
- Propenso a inconsistências
- Desenvolvedor pode esquecer try-catch
- Difícil manter padrões

### Alternativa 2: Domain-Specific Handlers ❌

```typescript
// Cada módulo com seu handler
userRouter.use(userErrorHandler);
postRouter.use(postErrorHandler);
```

**Rejeitado:**
- Duplicação de código
- Inconsistências entre módulos
- Difícil padronizar logging

### Alternativa 3: Wrapper Functions ❌

```typescript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/users', asyncHandler(async (req, res) => { ... }));
```

**Rejeitado:**
- Wrapper em cada rota (verbose)
- express-async-errors faz isso automaticamente
- Mais fácil esquecer

## Consequências

### Positivas

1. **Consistência**: Todas as respostas de erro padronizadas
2. **DRY**: Zero duplicação de código de error handling
3. **Segurança**: Nunca expõe stack traces em produção
4. **Logging**: Todos os errors logados automaticamente
5. **Developer Experience**: Código mais limpo, foco no happy path
6. **Manutenibilidade**: Mudanças em uma única place
7. **Type Safety**: TypeScript valida tipos de erro

### Negativas

1. **Learning Curve**: Time precisa entender nova arquitetura
2. **Migration Effort**: ~60 rotas para migrar
3. **Testing**: Testes precisam validar throwing errors
4. **Dependência**: express-async-errors é uma dependência extra

### Neutras

1. **Stack Traces**: Apenas em logs, não nas responses
2. **Performance**: Impacto negligível (< 1ms)
3. **Debugging**: Requer entendimento de async error flow

## Implementação

### Fase 1: Setup Base (0.5 dia)

```bash
npm install express-async-errors
```

Criar estrutura:
```
src/
├── types/
│   └── errors.ts          # Hierarquia de errors
├── middleware/
│   └── errorHandler.ts    # Middleware centralizado
└── app.ts                 # Setup
```

### Fase 2: Migração Gradual (2 dias)

**Estratégia: Por módulo, começando com menos crítico**

1. **Utils/Scripts** (teste seguro)
2. **Módulos internos**
3. **APIs públicas** (staging validation)
4. **APIs críticas** (com double-check)

**Checklist por Rota:**
- [ ] Remover try-catch
- [ ] Throw AppError apropriado
- [ ] Remover res.status().json() de erros
- [ ] Atualizar testes
- [ ] Validar em staging

### Fase 3: Validação (1 dia)

1. Suite de testes completa
2. Testes de integração
3. Verificar logs estruturados
4. Validar formatos de resposta

### Exemplo de Migração

**Antes:**
```typescript
router.post('/api/users', async (req, res) => {
  try {
    const validatedData = UserSchema.parse(req.body);
    const existingUser = await User.findOne({ email: validatedData.email });
    
    if (existingUser) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    
    const user = await User.create(validatedData);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    logger.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
});
```

**Depois:**
```typescript
import 'express-async-errors';

router.post('/api/users', async (req: Request, res: Response): Promise<void> => {
  const validatedData = UserSchema.parse(req.body); // Lança erro se inválido
  
  const existingUser = await User.findOne({ email: validatedData.email });
  if (existingUser) {
    throw new ConflictError('Email already exists');
  }
  
  const user = await User.create(validatedData);
  
  res.status(201).json({
    success: true,
    data: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    },
  });
});
```

## Resposta Padronizada

### Success

```json
{
  "success": true,
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "message": "User not found",
  "details": ["Additional context"],
  "timestamp": "2026-01-26T10:30:00.000Z",
  "path": "/api/users/123"
}
```

## Monitoramento

### Métricas

1. **Error Rate**: Por endpoint
2. **Error Types**: Distribution (404, 500, etc)
3. **Response Time**: P95, P99
4. **Log Volume**: Structured errors

### Alertas

```typescript
// Configurar alertas
if (errorRate > MAX_ERROR_RATE_PERCENT) {
  alert('High error rate detected');
}

if (http500Count > THRESHOLD) {
  alert('Critical: Multiple 500 errors');
}
```

## Referências

- [express-async-errors npm](https://www.npmjs.com/package/express-async-errors)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [Node.js Best Practices - Error Handling](https://github.com/goldbergyoni/nodebestpractices#2-error-handling-practices)
- [ANALISE-GAPS-SKILLS.md](@Konecty/.cursor/skills/ANALISE-GAPS-SKILLS-updated.md)

## Notas de Revisão

- **Aprovado por:** Time de Backend
- **Data:** Janeiro 2026
- **Revisado em:** -
- **Status da Implementação:** Planejado para Q1 2026
- **Risk Level:** Baixo (melhoria de arquitetura)
