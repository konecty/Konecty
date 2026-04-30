# ADR-0020: API Admin de Metadados (CRUD)

> Decisão arquitetural sobre endpoints restritos a administradores para leitura e edição de MetaObjects.

---

## Status

**Aceito**

Data: 2026-03-16

Versão em inglês: [docs/adr/0006-meta-crud-api.md](../../adr/0006-meta-crud-api.md).

---

## Contexto

Agentes de IA e ferramentas precisam de acesso programático para ler, criar, atualizar e excluir metadados do Konecty (documentos, listas, views, perfis de acesso, pivots, hooks, namespace). Os endpoints existentes em `/api/document` permitem operações básicas de meta, mas usam `checkMetaOperation`, ligado ao sistema de permissão `user.access.meta` pensado para edição via UI.

O projeto de meta skills exige endpoints dedicados, exclusivos para administradores, que ofereçam CRUD completo sobre todos os tipos de metadados na coleção `MetaObjects`, incluindo hooks e o singleton Namespace.

## Decisão

Criar um conjunto de endpoints sob `/api/admin/meta/*` com as seguintes características:

1. **Todos os endpoints exigem `user.admin === true`** — aplicado via hook `preHandler` do Fastify compartilhado por todas as rotas.
2. **Operações diretas no MongoDB** — leitura/escrita na coleção `MetaObjects` via `MetaObject.MetaObject`.
3. **Suporte a todos os tipos de meta**: document, composite, list, view, access, pivot, card, namespace.
4. **Sub-rotas dedicadas para hooks** — GET/PUT/DELETE específicos para os campos de hook nos metas de documento.
5. **Endpoint de reload** — `POST /api/admin/meta/reload` para disparar `loadMetaObjects()` após alterações.

### Endpoints

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET | `/api/admin/meta` | Listar todos os metas de documento/composite |
| GET | `/api/admin/meta/:document` | Listar todos os metas de um documento |
| GET | `/api/admin/meta/:document/:type/:name` | Obter um meta específico |
| GET | `/api/admin/meta/:document/hook/:hookName` | Obter código/JSON do hook |
| PUT | `/api/admin/meta/:document/:type/:name` | Criar ou atualizar meta |
| DELETE | `/api/admin/meta/:document/:type/:name` | Excluir meta |
| PUT | `/api/admin/meta/:document/hook/:hookName` | Atualizar hook |
| DELETE | `/api/admin/meta/:document/hook/:hookName` | Remover hook |
| POST | `/api/admin/meta/reload` | Recarregar todos os metadados |

## Alternativas consideradas

1. **Estender os endpoints existentes em `/api/document`** — rejeitado porque usam outro modelo de autenticação (`checkMetaOperation`) e misturar operações só-admin complicaria o controle de acesso.
2. **Acesso direto ao MongoDB a partir das skills** — rejeitado por contornar a lógica do servidor e exigir expor credenciais do banco a agentes.
3. **API GraphQL para metas** — rejeitado por YAGNI; REST é mais simples e suficiente.

## Consequências

- Usuários administradores passam a ter controle CRUD completo sobre metadados via API HTTP.
- Usuários não administradores não podem acessar esses endpoints.
- Após alterar metadados, pode ser necessário chamar reload (`POST /reload`) para as mudanças valerem no servidor em execução.
- As skills podem depender desses endpoints para todas as operações de metadados.

## Plano de implementação

1. Criar `src/server/routes/api/admin/meta/index.ts`.
2. Registrar o plugin em `/api/admin/meta` na rota admin existente.
3. Adicionar testes.
4. Abrir PR em draft contra `develop`.
5. Documentar em `docs/en/api.md`, `docs/pt-BR/api.md` e coleção Postman.

## Referências

- Model MetaObject: `src/imports/model/MetaObject.ts`
- API de documento existente: `src/server/routes/api/document/index.ts`
- API admin existente: `src/server/routes/api/admin/index.ts`
- Documentação da API (EN): [docs/en/api.md](../../en/api.md#7-admin-meta-api)
- Documentação da API (PT-BR): [docs/pt-BR/api.md](../api.md#7-api-admin-de-metadados)
