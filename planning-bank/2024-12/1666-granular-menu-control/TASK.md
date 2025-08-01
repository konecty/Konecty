# TASK.MD - Tarefas para Controle Granular de Listas e Pivots no Menu

## Backend

- [x] Atualizar schema MetaAccess para incluir novas propriedades
  - taskId: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - code: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - Link no Hub: <Formato: https://hub.konecty.dev/module/Task/list/Default/document/ID_DA_TAREFA_AQUI>
  - **Objetivo:** Adicionar propriedades opcionais `hideListsFromMenu` e `hidePivotsFromMenu` ao schema MetaAccess sem quebrar compatibilidade
  - **Critérios de Aceite:**
    - ✅ Schema aceita arrays de strings para as novas propriedades
    - ✅ Propriedades são opcionais e não quebram código existente
    - ✅ Validação adequada dos tipos de dados
  - **Referências:** `PLANNING.md`, `src/imports/model/MetaAccess.ts`
  - **Complexidade:** 2 pontos
  - **Detalhamento:** Modificar o schema para incluir as novas propriedades como arrays opcionais de strings
  - **Branch Git:** feature/update-metaaccess-schema

---

- [x] Implementar lógica de filtragem no endpoint menu/list
  - taskId: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - code: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - Link no Hub: <Formato: https://hub.konecty.dev/module/Task/list/Default/document/ID_DA_TAREFA_AQUI>
  - **Objetivo:** Implementar filtragem de listas e pivots baseada nas propriedades do access no endpoint `/rest/menu/list`
  - **Critérios de Aceite:**
    - ✅ Listas são filtradas baseado em `hideListsFromMenu`
    - ✅ Pivots são filtrados baseado em `hidePivotsFromMenu`
    - ✅ Usa propriedade `name` para identificação
    - ✅ Mantém cache similar ao código existente
    - ✅ Preserva comportamento quando propriedades não estão definidas
  - **Referências:** `PLANNING.md`, `src/imports/menu/legacy/index.js`
  - **Complexidade:** 3 pontos
  - **Detalhamento:** Modificar a função `menuFull` para implementar a lógica de filtragem
  - **Branch Git:** feature/implement-menu-filtering

---

- [ ] Criar testes unitários para schema MetaAccess
  - taskId: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - code: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - Link no Hub: <Formato: https://hub.konecty.dev/module/Task/list/Default/document/ID_DA_TAREFA_AQUI>
  - **Objetivo:** Criar testes unitários para validar as novas propriedades do schema MetaAccess
  - **Critérios de Aceite:**
    - ✅ Testes validam arrays de strings para as novas propriedades
    - ✅ Testes verificam que propriedades são opcionais
    - ✅ Testes cobrem casos de erro e sucesso
    - ✅ Cobertura adequada dos novos campos
  - **Referências:** `PLANNING.md`, `src/imports/model/MetaAccess.ts`
  - **Complexidade:** 2 pontos
  - **Detalhamento:** Criar testes no diretório `__test__/` seguindo padrão TDD
  - **Branch Git:** feature/test-metaaccess-schema

---

- [ ] Criar testes de integração para filtragem do menu
  - taskId: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - code: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - Link no Hub: <Formato: https://hub.konecty.dev/module/Task/list/Default/document/ID_DA_TAREFA_AQUI>
  - **Objetivo:** Criar testes de integração para validar a filtragem de listas e pivots no menu
  - **Critérios de Aceite:**
    - Testes validam filtragem correta de listas
    - Testes validam filtragem correta de pivots
    - Testes verificam comportamento quando propriedades não estão definidas
    - Testes cobrem diferentes cenários de access
  - **Referências:** `PLANNING.md`, `src/imports/menu/legacy/index.js`
  - **Complexidade:** 2 pontos
  - **Detalhamento:** Criar testes de integração para o endpoint menu/list
  - **Branch Git:** feature/test-menu-filtering

---

## Documentação

- [ ] Atualizar documentação do sistema de access
  - taskId: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - code: <A SER PREENCHIDO APÓS CRIAÇÃO NO HUB>
  - Link no Hub: <Formato: https://hub.konecty.dev/module/Task/list/Default/document/ID_DA_TAREFA_AQUI>
  - **Objetivo:** Atualizar documentação para incluir as novas propriedades do sistema de access
  - **Critérios de Aceite:**
    - Documentação explica as novas propriedades
    - Inclui exemplos de uso
    - Mantém consistência com documentação existente
    - Atualiza tanto versão em inglês quanto português
  - **Referências:** `PLANNING.md`, `docs/en/access.md`, `docs/pt-BR/access.md`
  - **Complexidade:** 1 ponto
  - **Detalhamento:** Atualizar arquivos de documentação do access
  - **Branch Git:** feature/update-access-docs 