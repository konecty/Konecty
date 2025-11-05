# PLANNING.MD - OTP WhatsApp Authentication

## 🏢 Dados da Tarefa Principal no Konecty Hub
- taskId: <A SER PREENCHIDO APÓS CONEXÃO COM HUB>
- code: <A SER PREENCHIDO APÓS CONEXÃO COM HUB>
- Link no Hub: <A SER PREENCHIDO APÓS CONEXÃO COM HUB>
- Cliente: <A SER PREENCHIDO APÓS CONEXÃO COM HUB>
- Projeto: <A SER PREENCHIDO APÓS CONEXÃO COM HUB>

## 1. Contexto
### 1.1. Motivação
Implementar autenticação via OTP (One-Time Password) usando WhatsApp Business API como método principal para telefones, com fallback para RabbitMQ. Para emails, o sistema envia diretamente por email. O sistema permitirá que usuários façam login usando qualquer número de telefone cadastrado ou email, sem necessidade de senha, seguindo o padrão estabelecido no documento de autenticação do projeto Foxter.

### 1.2. Problemas que Resolvemos
- Autenticação sem senha via OTP
- Suporte a múltiplos números de telefone por usuário
- Suporte a email como método alternativo de solicitação
- Rastreabilidade de qual telefone ou email foi usado no login
- Integração com WhatsApp Business API (Meta oficial)
- Fallback para RabbitMQ quando WhatsApp não disponível (apenas para solicitações por telefone)
- Logging adequado nos AccessLog e AccessFailedLog
- Token retornado no body (sem cookies) para APIs
- Rate limiting distribuído (funciona em múltiplas instâncias)

### 1.3. Solução Proposta
Implementar dois endpoints:
- `POST /api/auth/request-otp`: Solicita OTP para um número de telefone ou email
- `POST /api/auth/verify-otp`: Verifica OTP e realiza login

Criar collection OtpRequest gerenciada programaticamente (não como metadata Konecty) para armazenar requisições de OTP com:
- Hash do OTP (bcrypt)
- Controle de tentativas
- Expiração configurável
- Índice TTL para limpeza automática
- Versionamento via Namespace para migrações futuras

Estratégia de entrega:
1. **Telefone**: WhatsApp Business API → RabbitMQ (sem fallback para email)
2. **Email**: Email direto (não tenta WhatsApp)

## 2. Detalhamento da Proposta
### 2.1. Escopo da Solução
**Incluído:**
- Endpoints `/api/auth/request-otp` e `/api/auth/verify-otp`
- Collection OtpRequest gerenciada programaticamente (não metadata Konecty)
- Suporte a telefone ou email para solicitação de OTP
- Serviço OTP (geração, hash, verificação)
- Serviço WhatsApp (integração com Meta API)
- Serviço de entrega (WhatsApp → RabbitMQ para telefone, Email direto para email)
- Rate limiting baseado em banco de dados com transações (distribuído)
- Validação de formato E.164 para telefones e formato de email
- Logging em AccessLog e AccessFailedLog
- Índices MongoDB criados programaticamente (TTL, compound, unique)
- Template de email (para solicitações por email)
- Testes unitários e de integração
- Configuração no Namespace (WhatsApp com API URL template e language code, RabbitMQ, email template e remetente)

**Não Incluído:**
- Interface de usuário
- Modificações no fluxo de login tradicional
- Suporte a outros métodos de entrega além dos especificados

### 2.2. Requisitos Funcionais e Não Funcionais
**Funcionais:**
- Usuário pode solicitar OTP usando qualquer telefone cadastrado (formato E.164) ou email
- OTP é gerado como código de 6 dígitos
- OTP expira após tempo configurável (padrão: 5 minutos)
- Máximo de 3 tentativas de verificação antes de invalidar OTP
- Rate limiting de 5 requisições por minuto por telefone/email (baseado em banco de dados)
- Entrega por canal:
  - **Telefone**: WhatsApp → RabbitMQ (sem fallback para email)
  - **Email**: Email direto apenas (não tenta WhatsApp)
- sendViaEmail prioriza email usado na solicitação sobre email do usuário
- sendViaRabbitMQ inclui email do usuário na mensagem
- Login bem-sucedido retorna token no body (sem cookies)
- AccessLog registra qual telefone ou email foi usado (phoneUsed ou emailUsed)
- OTP é removido imediatamente após verificação bem-sucedida (one-time use)
- Limpeza automática de OTPs expirados via índice TTL

**Não Funcionais:**
- OTP sempre armazenado como hash (bcrypt)
- Validação estrita de formato E.164 e formato de email
- Logging completo de tentativas e falhas
- Testes com cobertura adequada
- Seguir princípios KISS, DRY, YAGNI
- Sem magic numbers (constantes definidas)
- Sem uso de `let` (apenas `const`)
- Uso de métodos de array (map, find, reduce) em vez de loops `for`
- Uso de BluebirdPromise.map com controle de concorrência
- Rate limiting funciona em ambientes distribuídos (múltiplas instâncias)

### 2.3. Configuração no Namespace
O Namespace deve conter:
```json
{
  "otpConfig": {
    "expirationMinutes": 5,
    "whatsapp": {
      "accessToken": "...",
      "phoneNumberId": "...",
      "businessAccountId": "...",  // Opcional
      "templateId": "...",
      "apiUrlTemplate": "https://graph.facebook.com/v18.0/{{phoneNumberId}}/messages",  // Opcional, com default
      "languageCode": "pt_BR"  // Opcional, padrão pt_BR
    },
    "rabbitmqQueue": "otp-queue",
    "emailTemplateId": "email/otp.html",
    "emailFrom": "Konecty <support@konecty.com>"  // Opcional, padrão acima
  },
  "otpRequestCollectionVersion": 1  // Versionamento da collection OtpRequest
}
```

### 2.4. Estrutura de Dados

#### OtpRequest Collection (Gerenciada Programaticamente)
**Nota**: OtpRequest não é uma metadata Konecty, é uma collection MongoDB gerenciada programaticamente.

Campos:
- `_id`: ID único do OTP
- `phoneNumber`: Número usado na requisição (E.164) - opcional se email for fornecido
- `email`: Email usado na requisição - opcional se phoneNumber for fornecido
- `otpHash`: Hash bcrypt do OTP
- `user`: Referência ao usuário com `_id`, `name`, e `group`
- `attempts`: Contador de tentativas
- `expiresAt`: Data de expiração
- `_createdAt`: Data de criação

**Não inclui**: `_createdBy`, `_updatedBy`, `_updatedAt`, `verified`, `verifiedAt`, `phoneUsed` (não são relevantes para OTPs temporários)

#### Índices MongoDB (Criados Programaticamente)
1. **TTL Index**: `expiresAt` com `expireAfterSeconds: 0` (auto-delete)
2. **Lookup Index Phone**: `{ 'user._id': 1, phoneNumber: 1, expiresAt: 1 }` com partialFilterExpression `{ phoneNumber: { $exists: true } }`
3. **Lookup Index Email**: `{ 'user._id': 1, email: 1, expiresAt: 1 }` com partialFilterExpression `{ email: { $exists: true } }`
4. **Unique Index Phone**: `{ 'user._id': 1, phoneNumber: 1 }` com partialFilterExpression `{ phoneNumber: { $exists: true } }`
5. **Unique Index Email**: `{ 'user._id': 1, email: 1 }` com partialFilterExpression `{ email: { $exists: true } }`

**Versionamento**: `otpRequestCollectionVersion` no Namespace controla criação/atualização de índices

## 3. Arquitetura e Decisões Técnicas

### 3.1. Endpoints
- **Location**: `/api/auth/*` (nova estrutura)
- **Response**: Token no body, sem cookies
- **Format**: Mesmo formato do `/rest/auth/login`

### 3.2. OTP Generation e Lifecycle
- Geração: 6 dígitos aleatórios (100000-999999)
- Hash: bcrypt com salt rounds padrão
- Expiração: Configurável no Namespace (padrão: 5 minutos)
- **Remoção**: OTP é removido imediatamente após verificação bem-sucedida (deleteOne)
- **Criação**: Remove OTPs anteriores do mesmo identificador antes de criar novo (dentro de transação)
- **Suporte**: Telefone ou email (não ambos simultaneamente)

### 3.3. Delivery Strategy
Prioridade de entrega baseada no método de solicitação:

**Solicitação por Telefone:**
1. **WhatsApp**: Meta WhatsApp Business API (Graph API, URL e language code configuráveis)
2. **RabbitMQ**: Fila configurável no QueueConfig (inclui email do usuário na mensagem)
3. **Sem fallback para email**: Se WhatsApp e RabbitMQ falharem, retorna erro (não envia por email)

**Solicitação por Email:**
- **Email direto**: Envia imediatamente para o email usado na solicitação (não tenta WhatsApp)

**Configurações WhatsApp:**
- `apiUrlTemplate`: Template Handlebars para URL da API (padrão: `https://graph.facebook.com/v18.0/{{phoneNumberId}}/messages`)
- `languageCode`: Código de idioma para mensagem (padrão: `pt_BR`)
- `businessAccountId`: Opcional (incluído no template apenas se fornecido)

**Email:**
- `emailFrom`: Remetente configurável no Namespace (padrão: `Konecty <support@konecty.com>`)
- Prioriza email da solicitação sobre email do usuário

### 3.4. Rate Limiting
- **Implementação**: Banco de dados com transações MongoDB (distribuído, funciona em múltiplas instâncias)
- **Limite**: 5 requisições por minuto por telefone/email
- **Mecanismo**: Contagem de OTPs criados no último minuto dentro de transação
- **Comportamento**: Remove OTPs antigos do mesmo identificador antes de criar novo
- **Resposta**: 429 Too Many Requests
- **Retry**: Usa `retryMongoTransaction` para lidar com conflitos de escrita

### 3.5. Logging
- **AccessLog**: Login bem-sucedido com campo `phoneUsed` ou `emailUsed` conforme o método usado
- **AccessFailedLog**: Todas as falhas (usuário não encontrado, OTP inválido, etc.)
- Campo `__from`: Identifica origem ('request-otp' ou 'verify-otp')

## 4. Testes

### 4.1. Testes Unitários
- Geração e hash de OTP
- Verificação de OTP
- Serviço WhatsApp (mocks)
- Serviço de entrega (fallback chain)
- Rate limiting

### 4.2. Testes de Integração
- Endpoint request-otp (sucesso, falhas, rate limit)
- Endpoint verify-otp (sucesso, falhas, tentativas)
- Fluxo end-to-end completo

### 4.3. Cenários de Teste
- Telefone válido, usuário encontrado
- Email válido, usuário encontrado
- Telefone ou email inválido (formato)
- Usuário não encontrado
- Rate limit excedido (verificado no banco de dados)
- OTP válido, login bem-sucedido
- OTP inválido
- OTP expirado
- Máximo de tentativas excedido
- Entrega por telefone (WhatsApp → RabbitMQ, sem fallback para email)
- Entrega direta por email quando solicitado por email
- sendViaEmail prioriza email da solicitação
- sendViaRabbitMQ inclui email do usuário
- Múltiplos telefones por usuário
- Logging correto do phoneUsed ou emailUsed
- Remoção de OTP após verificação
- Transação de rate limiting funciona corretamente

## 5. Dependências e Configuração

### 5.1. NPM Packages
- Nenhuma nova dependência obrigatória (usa fetch nativo)
- Opcional: SDK oficial Meta WhatsApp (se disponível)

### 5.2. Environment Variables (Opcional)
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_TEMPLATE_ID`
- `WHATSAPP_BUTTON_URL_PARAMETER` (opcional, apenas se o template tiver botão URL)

### 5.3. Namespace Configuration
Configuração completa via metadata do Namespace (preferencial).

## 6. Segurança

### 6.1. Armazenamento
- OTP sempre armazenado como hash (bcrypt)
- Nunca expor OTP em logs ou respostas

### 6.2. Validação
- Formato E.164 obrigatório para telefones
- Validação de formato de email (regex básico)
- Validação de 6 dígitos para OTP
- Expiração curta (5 minutos padrão)
- Validação que exatamente um de telefone ou email é fornecido (não ambos)

### 6.3. Proteção
- Rate limiting para prevenir abuso
- Limite de tentativas (3 máximo)
- Limpeza automática via TTL index

## 7. Implementação

### 7.1. Ordem de Implementação
1. ✅ Constantes e schema Namespace
2. ✅ Collection OtpRequest gerenciada programaticamente
3. ✅ Serviço OTP core
4. ✅ Serviço WhatsApp
5. ✅ Serviço de entrega
6. ✅ Rate limiting (banco de dados com transações)
7. ✅ Endpoints API
8. ✅ Registro de rotas
9. ✅ Template de email
10. ✅ Testes unitários
11. ✅ Testes de integração
12. ✅ Índices MongoDB (criados programaticamente)
13. ✅ Documentação

### 7.2. Arquivos Criados
- `src/imports/consts.js` - Constantes OTP (inclui `OTP_COUNTRY_CODE_SEARCH_CONCURRENCY`)
- `src/imports/model/Namespace/index.ts` - Schema extendido com `otpConfig` completo
- `src/imports/auth/otp/index.ts` - Core OTP (gera, hash, verifica, cria, busca, remove)
- `src/imports/auth/otp/init.ts` - Inicialização programática da collection OtpRequest e índices
- `src/imports/auth/otp/whatsapp.ts` - WhatsApp service (com template de URL e language code)
- `src/imports/auth/otp/delivery.ts` - Delivery service (fallback inteligente)
- `src/server/routes/api/auth/otp.ts` - Endpoints (suporta telefone ou email)
- `src/private/templates/email/otp.html` - Email template
- `__test__/auth/otp/*.test.ts` - Testes

**Nota**: `src/private/metadata/OtpRequest.json` foi **removido** - collection é gerenciada programaticamente

### 7.3. Arquivos Modificados
- `src/server/routes/index.ts` - Registro de rotas
- `src/imports/consts.js` - Constantes adicionadas

## 8. Considerações Finais

### 8.1. Próximos Passos
1. Testar integração com WhatsApp Business API real
2. Configurar fila RabbitMQ para fallback
3. Validar template de email
4. Executar testes end-to-end
5. Criar documentação de API

### 8.2. Notas de Implementação
- Seguiu padrões existentes do projeto
- Reutilizou funções de login (token generation, AccessLog)
- Mantido compatibilidade com sistema existente
- Testes seguem padrão bun:test
- Sem magic numbers (constantes definidas)
- **Sem uso de `let`**: Apenas `const` usado em todo o código
- **Métodos de array**: Uso de `map`, `find`, `reduce` em vez de loops `for`
- **BluebirdPromise.map**: Uso de `BluebirdPromise.map` com `concurrency` em vez de `Promise.all`
- **Rate limiting distribuído**: Implementado no banco de dados com transações, funciona em múltiplas instâncias
- **Collection programática**: OtpRequest não é metadata Konecty, é gerenciada programaticamente com versionamento
- **Suporte a email**: Além de telefone, usuários podem solicitar OTP por email
- **Entrega por canal**: 
  - Se solicitado por telefone, tenta WhatsApp → RabbitMQ (sem fallback para email)
  - Se solicitado por email, envia apenas por email (não tenta WhatsApp)
- **Configurações flexíveis**: WhatsApp API URL e language code configuráveis via Handlebars template
- **Remoção imediata**: OTP é deletado após verificação (não marcado como verificado)

### 8.3. Descobertas Durante Implementação e Revisão

#### Decisões Arquiteturais Importantes
1. **Collection Programática**: OtpRequest não é metadata Konecty porque:
   - Não precisa de `_createdBy`/`_updatedBy` (não é relevante para OTPs temporários)
   - Não precisa de list/view (é apenas para uso interno via API)
   - Versionamento via Namespace permite migrações futuras

2. **Rate Limiting Distribuído**: 
   - Implementado no banco de dados com transações MongoDB
   - Funciona corretamente em ambientes distribuídos (múltiplas instâncias)
   - Remove OTPs antigos e valida rate limit atomicamente

3. **Suporte a Email**:
   - Usuários podem solicitar OTP por email ou telefone
   - Quando solicitado por email, envia direto por email (não tenta WhatsApp)
   - sendViaEmail prioriza email da solicitação sobre email do usuário

4. **Remoção vs. Marcação**:
   - OTP é removido imediatamente após verificação (deleteOne)
   - Mais seguro e eficiente que marcar como verificado
   - Simplifica o modelo de dados

5. **Configurações Avançadas**:
   - WhatsApp API URL pode ser customizada via Handlebars template
   - Language code configurável (padrão pt_BR)
   - businessAccountId opcional
   - emailFrom configurável no Namespace

6. **Padrões de Código**:
   - Zero uso de `let` (apenas `const`)
   - Métodos de array em vez de loops `for`
   - BluebirdPromise.map com controle de concorrência
   - Constantes para evitar magic numbers

7. **RabbitMQ Enriquecido**:
   - Mensagem RabbitMQ inclui email do usuário para contexto adicional

