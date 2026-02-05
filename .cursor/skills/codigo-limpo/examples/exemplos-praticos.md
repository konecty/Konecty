# Exemplos Práticos de Código Limpo - Backend

## 1. prefer-const: Processamento de Resultados

### ❌ Antes (Errado)
```typescript
let userIds = [];
for (let i = 0; i < users.length; i++) {
  userIds.push(users[i]._id);
}
```

### ✅ Depois (Correto)
```typescript
const userIds = users.map(user => user._id);
```

---

## 2. Programação Funcional: Agregação de Dados

### ❌ Antes (Errado)
```typescript
let totalAmount = 0;
let itemCount = 0;

for (let i = 0; i < orders.length; i++) {
  if (orders[i].status === 'completed') {
    totalAmount += orders[i].amount;
    itemCount += orders[i].items.length;
  }
}

const average = totalAmount / itemCount;
```

### ✅ Depois (Correto)
```typescript
const completedOrders = orders.filter(order => order.status === 'completed');

const totalAmount = completedOrders.reduce(
  (sum, order) => sum + order.amount, 
  0
);

const itemCount = completedOrders.reduce(
  (count, order) => count + order.items.length, 
  0
);

const ZERO_ITEMS = 0;
const average = itemCount > ZERO_ITEMS ? totalAmount / itemCount : 0;
```

---

## 3. Evitar while(true): Processamento de Fila

### ❌ Antes (Errado)
```typescript
while (true) {
  const job = await queue.getNext();
  if (!job) {
    await sleep(1000);
    continue;
  }
  
  await processJob(job);
}
```

### ✅ Depois (Correto - Recursivo)
```typescript
const QUEUE_CHECK_DELAY_MS = 1000;

const processQueue = async (): Promise<void> => {
  const job = await queue.getNext();
  
  if (!job) {
    await sleep(QUEUE_CHECK_DELAY_MS);
    return processQueue();
  }
  
  await processJob(job);
  return processQueue();
};

await processQueue();
```

### ✅ Alternativa (Iterativo com Condição Explícita)
```typescript
const QUEUE_CHECK_DELAY_MS = 1000;
let shouldContinue = true;

while (shouldContinue) {
  const job = await queue.getNext();
  
  if (job) {
    await processJob(job);
  } else {
    await sleep(QUEUE_CHECK_DELAY_MS);
  }
  
  // Condição de parada explícita
  shouldContinue = !shutdownRequested;
}
```

---

## 4. no-magic-numbers: Configuração de API

### ❌ Antes (Errado)
```typescript
const fetchWithRetry = async (url: string): Promise<Response> => {
  let retries = 0;
  
  while (retries < 3) {
    try {
      const response = await fetch(url, { 
        timeout: 30000,
        headers: { 'x-rate-limit': '60' }
      });
      
      if (response.status === 429) {
        await sleep(5000);
        retries++;
        continue;
      }
      
      return response;
    } catch (error) {
      retries++;
      await sleep(1000 * retries);
    }
  }
  
  throw new Error('Max retries exceeded');
};
```

### ✅ Depois (Correto)
```typescript
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_RETRY_DELAY_MS = 5000;
const BASE_RETRY_DELAY_MS = 1000;
const HTTP_TOO_MANY_REQUESTS = 429;

const fetchWithRetry = async (url: string): Promise<Response> => {
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    try {
      const response = await fetch(url, { 
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 
          'x-rate-limit': RATE_LIMIT_PER_MINUTE.toString() 
        }
      });
      
      if (response.status === HTTP_TOO_MANY_REQUESTS) {
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        retryCount++;
        continue;
      }
      
      return response;
    } catch (error) {
      retryCount++;
      const exponentialDelay = BASE_RETRY_DELAY_MS * retryCount;
      await sleep(exponentialDelay);
    }
  }
  
  throw new Error(`Max retries (${MAX_RETRIES}) exceeded`);
};
```

---

## 5. Bluebird: Processamento Paralelo de Usuários

### ❌ Antes (Sequencial - Lento)
```typescript
const sendWelcomeEmails = async (users: User[]): Promise<void> => {
  for (const user of users) {
    await sendEmail(user.email, 'Welcome!', getWelcomeTemplate(user));
  }
};
```

### ❌ Antes (Paralelo Sem Controle - Sobrecarga de SMTP)
```typescript
const sendWelcomeEmails = async (users: User[]): Promise<void> => {
  await Promise.all(
    users.map(user => 
      sendEmail(user.email, 'Welcome!', getWelcomeTemplate(user))
    )
  );
};
```

### ✅ Depois (Correto - Paralelismo Controlado)
```typescript
import Bluebird from 'bluebird';

const EMAIL_CONCURRENCY_LIMIT = 5;

const sendWelcomeEmails = async (users: User[]): Promise<void> => {
  await Bluebird.map(
    users,
    async (user) => {
      await sendEmail(
        user.email, 
        'Welcome!', 
        getWelcomeTemplate(user)
      );
    },
    { concurrency: EMAIL_CONCURRENCY_LIMIT }
  );
};
```

---

## 6. TypeScript: API Handler com Tipos

### ❌ Antes (Errado)
```typescript
export const createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### ✅ Depois (Correto)
```typescript
import { Request, Response } from 'express';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

interface CreateUserResponse {
  success: true;
  data: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  };
}

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_ERROR = 500;

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validatedInput = CreateUserSchema.parse(req.body);
    
    const user = await User.create(validatedInput);
    
    const response: CreateUserResponse = {
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    };
    
    res.status(HTTP_CREATED).json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(HTTP_BAD_REQUEST).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    
    logger.error({ error, body: req.body }, 'Failed to create user');
    res.status(HTTP_INTERNAL_ERROR).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
```

---

## 7. Logging Estruturado com Pino

### ❌ Antes (Errado)
```typescript
const processOrder = async (orderId: string) => {
  console.log(`Processing order ${orderId}`);
  
  try {
    const order = await Order.findById(orderId);
    console.log('Order found:', order);
    
    await chargePayment(order);
    console.log('Payment charged');
    
    await sendConfirmation(order);
    console.log('Confirmation sent');
  } catch (error) {
    console.error('Error processing order:', error);
    throw error;
  }
};
```

### ✅ Depois (Correto)
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const processOrder = async (orderId: string): Promise<void> => {
  logger.info({ orderId }, 'Processing order started');
  
  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      logger.warn({ orderId }, 'Order not found');
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    
    logger.debug({ orderId, amount: order.total }, 'Order found');
    
    await chargePayment(order);
    logger.info({ orderId, amount: order.total }, 'Payment charged successfully');
    
    await sendConfirmation(order);
    logger.info({ orderId, email: order.customerEmail }, 'Confirmation sent');
    
  } catch (error) {
    logger.error(
      { error, orderId }, 
      'Failed to process order'
    );
    throw error;
  }
};
```

---

## 8. Database: Queries Eficientes

### ❌ Antes (Ineficiente)
```typescript
const getUsersWithOrders = async () => {
  const users = await User.find();
  
  const usersWithOrders = [];
  for (const user of users) {
    const orders = await Order.find({ userId: user._id });
    if (orders.length > 0) {
      usersWithOrders.push({
        ...user.toObject(),
        orderCount: orders.length,
      });
    }
  }
  
  return usersWithOrders;
};
```

### ✅ Depois (Eficiente com Aggregation)
```typescript
import Bluebird from 'bluebird';

const MIN_ORDER_COUNT = 1;
const DB_QUERY_CONCURRENCY = 10;

const getUsersWithOrders = async (): Promise<UserWithOrders[]> => {
  // Opção 1: Usando aggregation (mais eficiente)
  const usersWithOrders = await User.aggregate([
    {
      $lookup: {
        from: 'orders',
        localField: '_id',
        foreignField: 'userId',
        as: 'orders',
      },
    },
    {
      $match: {
        'orders.0': { $exists: true },
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        orderCount: { $size: '$orders' },
      },
    },
  ]);
  
  return usersWithOrders;
};

// Opção 2: Se aggregation não é possível, use Bluebird
const getUsersWithOrdersAlternative = async (): Promise<UserWithOrders[]> => {
  const users = await User.find().lean();
  
  const usersWithOrderCounts = await Bluebird.map(
    users,
    async (user) => {
      const orderCount = await Order.countDocuments({ 
        userId: user._id 
      });
      
      return orderCount >= MIN_ORDER_COUNT
        ? { ...user, orderCount }
        : null;
    },
    { concurrency: DB_QUERY_CONCURRENCY }
  );
  
  return usersWithOrderCounts.filter(
    (user): user is UserWithOrders => user !== null
  );
};
```

---

## 9. SOLID: Service Layer Separation

### ❌ Antes (Múltiplas Responsabilidades)
```typescript
export const registerUser = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  
  // Validação
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  
  // Hash de senha
  const bcrypt = require('bcrypt');
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Criar usuário
  const user = await User.create({
    email,
    password: hashedPassword,
    name,
  });
  
  // Enviar email
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({...});
  await transporter.sendMail({
    to: email,
    subject: 'Welcome!',
    html: `<h1>Welcome ${name}!</h1>`,
  });
  
  // Criar token
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  
  res.json({ user, token });
};
```

### ✅ Depois (Responsabilidades Separadas)
```typescript
// services/authService.ts
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = '7d';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }
  
  async generateToken(userId: string): Promise<string> {
    const secret = process.env.JWT_SECRET!;
    return jwt.sign({ userId }, secret, { expiresIn: JWT_EXPIRES_IN });
  }
  
  async register(input: unknown): Promise<{ user: User; token: string }> {
    const validatedInput = RegisterSchema.parse(input);
    
    const hashedPassword = await this.hashPassword(validatedInput.password);
    
    const user = await User.create({
      ...validatedInput,
      password: hashedPassword,
    });
    
    const token = await this.generateToken(user._id.toString());
    
    return { user, token };
  }
}

// services/emailService.ts
export class EmailService {
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome!',
      template: 'welcome',
      data: { name },
    });
  }
  
  private async sendEmail(options: EmailOptions): Promise<void> {
    // implementação do envio
  }
}

// routes/auth.ts
const HTTP_CREATED = 201;

export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authService = new AuthService();
  const emailService = new EmailService();
  
  try {
    const { user, token } = await authService.register(req.body);
    
    // Envio de email em background (não bloqueia resposta)
    emailService.sendWelcomeEmail(user.email, user.name)
      .catch(error => {
        logger.error({ error, userId: user._id }, 'Failed to send welcome email');
      });
    
    res.status(HTTP_CREATED).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    throw error; // handled by error middleware
  }
};
```

---

## 10. KISS: Middleware Simples e Direto

### ❌ Antes (Over-engineering)
```typescript
class AuthenticationMiddlewareFactory {
  private strategies: Map<string, AuthStrategy>;
  
  constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }
  
  registerStrategy(name: string, strategy: AuthStrategy) {
    this.strategies.set(name, strategy);
  }
  
  createMiddleware(strategyName: string = 'jwt') {
    return async (req, res, next) => {
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        throw new Error(`Strategy ${strategyName} not found`);
      }
      
      try {
        const result = await strategy.authenticate(req);
        req.user = result.user;
        next();
      } catch (error) {
        next(error);
      }
    };
  }
  
  private registerDefaultStrategies() {
    this.registerStrategy('jwt', new JWTStrategy());
    this.registerStrategy('apiKey', new ApiKeyStrategy());
  }
}

const factory = new AuthenticationMiddlewareFactory();
export const authenticate = factory.createMiddleware('jwt');
```

### ✅ Depois (Simples e Direto)
```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const BEARER_PREFIX = 'Bearer ';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedError('No token provided');
    }
    
    const token = authHeader.slice(BEARER_PREFIX.length);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    const user = await User.findById(decoded.userId).lean();
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
```

---

## Recursos

- Bluebird API: http://bluebirdjs.com/docs/api-reference.html
- Pino Logger: https://getpino.io
- Zod Validation: https://zod.dev
- Mongoose Aggregation: https://mongoosejs.com/docs/api/aggregate.html
