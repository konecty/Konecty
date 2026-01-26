---
name: testing-patterns
description: Padrões de teste para Node.js/TypeScript backend com Jest e Supertest. Inclui unit tests, integration tests, mocking e boas práticas. Use ao escrever testes de API, services ou revisar estratégia de testes backend.
---

# Testing Patterns - Node.js/TypeScript Backend

## Testing Pyramid

```
       /\
      /E2E\        <- Poucos, fluxos críticos de API
     /------\
    /  INT   \     <- Alguns, endpoints completos  
   /----------\
  /   UNIT     \   <- Muitos, lógica de negócio
 /--------------\
```

**Proporção recomendada**: 70% Unit, 20% Integration, 10% E2E

---

## Setup: Jest + Supertest

### Instalação

```bash
npm install -D jest @types/jest ts-jest supertest @types/supertest
npm install -D mongodb-memory-server  # Para testes com MongoDB
```

### Configuração

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__test__/globalSetup.ts'],
  testMatch: ['**/__test__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server/main.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

```typescript
// __test__/globalSetup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Limpar collections após cada teste
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map(collection => collection.deleteMany({}))
  );
});
```

---

## Unit Tests: Services e Funções

### Testar Lógica de Negócio Isoladamente

```typescript
// services/userService.test.ts
import { UserService } from './userService';
import { User } from '../models/User';

describe('UserService', () => {
  const userService = new UserService();
  
  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };
      
      const user = await userService.createUser(userData);
      
      expect(user).toHaveProperty('_id');
      expect(user.name).toBe('Test User');
      expect(user.password).not.toBe('password123'); // Deve estar hasheado
      expect(user.password).toHaveLength(60); // bcrypt hash length
    });
    
    it('should throw error if email already exists', async () => {
      const userData = {
        name: 'User',
        email: 'duplicate@example.com',
        password: 'password',
      };
      
      await userService.createUser(userData);
      
      await expect(userService.createUser(userData))
        .rejects.toThrow('Email already exists');
    });
  });
  
  describe('findActiveUsers', () => {
    beforeEach(async () => {
      await User.create([
        { name: 'Active 1', email: 'a1@test.com', active: true },
        { name: 'Active 2', email: 'a2@test.com', active: true },
        { name: 'Inactive', email: 'i1@test.com', active: false },
      ]);
    });
    
    it('should return only active users', async () => {
      const users = await userService.findActiveUsers();
      
      expect(users).toHaveLength(2);
      expect(users.every(u => u.active)).toBe(true);
    });
  });
});
```

---

## Integration Tests: API Endpoints

### Testar Rotas Completas com Supertest

```typescript
// routes/users.test.ts
import request from 'supertest';
import app from '../app';
import { User } from '../models/User';

const API_BASE = '/api';
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

describe('User API', () => {
  describe('POST /api/users', () => {
    it('should create user and return 201', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };
      
      const response = await request(app)
        .post(`${API_BASE}/users`)
        .send(userData);
      
      expect(response.status).toBe(HTTP_CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data).not.toHaveProperty('password'); // Não deve retornar senha
    });
    
    it('should return 400 for invalid data', async () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
        password: '123', // muito curta
      };
      
      const response = await request(app)
        .post(`${API_BASE}/users`)
        .send(invalidData);
      
      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
    });
    
    it('should return 409 for duplicate email', async () => {
      const userData = {
        name: 'User',
        email: 'duplicate@example.com',
        password: 'password',
      };
      
      // Criar primeiro usuário
      await request(app).post(`${API_BASE}/users`).send(userData);
      
      // Tentar criar duplicado
      const response = await request(app)
        .post(`${API_BASE}/users`)
        .send(userData);
      
      expect(response.status).toBe(409);
      expect(response.body.error).toMatch(/email already exists/i);
    });
  });
  
  describe('GET /api/users/:id', () => {
    it('should return user by id', async () => {
      const user = await User.create({
        name: 'Test',
        email: 'test@example.com',
        password: 'hashed',
      });
      
      const response = await request(app)
        .get(`${API_BASE}/users/${user._id}`);
      
      expect(response.status).toBe(HTTP_OK);
      expect(response.body.data.id).toBe(user._id.toString());
      expect(response.body.data.name).toBe('Test');
    });
    
    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`${API_BASE}/users/${fakeId}`);
      
      expect(response.status).toBe(HTTP_NOT_FOUND);
      expect(response.body.error).toMatch(/not found/i);
    });
  });
  
  describe('Authentication', () => {
    it('should require auth token for protected routes', async () => {
      const response = await request(app)
        .get(`${API_BASE}/protected`);
      
      expect(response.status).toBe(401);
    });
    
    it('should allow access with valid token', async () => {
      const token = 'valid-jwt-token'; // Gerar token de teste
      
      const response = await request(app)
        .get(`${API_BASE}/protected`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(HTTP_OK);
    });
  });
});
```

---

## Mocking

### Mock de Serviços Externos

```typescript
// __test__/mocks/emailService.ts
export const mockEmailService = {
  sendEmail: vi.fn().mockResolvedValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
};

// Uso no teste
vi.mock('@/services/emailService', () => ({
  EmailService: vi.fn(() => mockEmailService),
}));

it('should send welcome email on registration', async () => {
  const userData = { name: 'User', email: 'user@test.com', password: 'pass' };
  
  await request(app).post('/api/users').send(userData);
  
  expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
    'user@test.com',
    'User'
  );
});
```

### Mock de MongoDB

```typescript
// Para testes sem MongoDB real
vi.mock('mongoose', () => ({
  connect: vi.fn(),
  model: vi.fn(),
  Schema: vi.fn(),
}));
```

---

## Best Practices

### O que Testar

✅ **TESTE:**
- Lógica de negócio (validações, transformações)
- Endpoints de API (request/response)
- Error handling (casos de erro)
- Autenticação e autorização
- Database operations (CRUD)
- Integração com serviços externos

❌ **NÃO TESTE:**
- Bibliotecas third-party (já testadas)
- Código trivial (getters/setters simples)
- Configurações (env, setup básico)

### Organização de Testes

```
__test__/
├── globalSetup.ts
├── fixtures/
│   └── users.json
├── mocks/
│   ├── emailService.ts
│   └── paymentGateway.ts
├── auth/
│   ├── login.test.ts
│   └── otp.test.ts
├── data/
│   └── api/
│       ├── find.test.ts
│       └── create.test.ts
└── utils/
    └── dateUtils.test.ts
```

### Naming Conventions

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => { });
    it('should throw ValidationError for invalid data', async () => { });
    it('should hash password before saving', async () => { });
  });
});
```

---

## Checklist Rápido

Antes de commitar testes:

- [ ] Testa lógica de negócio crítica?
- [ ] Endpoints têm testes de success e error?
- [ ] Mock de serviços externos?
- [ ] Usa MongoDB Memory Server para testes?
- [ ] Limpa database após cada teste?
- [ ] Testes são independentes?
- [ ] Nomes descritivos ("should ... when ...")?
- [ ] Cobertura >70% do código crítico?
- [ ] Autenticação testada?
- [ ] Error cases cobertos?

---

## Recursos Adicionais

- [examples/](examples/) - Exemplos completos
- Jest: https://jestjs.io
- Supertest: https://github.com/ladjs/supertest
- MongoDB Memory Server: https://github.com/nodkz/mongodb-memory-server

---

**Filosofia**: Teste comportamento da API, não implementação interna.
