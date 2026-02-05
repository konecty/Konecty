# Skills Konecty Backend

Este diretório contém as skills do projeto backend para uso com o Cursor AI.

## Skills Disponíveis

### 1. Registro de Decisão de Arquitetura (RDA)
**Localização**: `.cursor/skills/registro-decisao-arquitetura/`

Skill para documentar decisões arquiteturais importantes seguindo o formato Nygard.

**Quando usar**: Ao tomar decisões significativas sobre tecnologias, padrões ou arquitetura do sistema.

**Como usar**: Digite `@registro-decisao-arquitetura` no Cursor ou mencione "RDA" ou "decisão de arquitetura".

**Recursos**:
- Template completo em português
- Exemplos específicos do backend
- Checklist de revisão
- Guia de boas práticas

### 2. Código Limpo
**Localização**: `.cursor/skills/codigo-limpo/`

Princípios e padrões de código limpo específicos para o backend Node.js/TypeScript do Konecty.

**Quando usar**: Ao escrever ou revisar código Node.js/TypeScript backend.

**Como usar**: Digite `@codigo-limpo` no Cursor ou mencione "código limpo", "clean code" ou princípios como "KISS", "YAGNI", "DRY", "SOLID".

**Princípios cobertos**:
- **KISS**: Keep It Simple, Stupid
- **YAGNI**: You Aren't Gonna Need It
- **DRY**: Don't Repeat Yourself
- **SOLID**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion

**Regras específicas**:
- prefer-const (sempre use `const`)
- Programação funcional (map/filter/reduce)
- Evitar while(true)
- no-magic-numbers
- ⚠️ **p-limit para controle de concorrência** (Bluebird deprecated)
- Logging estruturado com Pino
- Validação com Zod
- Async/await sobre callbacks

**Padrões backend**:
- Middleware pattern
- Service layer separation
- ⚠️ **Error handling centralizado com express-async-errors**
- Database queries eficientes
- Connection pooling
- Graceful shutdown
- **Async patterns modernos** (for-await-of, Promise.allSettled)

**Atualizações recentes**:
- ✅ Migração de Bluebird para p-limit (ver RDA-0001)
- ✅ Error handling centralizado completo (ver RDA-0002)
- ✅ Hierarquia de errors customizados
- ✅ Padrões async modernos (for-await-of, Promise.allSettled)

### 3. Testing Patterns
**Localização**: `.cursor/skills/testing-patterns/`

Padrões de teste para Node.js/TypeScript backend com Jest e Supertest.

**Quando usar**: Ao escrever testes de API, services ou revisar estratégia de testes backend.

**Como usar**: Digite `@testing-patterns` no Cursor ou mencione "testes", "testing", "Jest", "Supertest".

**Stack de testes**:
- **Jest**: Test runner padrão Node.js
- **Supertest**: HTTP testing para Express
- **MongoDB Memory Server**: Testes isolados com MongoDB real
- **Testing Pyramid**: 70% unit, 20% integration, 10% E2E

**Recursos**:
- Setup completo com Jest + Supertest
- MongoDB Memory Server configuration
- Exemplos de unit e integration tests
- Mocking strategies
- Best practices de testes backend

**Documentação relacionada**: RDA-0003 (Estratégia de Testes)

## Como Ativar Skills

### Opção 1: Menção Direta
Digite `@` seguido do nome da skill no chat do Cursor:
```
@codigo-limpo ajude-me a refatorar este código backend
```

### Opção 2: Menção Automática
As skills são ativadas automaticamente quando você menciona termos relacionados:
- "decisão de arquitetura", "RDA", "ADR" → ativa `registro-decisao-arquitetura`
- "código limpo", "clean code", "KISS", "DRY" → ativa `codigo-limpo`
- "testes", "testing", "Jest", "Supertest" → ativa `testing-patterns`

## Estrutura das Skills

Cada skill contém:

```
skill-name/
├── SKILL.md              # Documentação principal (< 500 linhas)
├── examples/             # Exemplos práticos
│   └── exemplos-praticos.md
├── templates/            # Templates (se aplicável)
└── references/           # Material de referência adicional
```

## Criar Nova Skill

Para criar uma nova skill:

1. Use a skill de criação de skills: `@create-skill`
2. Ou crie manualmente seguindo a estrutura:

```markdown
---
name: nome-da-skill
description: Descrição clara do que a skill faz e quando usar (max 1024 chars)
---

# Nome da Skill

## Instruções
[Conteúdo da skill]
```

## Melhores Práticas

### Para Skills Efetivas:
1. **Concise is Key**: Mantenha SKILL.md < 500 linhas
2. **Description Matters**: Escreva descrições específicas com termos-gatilho
3. **Third Person**: Escreva descrições em terceira pessoa
4. **Progressive Disclosure**: Use arquivos separados para detalhes
5. **One Level Deep**: Links para arquivos de referência apenas um nível

### Para Usar Skills:
1. **Seja Específico**: Mencione o contexto do problema
2. **Confie na Skill**: As skills contêm expertise do projeto
3. **Revise Outputs**: Sempre revise código gerado
4. **Feedback**: Reporte problemas para melhorar as skills

## Limites de Concorrência Recomendados

⚠️ **Nota**: Bluebird está deprecated. Use p-limit ou alternativas nativas.

Ao controlar concorrência, siga estes limites:

```typescript
// Com p-limit (Recomendado)
import pLimit from 'p-limit';

// Operações de Banco de Dados
const DB_CONCURRENCY = 10;
const limit = pLimit(DB_CONCURRENCY);

// Chamadas de API Externa
const API_CONCURRENCY = 5;

// Operações de I/O (arquivos)
const IO_CONCURRENCY = 3;

// Processamento Pesado (CPU-bound)
const CPU_CONCURRENCY = 2;
```

Ver RDA-0001 para detalhes da migração de Bluebird.

## Recursos Adicionais

- [Cursor Skills Documentation](https://docs.cursor.com/skills)
- [p-limit](https://www.npmjs.com/package/p-limit) - Controle de concorrência
- [Pino Logger](https://getpino.io)
- [Zod Validation](https://zod.dev)
- [express-async-errors](https://www.npmjs.com/package/express-async-errors)

### ADRs Relacionados
- RDA-0001: Deprecação do Bluebird
- RDA-0002: Error Handling Centralizado
- RDA-0003: Estratégia de Testes com Jest

---

**Mantido por**: Equipe Konecty
**Última atualização**: 2026-01-26
