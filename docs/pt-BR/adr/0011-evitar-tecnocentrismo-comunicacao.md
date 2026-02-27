# ADR-0011: Evitar Tecnocentrismo na Comunicação com Usuários

> Decisão arquitetural sobre linguagem empática e não tecnocêntrica em respostas da API e mensagens que podem chegar ao usuário final

---

## Status

**Aceito**

Data: 2026-02

Origem: Adaptado do [ADR-0024 do frontend (konecty-ui)](https://github.com/konecty/konecty-ui/blob/main/docs/adr/0024-evitar-tecnocentrismo-comunicacao.md) para API e mensagens de erro do backend.

---

## Contexto

As respostas da API e mensagens de erro do backend são consumidas pelo frontend e exibidas ao usuário final, ou expostas a integrações. Linguagem técnica ou cheia de jargão pode criar barreiras e confusão.

### Problema Identificado

- **Tecnocentrismo**: Termos como "validation failed", "invalid payload", "query execution error" são claros para desenvolvedores, não para usuários finais
- **Falta de empatia**: Mensagens que dizem o que falhou sem explicar o que o usuário pode fazer
- **Inconsistência**: Mistura de mensagens técnicas e amigáveis entre endpoints
- **Fricção no suporte**: Usuários finais não conseguem descrever o problema quando as mensagens são muito técnicas

### Exemplo

**Antes (Tecnocêntrico)**:
```json
{ "success": false, "errors": [{ "message": "Zod validation failed at relations.0.aggregators" }] }
```

**Depois (Amigável, com código para suporte)**:
```json
{ "success": false, "errors": [{ "message": "Invalid query. Please check that each relation has at least one aggregator defined.", "code": "CROSS_QUERY_VALIDATION" }] }
```

---

## Decisão

Adotar uma abordagem **empática e clara** para toda comunicação voltada ao usuário a partir do backend:

1. **Evitar jargão técnico nas mensagens da API**: Usar linguagem simples que explique o que está errado ou o que o usuário pode fazer
2. **Usar códigos de erro para suporte**: Manter um `code` estável (ex.: `CROSS_QUERY_VALIDATION`) para suporte técnico e logs; a mensagem é para o usuário
3. **Logs podem permanecer técnicos**: Logs internos e campo `details` podem usar termos técnicos para depuração
4. **Consistência com ADR-0009**: Seguir a estrutura centralizada de erros (mensagem amigável, code, details opcional) e estendê-la a todos os novos endpoints
5. **Idioma único no backend**: Mensagens em inglês (padrão do backend); frontend ou cliente é responsável por tradução quando necessário

### Implementação

- **Retornos de erro**: Usar `errorReturn([{ message, code?, details? }])` com `message` amigável e `code` estável. Colocar contexto técnico em `details` ou apenas em logs.
- **Erros de validação**: Em vez de expor caminhos de schema (ex.: "relations.0.aggregators"), retornar mensagem curta e acionável e um code.
- **Falhas genéricas**: Evitar stack traces crus ou "Internal server error" sem code; usar mensagem genérica mas clara e um code para o suporte correlacionar com logs.

---

## Consequências

### Positivas

- Melhor experiência para usuários finais e integradores
- Suporte e depuração mais claros via códigos estáveis
- Consistência com ADR-0009 e ADR-0024 do frontend
- Backend permanece responsável pela clareza; frontend pela tradução e apresentação

### Negativas

- Exige disciplina para escrever mensagens em duas “vozes”: para o usuário (clara) e para logs (técnica)
- Alguns endpoints legados podem ainda retornar mensagens técnicas até serem atualizados

### Neutras

- ADR-0009 já fornece a estrutura; este ADR acrescenta o princípio (evitar tecnocentrismo) e o estende a todo texto voltado ao usuário

---

## Referências

- [ADR-0009: Estrutura de Mensagens de Erro no Backend](./0009-estrutura-mensagens-erro-backend.md)
- [graphErrors.ts](../../src/imports/utils/graphErrors.ts) — exemplo de mensagens amigáveis e códigos
- Frontend ADR-0024: Evitar tecnocentrismo na comunicação (konecty-ui) — documento de origem

---

_Autores: Equipe Konecty_
