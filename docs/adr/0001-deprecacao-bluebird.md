# RDA-0001: Deprecação do Bluebird e Migração para p-limit

## Status
**Aceito** - Janeiro 2026

## Contexto

Bluebird foi amplamente utilizado no backend Konecty para gerenciar operações assíncronas com controle de concorrência. No entanto:

1. **Deprecation Official**: Em 2025, o maintainer anunciou que Bluebird está deprecated
2. **Ecossistema Moderno**: Mongoose, Express e frameworks modernos removeram Bluebird
3. **Security Concerns**: Dependências não mantidas representam riscos
4. **Alternativas Nativas**: Promises ES6+ cobrem a maioria dos casos

### Uso Atual no Backend

```typescript
// Padrão atual com Bluebird
import Bluebird from 'bluebird';

const DB_CONCURRENCY = 10;
await Bluebird.map(documents, processDocument, { concurrency: DB_CONCURRENCY });
```

**Casos de uso no backend:**
- Processamento batch de documentos do MongoDB
- Envio de emails em lote
- Chamadas HTTP para APIs externas
- Processamento de arquivos (uploads, conversões)
- Jobs assíncronos

## Decisão

**Migrar de Bluebird para `p-limit` como padrão de controle de concorrência no backend.**

### Alternativa Escolhida: p-limit

```typescript
import pLimit from 'p-limit';

const DB_CONCURRENCY = 10;
const limit = pLimit(DB_CONCURRENCY);

await Promise.all(
  documents.map(doc => limit(() => processDocument(doc)))
);
```

**Por que p-limit no backend:**
- Mantido ativamente (Dezembro 2025)
- Funciona perfeitamente com Node.js streams
- TypeScript-first
- Lightweight (~2KB)
- Usado por ferramentas backend: webpack, esbuild, pm2

### Limites de Concorrência Recomendados

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

### Alternativas Consideradas

#### Opção 2: Chunking Manual

```typescript
const chunk = <T>(array: T[], size: number): T[][] =>
  Array.from(
    { length: Math.ceil(array.length / size) },
    (_, i) => array.slice(i * size, (i + 1) * size)
  );

const chunks = chunk(documents, DB_CONCURRENCY);

await chunks.reduce(
  async (previous, currentChunk) => {
    await previous;
    return Promise.all(currentChunk.map(processDocument));
  },
  Promise.resolve([])
);
```

**Quando usar:** Código crítico sem dependências externas

#### Opção 3: for-await-of (Casos Específicos)

```typescript
// Para streams e iterables assíncronos
for await (const chunk of stream) {
  await processChunk(chunk);
}
```

**Quando usar:** Processamento de streams grandes

## Alternativas (Rejeitadas)

1. **Continuar com Bluebird** ❌
   - Deprecated oficialmente
   - Sem atualizações de segurança
   - Contra tendência do ecossistema Node.js
   
2. **Apenas Promise.all** ❌
   - Sem controle de concorrência
   - Pode sobrecarregar MongoDB/APIs
   - Risco de timeout
   
3. **Bull Queue** ❌
   - Over-engineering para uso simples
   - Requer Redis
   - Complexidade desnecessária

## Consequências

### Positivas

1. **Alinhamento 2026**: Stack moderno e mantido
2. **Security**: Sem vulnerabilidades de código deprecated
3. **Performance**: p-limit é mais eficiente
4. **MongoDB-Friendly**: Respeita limites de connection pool
5. **Simplicidade**: API funcional e clara
6. **TypeScript**: Melhor integração com nosso backend

### Negativas

1. **Refactoring**: ~40 arquivos usam Bluebird no backend
2. **Migration Time**: Estimado 2-3 dias
3. **Testing**: Testes de integração precisam validação
4. **Risk**: Potencial regressão em jobs críticos

### Neutras

1. **API Diferente**: Mudança de sintaxe
2. **Dependencies**: Trocamos uma por outra
3. **Learning Curve**: Mínima para o time

## Plano de Migração

### Fase 1: Identificação e Priorização (0.5 dia)
```bash
# Encontrar todos os usos
rg "from 'bluebird'" --type ts src/

# Categorizar por criticidade
# 1. Crítico: Jobs de produção, processamento de pagamentos
# 2. Alta: APIs públicas, processamento de dados
# 3. Média: Background jobs
# 4. Baixa: Scripts utilitários
```

### Fase 2: Migração por Criticidade (2 dias)
1. Começar com **Baixa criticidade** (testes seguros)
2. Subir para **Média** (validar com staging)
3. **Alta** e **Crítica** com double-check

### Fase 3: Validação (1 dia)
1. Executar suite de testes completa
2. Testes de carga em staging
3. Monitorar performance (response time, memory)
4. Verificar logs de erro

### Fase 4: Deploy e Monitoramento (0.5 dia)
1. Deploy gradual (canary deployment)
2. Monitorar métricas por 48h
3. Rollback plan pronto

### Exemplo de Migração Backend

**Antes:**
```typescript
import Bluebird from 'bluebird';

const sendWelcomeEmails = async (users: User[]) => {
  const API_CONCURRENCY = 5;
  
  return Bluebird.map(users, async (user) => {
    await emailService.sendWelcome(user.email, user.name);
    logger.info({ userId: user._id }, 'Welcome email sent');
  }, { concurrency: API_CONCURRENCY });
};
```

**Depois:**
```typescript
import pLimit from 'p-limit';

const API_CONCURRENCY = 5;

const sendWelcomeEmails = async (users: User[]): Promise<void> => {
  const limit = pLimit(API_CONCURRENCY);
  
  await Promise.all(
    users.map(user => 
      limit(async () => {
        await emailService.sendWelcome(user.email, user.name);
        logger.info({ userId: user._id }, 'Welcome email sent');
      })
    )
  );
};
```

## Monitoramento Pós-Migração

### Métricas a Observar

1. **Response Time**: APIs que usavam Bluebird
2. **Error Rate**: Jobs assíncronos
3. **Memory Usage**: Processos batch
4. **Database Connections**: Pool usage
5. **Queue Length**: Background jobs

### Alertas

```typescript
// Configurar alertas no Datadog/New Relic
if (responseTime > THRESHOLD_MS) {
  alert('Performance degradation detected');
}

if (errorRate > MAX_ERROR_RATE) {
  alert('High error rate after migration');
}
```

## Rollback Plan

Se houver problemas críticos:

1. **Immediate**: Revert deploy via CI/CD
2. **Data**: Verificar integridade de dados
3. **Review**: Analisar logs e métricas
4. **Fix**: Corrigir issue específico
5. **Retry**: Novo deploy com fix

## Referências

- [Bluebird Deprecation](https://github.com/petkaantonov/bluebird/issues/1649)
- [p-limit npm](https://www.npmjs.com/package/p-limit)
- [Node.js Best Practices 2026](https://github.com/goldbergyoni/nodebestpractices)
- [ANALISE-GAPS-SKILLS.md](@Konecty/.cursor/skills/ANALISE-GAPS-SKILLS-updated.md)

## Notas de Revisão

- **Aprovado por:** Time de Backend
- **Data:** Janeiro 2026
- **Revisado em:** -
- **Status da Implementação:** Planejado para Q1 2026
- **Risk Level:** Médio (requer testes extensivos)
