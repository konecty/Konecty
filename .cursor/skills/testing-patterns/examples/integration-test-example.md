# Exemplo Completo: Integration Test de API

## Endpoint: User CRUD API

### Teste: users.test.ts

```typescript
// __test__/data/api/users.test.ts
import request from 'supertest';
import app from '@/server/app';
import { User } from '@/imports/model/User';
import { generateAuthToken } from '@/imports/auth/jwt';

const API_BASE = '/api/data/User';
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

describe('User API', () => {
  let authToken: string;
  let adminUser: any;
  
  beforeEach(async () => {
    // Criar usuário admin para autenticação
    adminUser = await User.create({
      name: 'Admin',
      email: 'admin@konecty.com',
      password: 'hashed-password',
      role: 'admin',
      active: true,
    });
    
    authToken = await generateAuthToken(adminUser._id.toString());
  });
  
  describe('POST /api/data/User', () => {
    it('should create user with valid data', async () => {
      const userData = {
        name: 'João Silva',
        email: 'joao@example.com',
        password: 'SecurePass123',
      };
      
      const response = await request(app)
        .post(API_BASE)
        .set('Authorization', `Bearer ${authToken}`)
        .send(userData);
      
      expect(response.status).toBe(HTTP_CREATED);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.name).toBe(userData.name);
      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data).not.toHaveProperty('password'); // Não retorna senha
      
      // Verificar no banco
      const createdUser = await User.findOne({ email: userData.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser?.name).toBe(userData.name);
    });
    
    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        email: 'test@example.com',
        // name faltando
      };
      
      const response = await request(app)
        .post(API_BASE)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);
      
      expect(response.status).toBe(HTTP_BAD_REQUEST);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/validation/i);
    });
    
    it('should return 409 for duplicate email', async () => {
      const userData = {
        name: 'User',
        email: 'duplicate@example.com',
        password: 'password',
      };
      
      // Criar primeiro usuário
      await request(app)
        .post(API_BASE)
        .set('Authorization', `Bearer ${authToken}`)
        .send(userData);
      
      // Tentar criar duplicado
      const response = await request(app)
        .post(API_BASE)
        .set('Authorization', `Bearer ${authToken}`)
        .send(userData);
      
      expect(response.status).toBe(HTTP_CONFLICT);
      expect(response.body.error).toMatch(/email already exists/i);
    });
    
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post(API_BASE)
        .send({ name: 'User', email: 'user@test.com', password: 'pass' });
      
      expect(response.status).toBe(HTTP_UNAUTHORIZED);
    });
  });
  
  describe('GET /api/data/User', () => {
    beforeEach(async () => {
      await User.create([
        { name: 'User 1', email: 'user1@test.com', active: true },
        { name: 'User 2', email: 'user2@test.com', active: true },
        { name: 'User 3', email: 'user3@test.com', active: false },
      ]);
    });
    
    it('should return all active users', async () => {
      const response = await request(app)
        .get(API_BASE)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ filter: JSON.stringify({ active: true }) });
      
      expect(response.status).toBe(HTTP_OK);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((u: any) => u.active)).toBe(true);
    });
    
    it('should support pagination', async () => {
      const PAGE_SIZE = 2;
      
      const response = await request(app)
        .get(API_BASE)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: PAGE_SIZE, skip: 0 });
      
      expect(response.status).toBe(HTTP_OK);
      expect(response.body.data).toHaveLength(PAGE_SIZE);
      expect(response.body).toHaveProperty('total');
    });
  });
  
  describe('PUT /api/data/User/:id', () => {
    it('should update user data', async () => {
      const user = await User.create({
        name: 'Original',
        email: 'original@test.com',
        active: true,
      });
      
      const updatedData = {
        name: 'Updated Name',
      };
      
      const response = await request(app)
        .put(`${API_BASE}/${user._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedData);
      
      expect(response.status).toBe(HTTP_OK);
      expect(response.body.data.name).toBe('Updated Name');
      
      // Verificar no banco
      const updatedUser = await User.findById(user._id);
      expect(updatedUser?.name).toBe('Updated Name');
    });
    
    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .put(`${API_BASE}/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' });
      
      expect(response.status).toBe(HTTP_NOT_FOUND);
    });
  });
  
  describe('DELETE /api/data/User/:id', () => {
    it('should delete user', async () => {
      const user = await User.create({
        name: 'To Delete',
        email: 'delete@test.com',
      });
      
      const response = await request(app)
        .delete(`${API_BASE}/${user._id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(HTTP_OK);
      
      // Verificar que foi deletado
      const deletedUser = await User.findById(user._id);
      expect(deletedUser).toBeNull();
    });
  });
});
```

---

## O que Este Teste Demonstra

### Boas Práticas Aplicadas

1. **Setup/Teardown** - beforeEach cria dados de teste
2. **Supertest** - Testa endpoints HTTP completos
3. **Autenticação** - Testa com e sem token
4. **Validações** - Testa dados válidos e inválidos
5. **Status codes** - Verifica HTTP codes corretos
6. **Database verification** - Confirma persistência
7. **Error cases** - Testa todos os cenários de erro
8. **Constants** - Usa constantes para status codes

### Cobertura Completa

- ✅ Happy path (sucesso)
- ✅ Validation errors
- ✅ Not found errors
- ✅ Conflict errors
- ✅ Authorization errors
- ✅ Database operations
- ✅ Pagination
