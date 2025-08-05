# PLANNING.MD - Controle Granular de Listas e Pivots no Menu

## 🏢 Dados da Tarefa Principal no Konecty Hub
- taskId: <A SER PREENCHIDO APÓS CONEXÃO COM HUB>
- code: 1666
- Link no Hub: <A SER PREENCHIDO APÓS CONEXÃO COM HUB>
- Cliente: KONECTY
- Projeto: Hub MCP

## 1. Contexto
### 1.1. Motivação
O endpoint `/rest/menu/list` do Konecty entrega todos os itens que devem aparecer no menu. Atualmente, o sistema possui controle de acesso para omitir módulos inteiros, mas não oferece controle granular sobre listas e pivots específicos dentro de um módulo. Esta funcionalidade permitirá maior flexibilidade na personalização do menu para diferentes papéis de usuário.

### 1.2. Problemas que Resolvemos
- Falta de controle granular sobre elementos do menu
- Necessidade de ocultar listas/pivots específicos sem esconder módulos inteiros
- Melhor organização e limpeza do menu para diferentes papéis de usuário
- Flexibilidade na configuração de acesso por módulo

### 1.3. Solução Proposta
Adicionar duas novas propriedades opcionais ao schema de access:
- `hideListsFromMenu`: Array de strings com nomes das listas a serem ocultadas
- `hidePivotsFromMenu`: Array de strings com nomes dos pivots a serem ocultados

Implementar lógica de filtragem no endpoint `/rest/menu/list` que verifica essas propriedades e omite os metaObjects correspondentes do retorno.

## 2. Detalhamento da Proposta
### 2.1. Escopo da Solução
**Incluído:**
- Modificação do schema `MetaAccess` para incluir novas propriedades opcionais
- Implementação de lógica de filtragem no endpoint `/rest/menu/list`
- Manutenção de compatibilidade com implementação existente
- Implementação de cache similar ao código atual
- Criação de testes unitários com TDD
- Atualização da documentação

**Não Incluído:**
- Modificações no endpoint `/api/menu/main`
- Mudanças na interface do usuário
- Novos tipos de controle de acesso além de listas e pivots

### 2.2. Requisitos Funcionais e Não Funcionais
**Funcionais:**
- Filtrar listas baseado na propriedade `hideListsFromMenu` do access
- Filtrar pivots baseado na propriedade `hidePivotsFromMenu` do access
- Usar propriedade `name` (não `_id`) para identificação
- Manter módulos vazios no menu quando não há listas/pivots para mostrar
- Preservar comportamento existente quando propriedades não estão definidas

**Não Funcionais:**
- Compatibilidade total com implementação existente
- Performance otimizada com cache similar ao código atual
- Cobertura de testes adequada
- Documentação atualizada

### 2.3. Impacto nos Componentes do Sistema
- **Schema**: `src/imports/model/MetaAccess.ts` - Adicionar novas propriedades opcionais
- **Endpoint**: `src/imports/menu/legacy/index.js` - Implementar lógica de filtragem
- **Testes**: `__test__/` - Criar testes unitários e de integração
- **Documentação**: `docs/` - Atualizar documentação do sistema de access

## 3. Análise de Viabilidade
### 3.1. Complexidade Estimada
**Média (5-8 pontos)**
- Modificação de schema existente (2 pontos)
- Implementação de lógica de filtragem (3 pontos)
- Testes unitários e de integração (2 pontos)
- Documentação (1 ponto)

### 3.2. Riscos Técnicos e Mitigações
**Risco**: Quebra de compatibilidade
- **Mitigação**: Propriedades opcionais no schema, comportamento padrão preservado

**Risco**: Impacto na performance
- **Mitigação**: Manter cache existente, otimizar consultas

**Risco**: Bugs em lógica de filtragem
- **Mitigação**: Testes abrangentes, validação de dados

### 3.3. Dependências
- Nenhuma dependência externa identificada
- Baseado em código existente e padrões estabelecidos

## 4. Resultados Esperados e Critérios de Aceite
### 4.1. Resultados Esperados
- Controle granular de listas e pivots no menu
- Flexibilidade na configuração de acesso por módulo
- Melhor experiência do usuário com menus mais organizados
- Manutenção da compatibilidade com implementação existente

### 4.2. Critérios de Aceite Gerais
- ✅ Listas e pivots são filtrados corretamente baseado nas propriedades do access
- ✅ Módulos vazios aparecem no menu quando não há elementos para mostrar
- ✅ Comportamento existente é preservado quando propriedades não estão definidas
- ✅ Performance mantida com cache adequado
- ✅ Testes passam com cobertura adequada
- ✅ Documentação atualizada

## 5. Próximos Passos Imediatos
Aguardando aprovação do plano para detalhar tarefas no TASK.MD e iniciar implementação com TDD. 