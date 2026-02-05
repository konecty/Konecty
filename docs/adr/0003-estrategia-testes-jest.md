# RDA-0003: Estratégia de Testes com Jest e Supertest

## Status
**Aceito** - Janeiro 2026

## Contexto

O backend Konecty precisa de estratégia de testes consistente e eficaz. Atualmente:

1. **Cobertura Baixa**: < 40% de code coverage
2. **Inconsistência**: Diferentes padrões entre módulos
3. **Flaky Tests**: Testes dependem de estado global
4. **Sem Isolation**: Testes interferem uns nos outros
5. **Mock Inconsistente**: MongoDB real vs mocks

### State da Arte Backend 2026

- **Jest**: Padrão para Node.js testing
- **Supertest**: HTTP testing para Express
- **MongoDB Memory Server**: Testes isolados com MongoDB real
- **Testing Pyramid**: 70% unit, 20% integration, 10% E2E

## Decisão

**Adotar Jest + Supertest + MongoDB Memory Server como stack padrão de testes backend.**

### Stack de Testes

```
┌─────────────────────────────────────┐
│    E2E Tests (Postman/Newman)       │  ~5%
├─────────────────────────────────────┤
│    Integration Tests (Supertest)    │  ~25%
├─────────────────────────────────────┤
│    Unit Tests (Jest)                │  ~70%
└─────────────────────────────────────┘
```

### Componentes da Solução

#### 1. Jest (Test Runner)

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

**Por que Jest:**
- Padrão da indústria Node.js
- Mocking poderoso
- Snapshot testing
- Coverage built-in
- Grande comunidade

#### 2. Supertest (HTTP Testing)

```typescript
import request from 'supertest';
import app from '../app';

test('POST /api/users should create user', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ name: 'User', email: 'user@test.com' });
  
  expect(response.status).toBe(201);
  expect(response.body.data).toHaveProperty('id');
});
```

**Por que Supertest:**
- Testa APIs HTTP completas
- Não precisa server rodando
- Simula requests reais
- Integra com Express

#### 3. MongoDB Memory Server

```typescript
// __test__/globalSetup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Limpar após cada teste
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map(c => c.deleteMany({}))
  );
});
```

**Por que MongoDB Memory Server:**
- Testes com MongoDB real (não mock)
- Isolamento total entre testes
- Performance aceitável (~100ms setup)
- Sem dependências externas

### Guidelines de Testes

#### O que Testar

**✅ SEMPRE TESTE:**
1. Endpoints de API (request/response)
2. Lógica de negócio (services, utils)
3. Validações (Zod schemas)
4. Autenticação e autorização
5. Error handling (4xx, 5xx)
6. Database operations (CRUD)

**❌ NÃO TESTE:**
1. Bibliotecas third-party
2. Configurações simples
3. Getters/setters triviais
4. Código gerado

#### Test Structure

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Arrange
      const userData = { name: 'User', email: 'user@test.com' };
      
      // Act
      const user = await userService.createUser(userData);
      
      // Assert
      expect(user).toHaveProperty('_id');
      expect(user.name).toBe('User');
    });
    
    it('should throw error for duplicate email', async () => {
      // Arrange
      await userService.createUser({ name: 'U1', email: 'dup@test.com' });
      
      // Act & Assert
      await expect(
        userService.createUser({ name: 'U2', email: 'dup@test.com' })
      ).rejects.toThrow('Email already exists');
    });
  });
});
```

## Alternativas

### Alternativa 1: Mocha + Chai ❌

**Rejeitado:**
- Menos popular que Jest
- Mais configuração
- Sem mocking built-in
- Menos integração com TypeScript

### Alternativa 2: AVA ❌

**Rejeitado:**
- Menos maduro
- Comunidade menor
- Menos recursos

### Alternativa 3: MongoDB Real em Docker ❌

```yaml
# docker-compose.test.yml
services:
  mongodb:
    image: mongo:6
```

**Rejeitado:**
- Mais lento (~2-3s vs 100ms)
- Requer Docker
- Cleanup mais complexo
- CI/CD mais pesado

## Consequências

### Positivas

1. **Confiança**: Testes com MongoDB real
2. **Isolamento**: Cada teste independente
3. **Velocidade**: Memory Server rápido
4. **Realismo**: Supertest simula HTTP real
5. **DX**: Jest familiar e poderoso
6. **CI/CD**: Fácil integrar
7. **TypeScript**: Excelente suporte

### Negativas

1. **Setup Time**: ~100ms por test suite
2. **Memory**: MongoDB Memory Server usa ~50MB
3. **Learning Curve**: Time precisa aprender stack
4. **Flakiness**: Async tests precisam cuidado

### Neutras

1. **Mocking**: Precisa decidir quando mock vs real
2. **Coverage**: Mesma ferramenta que frontend
3. **Debugging**: Ferramentas conhecidas

## Implementação

### Fase 1: Setup e Infraestrutura (1 dia)

```bash
npm install -D jest @types/jest ts-jest
npm install -D supertest @types/supertest
npm install -D mongodb-memory-server
```

Criar:
- `jest.config.ts`
- `__test__/globalSetup.ts`
- `__test__/fixtures/`
- `__test__/mocks/`

### Fase 2: Test Utilities (0.5 dia)

```typescript
// __test__/utils/createTestUser.ts
export const createTestUser = async (overrides = {}) => {
  return User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed-password',
    ...overrides,
  });
};

// __test__/utils/authHelpers.ts
export const generateAuthToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!);
};

export const authenticatedRequest = (app: Express, token: string) => {
  return request(app).set('Authorization', `Bearer ${token}`);
};
```

### Fase 3: Testes Piloto (2 dias)

1. **Unit Test**: Service simples (UserService)
2. **Integration Test**: Endpoint CRUD completo
3. **Auth Test**: Login flow
4. **Error Test**: Validações e errors

### Fase 4: Migration Strategy (6-8 semanas)

**Regra:** Todo novo código tem testes

**Prioridade:**
1. APIs críticas (Auth, Payment)
2. Lógica de negócio complexa
3. Código com histórico de bugs
4. Novo código/features
5. Resto gradualmente

### Exemplo: Unit Test

```typescript
// services/userService.test.ts
import { UserService } from './userService';
import { User } from '../models/User';

describe('UserService', () => {
  const userService = new UserService();
  
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

### Exemplo: Integration Test

```typescript
// routes/users.test.ts
import request from 'supertest';
import app from '../app';
import { User } from '../models/User';

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;

describe('User API', () => {
  describe('POST /api/users', () => {
    it('should create user with valid data', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'SecurePass123',
      };
      
      const response = await request(app)
        .post('/api/users')
        .send(userData);
      
      expect(response.status).toBe(HTTP_CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      
      // Verificar no banco
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user?.name).toBe(userData.name);
    });
    
    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'User', email: 'invalid', password: 'pass' });
      
      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body.error).toMatch(/validation/i);
    });
  });
});
```

## Métricas de Sucesso

### Cobertura
- [ ] Unit tests: 70%+ coverage
- [ ] Critical APIs: 90%+ coverage
- [ ] Integration tests: 25% endpoints

### Qualidade
- [ ] Flaky tests: < 2%
- [ ] Test execution time: < 2min (all)
- [ ] PR blockers: 0 failing tests

### Performance
- [ ] Unit test: < 50ms average
- [ ] Integration test: < 200ms average
- [ ] Full suite: < 2min

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Backend Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Coverage Gates

```json
// package.json
{
  "scripts": {
    "test": "jest --watchAll",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:coverage": "jest --coverage --coverageReporters=text-lcov"
  }
}
```

## Monitoramento

### Test Metrics Dashboard

```typescript
// Coletar métricas
- Test execution time (per suite)
- Flaky test rate
- Coverage trends
- Failed test frequency
```

## Referências

- [Jest](https://jestjs.io)
- [Supertest](https://github.com/ladjs/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#section-4-testing-and-overall-quality-practices)
- [ANALISE-GAPS-SKILLS.md](@Konecty/.cursor/skills/ANALISE-GAPS-SKILLS-updated.md)

## Notas de Revisão

- **Aprovado por:** Time de Backend
- **Data:** Janeiro 2026
- **Revisado em:** -
- **Status da Implementação:** Planejado para Q1 2026
- **Risk Level:** Médio (requer adoção do time)
