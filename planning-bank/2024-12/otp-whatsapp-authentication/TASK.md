# TASK.MD - OTP WhatsApp Authentication

## Tarefas Principais

### ✅ 1. Constantes e Configuração
- [x] Adicionar constantes OTP em `src/imports/consts.js`
- [x] Extender schema Namespace com `otpConfig`

### ✅ 2. Collection OtpRequest (Programática)
- [x] Criar `src/imports/auth/otp/init.ts` para gerenciamento programático
- [x] Implementar `initializeOtpRequestCollection()` com versionamento
- [x] Implementar `getOtpRequestCollection()` para acesso à collection
- [x] Configurar índices programaticamente (TTL, lookup phone, lookup email, unique phone, unique email)
- [x] Adicionar `otpRequestCollectionVersion` no Namespace
- [x] **Removido**: `src/private/metadata/OtpRequest.json` (não é metadata Konecty)

### ✅ 3. Serviços Core
- [x] Implementar `src/imports/auth/otp/index.ts`
  - [x] generateOTP()
  - [x] hashOTP()
  - [x] verifyOTP()
  - [x] createOtpRequest() - suporta telefone ou email, com rate limiting em transação
  - [x] findValidOtpRequest() - busca por telefone ou email
  - [x] incrementAttempts()
  - [x] removeOtpRequest() - remove OTP após verificação (substituiu markAsVerified)
  - [x] hasExceededMaxAttempts()

### ✅ 4. Serviços de Entrega
- [x] Implementar `src/imports/auth/otp/whatsapp.ts`
  - [x] sendOtpViaWhatsApp()
  - [x] Integração com Meta WhatsApp Business API
  - [x] API URL configurável via Handlebars template
  - [x] Language code configurável (padrão pt_BR)
  - [x] businessAccountId opcional
- [x] Implementar `src/imports/auth/otp/delivery.ts`
  - [x] sendOtp() com entrega por canal (telefone: WhatsApp → RabbitMQ, email: apenas email)
  - [x] sendViaWhatsApp()
  - [x] sendViaRabbitMQ() - inclui email do usuário na mensagem
  - [x] sendViaEmail() - prioriza email da solicitação

### ✅ 5. API Endpoints
- [x] Implementar `src/server/routes/api/auth/otp.ts`
  - [x] POST `/api/auth/request-otp` - aceita telefone ou email
  - [x] POST `/api/auth/verify-otp` - aceita telefone ou email
  - [x] Rate limiting no banco de dados (transações)
  - [x] Validação E.164 para telefone
  - [x] Validação de formato para email
  - [x] Logging adequado (phoneUsed ou emailUsed)
  - [x] Função extractIp() para normalização de IP
  - [x] findUserByPhone() usando BluebirdPromise.map com concurrency
  - [x] findUserByEmail() para busca por email

### ✅ 6. Integração
- [x] Registrar rotas em `src/server/routes/index.ts`
- [x] Criar template de email `src/private/templates/email/otp.html`

### ✅ 7. Testes
- [x] Testes unitários OTP (`__test__/auth/otp/otp.test.ts`)
- [x] Testes unitários WhatsApp (`__test__/auth/otp/whatsapp.test.ts`)
- [x] Testes unitários Delivery (`__test__/auth/otp/delivery.test.ts`)
- [x] Testes unitários Rate Limiting (`__test__/auth/otp/rateLimiting.test.ts`)
- [x] Testes integração Request (`__test__/auth/otp/requestOtp.test.ts`)
- [x] Testes integração Verify (`__test__/auth/otp/verifyOtp.test.ts`)
- [x] Testes end-to-end (`__test__/auth/otp/endToEnd.test.ts`)

### ✅ 8. Documentação
- [x] Criar PLANNING.md
- [x] Criar TASK.md
- [ ] Atualizar documentação de API (quando disponível)

## Status
- ✅ Implementação completa
- ✅ Testes criados
- ✅ Collection OtpRequest gerenciada programaticamente
- ✅ Índices configurados programaticamente
- ✅ Suporte a telefone e email
- ✅ Rate limiting distribuído (banco de dados)
- ✅ Padrões de código aplicados (sem let, métodos de array, BluebirdPromise.map)
- ⏳ Testes precisam ser executados e validados
- ⏳ Documentação de API precisa ser atualizada

## Observações
- **Índices MongoDB**: Criados programaticamente na primeira criação de OTP (versionamento via Namespace)
- **Configuração do Namespace**: Deve ser feita manualmente ou via API
- **Template de email**: Padrão `email/otp.html`
- **Rate limiting**: Implementado no banco de dados com transações (funciona em múltiplas instâncias)
- **Collection OtpRequest**: Não é metadata Konecty, é gerenciada programaticamente
- **Suporte a email**: Além de telefone, usuários podem solicitar OTP por email
- **Entrega por canal**: 
  - Se solicitado por telefone: WhatsApp → RabbitMQ (sem fallback para email)
  - Se solicitado por email: Apenas email (não tenta WhatsApp)
- **Remoção de OTP**: OTP é deletado imediatamente após verificação (não marcado como verificado)
- **Padrões de código**: Sem `let`, apenas métodos de array, BluebirdPromise.map com concurrency
- **Configurações**: WhatsApp API URL, language code, emailFrom, businessAccountId (opcional) configuráveis

## Descobertas Durante Revisão

### Mudanças Arquiteturais
1. **OtpRequest não é metadata**: Removido `OtpRequest.json`, collection gerenciada programaticamente
2. **Rate limiting distribuído**: Implementado no banco com transações em vez de memória
3. **Suporte a email**: Endpoints aceitam telefone ou email
4. **Remoção imediata**: OTP deletado após verificação (não marcado como verificado)
5. **Configurações avançadas**: API URL template, language code, emailFrom configuráveis

### Padrões de Código Aplicados
1. **Zero `let`**: Apenas `const` usado em todo código
2. **Métodos de array**: `map`, `find`, `reduce` em vez de loops `for`
3. **BluebirdPromise.map**: Com controle de concorrência (`OTP_COUNTRY_CODE_SEARCH_CONCURRENCY = 3`)
4. **Constantes**: Todas as magic numbers substituídas por constantes nomeadas

### Melhorias de Funcionalidade
1. **sendViaEmail**: Prioriza email da solicitação sobre email do usuário
2. **sendViaRabbitMQ**: Inclui email do usuário na mensagem para contexto
3. **findUserByPhone**: Usa BluebirdPromise.map com concurrency para buscar country codes
4. **Transações**: Rate limiting e criação de OTP em transação atômica

