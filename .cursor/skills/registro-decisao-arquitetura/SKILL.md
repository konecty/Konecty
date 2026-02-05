---
name: registro-decisao-arquitetura
description: Use esta skill ao documentar decisões arquiteturais significativas. Fornece templates de RDA seguindo o formato Nygard com seções para contexto, decisão, consequências e alternativas. Ajuda equipes a manter memória arquitetural e justificativas para sistemas backend, designs de API, escolhas de banco de dados e decisões de infraestrutura.
---

# Registro de Decisão de Arquitetura (RDA)

## Visão Geral

Registros de Decisão de Arquitetura (RDAs) são documentos leves que capturam decisões arquiteturais importantes junto com seu contexto e consequências. Esta skill fornece templates, exemplos e melhores práticas para criar e manter RDAs nos projetos Konecty.

**Quando usar esta skill:**
- Fazer escolhas tecnológicas significativas (bancos de dados, frameworks, provedores cloud)
- Projetar arquitetura de sistema ou componentes principais
- Estabelecer padrões ou convenções para a equipe
- Avaliar trade-offs entre múltiplas abordagens
- Documentar decisões que impactarão desenvolvimento futuro

## Por que RDAs Importam

RDAs servem como memória arquitetural para sua equipe:
- **Preservação de Contexto**: Captura o porquê das decisões, não apenas o que foi decidido
- **Onboarding**: Ajuda novos membros a entenderem a lógica arquitetural
- **Evita Retrabalho**: Previne debates intermináveis sobre decisões já tomadas
- **Rastreia Evolução**: Mostra como a arquitetura evoluiu ao longo do tempo
- **Responsabilidade**: Clara propriedade e cronograma de decisões

## Formato do RDA (Template Nygard)

Cada RDA deve seguir esta estrutura:

### 1. Título
Formato: `RDA-####: [Título da Decisão]`
Exemplo: `RDA-0001: Adotar React 18 com TypeScript para Frontend`

### 2. Status
Estado atual da decisão:
- **Proposto**: Em consideração
- **Aceito**: Decisão aprovada e sendo implementada
- **Substituído**: Substituído por decisão posterior (referenciar número do RDA)
- **Depreciado**: Não mais recomendado mas ainda não substituído
- **Rejeitado**: Considerado mas não adotado (documentar o porquê)

### 3. Contexto
**O que incluir:**
- Declaração do problema ou oportunidade
- Restrições técnicas/negócio
- Requisitos dos stakeholders
- Estado atual do sistema
- Forças em jogo (preocupações conflitantes)

**Exemplo:**
```markdown
## Contexto

Nossa aplicação frontend está crescendo em complexidade:
- Componentes com lógica de estado complexa e difícil manutenção
- Performance degradada com +1000 componentes em tela
- Equipe dividida entre desenvolvedores que conhecem React e outros frameworks
- Necessidade de TypeScript para reduzir bugs em produção

Requisitos de negócio:
- Suportar 5000+ usuários simultâneos
- Permitir desenvolvimento rápido de novas funcionalidades
- Reduzir bugs de tipagem em 80%

Restrições técnicas:
- Equipe experiente em React e TypeScript
- Infraestrutura já preparada para SPAs
- Orçamento limitado para treinamento
```

### 4. Decisão
**O que incluir:**
- A escolha sendo feita
- Princípios ou padrões chave a seguir
- O que mudará como resultado
- Quem é responsável pela implementação

**Seja específico e acionável:**
- ✅ "Adotaremos React 18+ com TypeScript 5+ para todo novo desenvolvimento frontend"
- ❌ "Consideraremos usar React"

### 5. Consequências
**O que incluir:**
- Resultados positivos (benefícios)
- Resultados negativos (custos, riscos, trade-offs)
- Resultados neutros (mudanças que não são claramente melhores/piores)

**Seja honesto sobre trade-offs:**
```markdown
## Consequências

### Positivas
- **Type Safety**: Redução de 80% em bugs de tipagem
- **Produtividade**: Hooks e componentes funcionais aumentam velocidade
- **Ecossistema**: Vasta biblioteca de componentes disponíveis
- **Performance**: Concurrent rendering melhora UX

### Negativas
- **Curva de Aprendizado**: 2-3 meses para dominar hooks avançados
- **Tamanho do Bundle**: Aumento de 50KB no bundle inicial
- **Complexidade de State**: Necessidade de Redux ou Context API

### Neutras
- **Ferramentas**: Mudança de Vue DevTools para React DevTools
- **Testes**: Migração de testes para React Testing Library
```

### 6. Alternativas Consideradas
**Documente pelo menos 2 alternativas:**

**Para cada alternativa, explique:**
- O que era
- Por que foi considerada
- Por que não foi escolhida

## Localização dos RDAs no Projeto

### Frontend (konecty-ui)
- **Localização**: `/docs/adr/`
- **Foco**: Decisões de UI/UX, state management, bibliotecas frontend

### Backend (Konecty)
- **Localização**: `/docs/adr/`
- **Foco**: Decisões de API, banco de dados, arquitetura de serviços

## Ciclo de Vida do RDA

```
Proposto → Aceito → [Implementado] → (Eventualmente) Substituído/Depreciado
          ↓
      Rejeitado
```

**Transições de Estado:**
1. **Proposto**: Rascunho criado, sob revisão
2. **Aceito**: Equipe concorda, implementação pode começar
3. **Implementado**: Decisão está em produção
4. **Substituído**: Substituído por novo RDA (adicionar referência)
5. **Depreciado**: Não mais recomendado (caminho de migração documentado)
6. **Rejeitado**: Não adotado (raciocínio capturado)

## Melhores Práticas

### 1. **Mantenha RDAs Imutáveis**
Uma vez aceitos, não edite RDAs. Crie novos RDAs que substituem os antigos.
- ✅ Criar RDA-0015 que substitui RDA-0003
- ❌ Atualizar RDA-0003 com novas decisões

### 2. **Escreva no Tempo Presente**
RDAs são registros históricos escritos como se a decisão estivesse sendo tomada agora.
- ✅ "Adotaremos React 18"
- ❌ "Adotamos React 18"

### 3. **Foque no 'Por Quê', Não no 'Como'**
RDAs capturam decisões, não detalhes de implementação.
- ✅ "Escolhemos PostgreSQL pela consistência relacional"
- ❌ "Configure PostgreSQL com estas configurações específicas..."

### 4. **Revise RDAs em Equipe**
Obtenha input de stakeholders relevantes antes de aceitar.
- Arquitetos: Viabilidade técnica
- Desenvolvedores: Viabilidade de implementação
- Produto: Alinhamento com negócio
- DevOps: Preocupações operacionais

### 5. **Numere Sequencialmente**
Use números de 4 dígitos com zeros à esquerda: RDA-0001, RDA-0002, etc.
Mantenha uma única sequência mesmo com múltiplos projetos.

### 6. **Armazene no Git**
Mantenha RDAs no controle de versão junto com o código:
- **Localização**: `/docs/adr/`
- **Formato**: Markdown para fácil leitura
- **Branch**: Mesma branch da implementação

## Checklist de Início Rápido

- [ ] Copiar template RDA de `templates/rda-template.md`
- [ ] Atribuir próximo número sequencial (verificar RDAs existentes)
- [ ] Preencher Contexto: problema, restrições, requisitos
- [ ] Documentar Decisão: o que, por quê, como, quem
- [ ] Listar Consequências: positivas, negativas, neutras
- [ ] Descrever pelo menos 2 Alternativas: o que, prós/contras, por que não escolhida
- [ ] Adicionar Referências: discussões, pesquisas, RDAs relacionados
- [ ] Definir Status como "Proposto"
- [ ] Revisar com equipe
- [ ] Atualizar Status para "Aceito" após aprovação
- [ ] Vincular RDA no PR de implementação
- [ ] Atualizar Status para "Implementado" após deploy

## Armadilhas Comuns a Evitar

❌ **Muito Técnico**: "Usaremos Kubernetes com estas 50 configurações YAML..."
✅ **Nível Certo**: "Usaremos Kubernetes para orquestração de containers porque..."

❌ **Muito Vago**: "Usaremos um banco de dados melhor"
✅ **Específico**: "Usaremos PostgreSQL 15+ para dados transacionais porque..."

❌ **Sem Alternativas**: Documentar apenas a solução escolhida
✅ **Comparativo**: Documentar por que alternativas não foram escolhidas

❌ **Sem Consequências**: Listar apenas benefícios
✅ **Balanceado**: Honesto sobre custos e trade-offs

❌ **Sem Contexto**: "Decidimos usar Redis"
✅ **Contextual**: "Dados nossos 1M+ usuários simultâneos e requisito de latência sub-50ms..."

## Exemplos

Veja `examples/` para amostras completas de RDA:
- `rda-0001-adotar-react-typescript.md` - Decisão de frontend
- `rda-0002-escolher-postgresql.md` - Seleção de banco de dados
- `rda-0003-estrategia-versionamento-api.md` - Padrão de design de API

## Recursos Adicionais

- Para template completo, veja [templates/rda-template.md](templates/rda-template.md)
- Para checklist de revisão, veja [checklists/checklist-revisao-rda.md](checklists/checklist-revisao-rda.md)

---

**Versão da Skill**: 1.0.0
**Última Atualização**: 2026-01-26
**Mantido por**: Equipe Konecty
