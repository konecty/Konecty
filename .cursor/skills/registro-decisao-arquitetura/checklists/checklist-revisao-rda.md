# Checklist de Revisão de RDA

Use este checklist ao revisar Registros de Decisão de Arquitetura antes de aceitá-los.

## Checklist Pré-Revisão

Antes de distribuir RDA para revisão, o autor deve verificar:

- [ ] **Número do RDA**: Número sequencial de 4 dígitos atribuído (verificar RDAs existentes)
- [ ] **Localização do Arquivo**: Colocado em `/docs/adr/`
- [ ] **Nomenclatura**: Segue formato `rda-####-titulo-breve.md`
- [ ] **Status**: Definido como "Proposto" (ainda não "Aceito")
- [ ] **Data**: Data atual no formato YYYY-MM-DD
- [ ] **Autores**: Todos contribuidores listados com papéis
- [ ] **Formatação**: Markdown renderiza corretamente, sem links quebrados
- [ ] **Template**: Segue estrutura padrão do template RDA

---

## Checklist de Qualidade do Conteúdo

### 1. Seção de Contexto

- [ ] **Problema é Claro**: Qualquer pessoa pode entender o que precisa ser resolvido
- [ ] **Estado Atual Documentado**: O que existe hoje está explicado
- [ ] **Requisitos Listados**: Necessidades de negócio e técnicas especificadas
- [ ] **Restrições Identificadas**: Limitações explícitas (orçamento, tempo, tech, skills)
- [ ] **Forças Explicadas**: Preocupações ou trade-offs concorrentes descritos
- [ ] **Stakeholders Identificados**: Quem se importa com esta decisão?

**Indicadores de Qualidade:**
- ✅ Contexto tem 3-5 parágrafos (nem muito breve, nem verboso)
- ✅ Alguém não familiarizado com o problema pode entendê-lo
- ✅ Dados quantitativos fornecidos quando relevante (usuários, carga, custos)
- ✅ Nenhum detalhe de solução vazado no contexto (permanece focado no problema)

### 2. Seção de Decisão

- [ ] **Decisão é Específica**: Claro o que está sendo adotado
- [ ] **Stack Tecnológico Nomeado**: Versões e ferramentas específicas listadas
- [ ] **Estratégia de Implementação Definida**: Como isso será implementado
- [ ] **Cronograma Fornecido**: Quando implementação inicia e completa
- [ ] **Responsabilidades Atribuídas**: Quem é dono de quais aspectos
- [ ] **Critérios de Sucesso**: Como saberemos que funciona (opcional mas recomendado)

**Indicadores de Qualidade:**
- ✅ Decisão usa linguagem ativa e declarativa ("Nós adotaremos...")
- ✅ Sem ambiguidade (outro time poderia implementar a partir deste RDA)
- ✅ Escopo é claro (o que está incluído, o que não está)
- ✅ Critérios de entrada especificados se abordagem em fases

**Sinais de Alerta:**
- ❌ Linguagem vaga: "Consideraremos usar..." ou "Talvez tentemos..."
- ❌ Sem cronograma: "Eventualmente implementaremos isso"
- ❌ Sem propriedade: "Alguém deveria fazer isso"

### 3. Seção de Consequências

- [ ] **Resultados Positivos Listados**: Benefícios explícitos (pelo menos 3)
- [ ] **Resultados Negativos Listados**: Custos, riscos, trade-offs documentados (pelo menos 3)
- [ ] **Resultados Neutros Listados**: Mudanças que não são claramente positivas/negativas
- [ ] **Avaliação Honesta**: Não apenas vendendo a decisão, mas balanceada
- [ ] **Quantificado Quando Possível**: Números fornecidos (latência, custo, tempo)

**Indicadores de Qualidade:**
- ✅ Negativos são substanciais e honestos, não triviais
- ✅ Cada consequência explica "por que importa"
- ✅ Impacto operacional considerado (monitoramento, debugging, on-call)
- ✅ Consequências de longo prazo abordadas (não apenas curto prazo)

**Sinais de Alerta:**
- ❌ Apenas consequências positivas listadas
- ❌ Negativos são minimizados ou descartados
- ❌ Nenhuma menção à complexidade operacional
- ❌ Consequências vagas: "Pode ser mais difícil..." vs "Adicionará 10-50ms de latência"

### 4. Seção de Alternativas

- [ ] **Pelo Menos 2 Alternativas**: Requisito mínimo
- [ ] **Alternativas São Reais**: Realmente consideradas, não espantalhos
- [ ] **Descrição Fornecida**: O que cada alternativa envolve
- [ ] **Prós Listados**: Vantagens de cada alternativa (pelo menos 2)
- [ ] **Contras Listados**: Desvantagens de cada alternativa (pelo menos 2)
- [ ] **Justificativa de Rejeição**: Explicação clara de por que não foi escolhida
- [ ] **Comparativo**: Alternativas comparadas com solução escolhida

**Indicadores de Qualidade:**
- ✅ "Não fazer nada" ou "Status quo" considerado como alternativa
- ✅ Alternativas abrangem diferentes abordagens (não apenas variações de vendor)
- ✅ Cada alternativa tem detalhes suficientes para entender trade-offs
- ✅ Justificativa de rejeição é específica, não genérica

**Sinais de Alerta:**
- ❌ Apenas 1 alternativa (deveria ter pelo menos 2)
- ❌ Alternativas são claramente inferiores (espantalhos)
- ❌ Justificativa de rejeição é "Apenas gostamos mais da outra"
- ❌ Prós/contras são desbalanceados (solução escolhida tem 10 prós, alternativas têm 1)

### 5. Seção de Referências (Opcional mas Recomendado)

- [ ] **Links de Discussão**: Threads Slack, notas de reunião, email chains
- [ ] **Fontes de Pesquisa**: Artigos, livros, documentação consultados
- [ ] **RDAs Relacionados**: Outras decisões que influenciaram esta
- [ ] **Prova de Conceito**: Link para implementação PoC ou resultados de spike
- [ ] **Análise de Custo**: Planilhas ou documentos com projeções de custo

---

## Critérios de Revisão de Arquitetura

### Viabilidade Técnica

- [ ] **Tecnicamente Sólido**: Solução é viável com estado atual da tecnologia
- [ ] **Escalabilidade**: Aborda requisitos de escala (usuários, dados, transações)
- [ ] **Performance**: Atende necessidades de latência, throughput e responsividade
- [ ] **Segurança**: Implicações de segurança consideradas e abordadas
- [ ] **Confiabilidade**: Modos de falha e estratégias de recuperação documentados
- [ ] **Manutenibilidade**: Carga de manutenção de longo prazo é aceitável
- [ ] **Testabilidade**: Pode ser testado efetivamente (unit, integration, E2E)

### Alinhamento com Negócio

- [ ] **Suporta Objetivos**: Alinha com direção estratégica da empresa/produto
- [ ] **Custo Justificado**: ROI ou proposição de valor é clara
- [ ] **Cronograma Realista**: Janela de implementação é alcançável
- [ ] **Disponibilidade de Recursos**: Equipe tem skills (ou pode adquiri-las)
- [ ] **Risco Aceitável**: Riscos são compreendidos e dentro da tolerância

### Considerações Operacionais

- [ ] **Estratégia de Deploy**: Como isso vai para produção está claro
- [ ] **Plano de Monitoramento**: Como observaremos isso em produção
- [ ] **Plano de Rollback**: Como desfazer se falhar
- [ ] **Necessidades de Treinamento**: Equipe sabe como trabalhar com isso
- [ ] **Documentação**: Suficiente para manutenção contínua
- [ ] **Impacto no On-Call**: Efeito no time de operações compreendido

### Conformidade e Padrões

- [ ] **Padrões de Código**: Segue convenções do time/org
- [ ] **Padrões de Segurança**: Atende políticas de segurança
- [ ] **Requisitos de Conformidade**: Necessidades regulatórias abordadas (LGPD, etc)
- [ ] **Princípios de Arquitetura**: Consistente com princípios existentes
- [ ] **Technology Radar**: Alinha com escolhas tecnológicas aprovadas

---

## Aprovação de Stakeholders

Aprovações necessárias (customize baseado em sua organização):

### Aprovações Técnicas

- [ ] **Arquiteto Chefe/Principal**: Coerência arquitetural geral
- [ ] **Arquiteto de Domínio**: Expertise de domínio específico (frontend, backend, data, security)
- [ ] **Tech Lead**: Viabilidade de implementação
- [ ] **DevOps/SRE**: Viabilidade operacional

### Aprovações de Negócio

- [ ] **Gerente de Engenharia**: Alocação de recursos e cronograma
- [ ] **Product Manager**: Valor de negócio e prioridade
- [ ] **Time de Segurança**: Implicações de segurança (se aplicável)
- [ ] **Time de Conformidade**: Requisitos regulatórios (se aplicável)

### Aprovações Opcionais (dependendo do escopo)

- [ ] **CTO/VP Engenharia**: Decisões estratégicas
- [ ] **Financeiro**: Impactos grandes de custo (>$50k)
- [ ] **Jurídico**: Licenciamento, contratos, considerações de IP

---

## Feedback Comum de Revisão

### Problemas de Contexto

- "Não entendo o problema que estamos resolvendo"
  - **Correção**: Adicionar mais background, quantificar os pontos de dor

- "Esses requisitos são do Product ou suposições?"
  - **Correção**: Clarificar fonte de cada requisito, validar com stakeholders

- "Qual é a urgência? Isso pode esperar?"
  - **Correção**: Adicionar impacto no negócio e drivers de cronograma

### Problemas de Decisão

- "Isso parece vago demais para implementar"
  - **Correção**: Adicionar tecnologias específicas, versões e passos de implementação

- "Quem vai realmente fazer isso?"
  - **Correção**: Atribuir propriedade clara com nomes/papéis

- "E se precisarmos mudar isso depois?"
  - **Correção**: Documentar extensibilidade, planejar para evolução

### Problemas de Consequências

- "Você está mostrando apenas o lado positivo"
  - **Correção**: Adicionar trade-offs honestos, custos e riscos

- "E quanto à complexidade operacional?"
  - **Correção**: Documentar monitoramento, debugging, implicações de on-call

- "Como isso afeta outros times?"
  - **Correção**: Avaliar impacto cross-team, necessidades de comunicação

### Problemas de Alternativas

- "Essas alternativas parecem espantalhos"
  - **Correção**: Apresentar alternativas de forma justa, com prós/contras genuínos

- "Por que você não considerou [alternativa óbvia]?"
  - **Correção**: Adicionar alternativas faltantes, explicar processo de avaliação

- "Discordo do seu raciocínio"
  - **Correção**: Revisitar justificativa da decisão, possivelmente reconsiderar

---

## Ações Pós-Revisão

Após aprovação:

- [ ] **Atualizar Status**: Mudar de "Proposto" para "Aceito"
- [ ] **Adicionar Datas de Aprovação**: Documentar quando cada stakeholder aprovou
- [ ] **Commit no Repositório**: Fazer merge do RDA na branch principal
- [ ] **Comunicar**: Anunciar RDA aceito para times relevantes
- [ ] **Vincular na Implementação**: Referenciar RDA em PRs/tickets
- [ ] **Atualizar Índice**: Adicionar ao índice ou tabela de conteúdos de RDAs
- [ ] **Agendar Revisão**: Lembrete no calendário para revisar efetividade em 3-6 meses

---

## Critérios de Rejeição de RDA

Quando rejeitar um RDA (requer reescrita):

### Falhas Fatais

- ❌ **Decisão é Prematura**: Não há informação suficiente para decidir ainda
- ❌ **Problema Indefinido**: Não consegue entender o que está sendo resolvido
- ❌ **Sem Alternativas**: Apenas uma opção apresentada
- ❌ **Não Justificado**: Justificativa da decisão é fraca ou faltando
- ❌ **Irrealista**: Cronograma, orçamento ou skills são inviáveis
- ❌ **Escopo Errado**: Muito grande (quebrar em múltiplos RDAs) ou muito pequeno (não vale RDA)

### Problemas Sérios

- ⚠️ **Análise Insuficiente**: Trade-offs não explorados profundamente o suficiente
- ⚠️ **Stakeholders Faltando**: Pessoas chave não foram consultadas
- ⚠️ **Conflito com Estratégia**: Não alinha com direção da org
- ⚠️ **Riscos Não Abordados**: Riscos principais não reconhecidos ou mitigados
- ⚠️ **Problemas de Conformidade**: Problemas regulatórios não resolvidos

### Problemas de Processo

- ⚠️ **Revisão Ignorada**: RDA criado após decisão já tomada
- ⚠️ **Template Incompleto**: Seções principais faltando
- ⚠️ **Qualidade Pobre**: Escrita confusa, problemas de formatação

---

## Dicas para Reunião de Revisão

**Antes da Reunião:**
- [ ] Compartilhar RDA pelo menos 48 horas antes
- [ ] Solicitar que revisores leiam antes da reunião
- [ ] Preparar para responder perguntas sobre alternativas e trade-offs

**Durante a Reunião:**
- [ ] Apresentar contexto e decisão claramente (5-10 minutos)
- [ ] Explicar alternativas e por que não foram escolhidas
- [ ] Abordar questões e preocupações
- [ ] Documentar feedback e itens de ação
- [ ] Buscar consenso, não apenas maioria

**Após a Reunião:**
- [ ] Incorporar feedback em 1 semana
- [ ] Recompartilhar RDA revisado para aprovação final
- [ ] Não "aceitar" RDA até preocupações serem abordadas

---

## Histórico de Versão

- **v1.0.0** (2026-01-26): Checklist inicial em português brasileiro
- Template mantido por: Equipe Konecty
- Skill: registro-decisao-arquitetura v1.0.0
