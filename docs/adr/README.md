# Registros de Decisão de Arquitetura (RDA)

Este diretório contém os Registros de Decisão de Arquitetura (RDAs) do projeto Konecty Backend.

## O que são RDAs?

RDAs são documentos leves que capturam decisões arquiteturais importantes junto com seu contexto e consequências. Eles servem como memória arquitetural do projeto, ajudando a equipe a entender:

- **Por que** decisões foram tomadas (não apenas o que)
- **Quais alternativas** foram consideradas
- **Quais trade-offs** foram aceitos
- **Como** o sistema evoluiu ao longo do tempo

## Quando criar um RDA?

Crie um RDA quando você estiver:

- Fazendo escolhas tecnológicas significativas (bancos de dados, frameworks, ferramentas)
- Projetando arquitetura de serviços ou APIs
- Estabelecendo padrões ou convenções para a equipe
- Avaliando trade-offs entre múltiplas abordagens
- Tomando decisões que impactarão desenvolvimento futuro

## Como criar um RDA?

1. **Use a Skill de RDA no Cursor**: Digite `/registro-decisao-arquitetura` para ativar a skill
2. **Copie o template**: Use o arquivo em `.cursor/skills/registro-decisao-arquitetura/templates/rda-template.md`
3. **Atribua número sequencial**: Verifique o último RDA e use o próximo número (ex: RDA-0003)
4. **Preencha todas as seções**:
   - Contexto: Problema, requisitos, restrições
   - Decisão: O que, por quê, como, quem, quando
   - Consequências: Positivas, negativas, neutras
   - Alternativas: Pelo menos 2, com prós/contras
5. **Revise com a equipe**: Use o checklist em `.cursor/skills/registro-decisao-arquitetura/checklists/checklist-revisao-rda.md`
6. **Obtenha aprovações**: Arquitetos, Tech Leads, DevOps, Product
7. **Commit no repositório**: Adicione o RDA ao controle de versão

## Estrutura dos RDAs

```
docs/adr/
├── README.md (este arquivo)
├── rda-0001-titulo-decisao.md
├── rda-0002-titulo-decisao.md
└── rda-0003-titulo-decisao.md
```

## Nomenclatura

- **Formato**: `rda-####-titulo-breve.md`
- **Número**: 4 dígitos com zeros à esquerda (0001, 0002, etc)
- **Título**: Breve, descritivo, com hífens separando palavras
- **Exemplos**:
  - `rda-0001-migrar-nodejs-express.md`
  - `rda-0002-adicionar-postgresql.md`
  - `rda-0003-estrategia-cache-redis.md`

## Estados de RDA

- **Proposto**: Em revisão, ainda não aprovado
- **Aceito**: Aprovado e sendo implementado
- **Implementado**: Em produção
- **Substituído**: Substituído por RDA mais recente (referenciar número)
- **Depreciado**: Não mais recomendado mas ainda não substituído
- **Rejeitado**: Considerado mas não adotado (documentar porquê)

## Recursos

- **Skill completa**: `.cursor/skills/registro-decisao-arquitetura/SKILL.md`
- **Template**: `.cursor/skills/registro-decisao-arquitetura/templates/rda-template.md`
- **Exemplos**: `.cursor/skills/registro-decisao-arquitetura/examples/`
- **Checklist**: `.cursor/skills/registro-decisao-arquitetura/checklists/checklist-revisao-rda.md`

## Índice de RDAs

<!-- Adicione novos RDAs aqui -->

| # | Título | Status | Data | Autores |
|---|--------|--------|------|---------|
| Em breve | Primeiro RDA do projeto | - | - | - |

---

**Nota**: Este diretório é mantido pela equipe de arquitetura. Para dúvidas sobre RDAs, consulte a skill de RDA no Cursor ou fale com o Tech Lead.
