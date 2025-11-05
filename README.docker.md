# Docker Compose para Desenvolvimento

Este arquivo `docker-compose.yml` fornece os serviços necessários para desenvolvimento local do Konecty.

## Serviços

### MongoDB
- **Versão:** MongoDB 8.2
- **Porta:** 27017 (configurável via `MONGO_PORT` no `.env`)
- **Volume:** `mongodb-data` (persistente)
- **Replica Set:** `rs0` (necessário para transações MongoDB)
- **Health Check:** Disponível
- **Inicialização:** Serviço `mongodb-init` configura o replica set automaticamente

### RabbitMQ
- **Porta AMQP:** 5672 (configurável via `RABBITMQ_PORT` no `.env`)
- **Porta Management UI:** 15672 (configurável via `RABBITMQ_MGMT_PORT` no `.env`)
- **Credenciais padrão:** `admin` / `admin` (configurável via `.env`)
- **Volume:** `rabbitmq-data` (persistente)
- **Health Check:** Disponível
- **Management UI:** http://localhost:15672

## Uso

### 1. Iniciar os serviços

```bash
docker-compose up -d
```

### 2. Verificar status

```bash
docker-compose ps
```

### 3. Ver logs

```bash
# Todos os serviços
docker-compose logs -f

# Apenas MongoDB
docker-compose logs -f mongodb

# Apenas RabbitMQ
docker-compose logs -f rabbitmq
```

### 4. Parar os serviços

```bash
docker-compose down
```

### 5. Parar e remover volumes (limpar dados)

```bash
docker-compose down -v
```

## Configuração no .env

Adicione ou ajuste as seguintes variáveis no seu `.env`:

```env
# MongoDB
MONGO_PORT=27017
MONGO_URL=mongodb://localhost:27017/konecty?replicaSet=rs0

# RabbitMQ
RABBITMQ_PORT=5672
RABBITMQ_MGMT_PORT=15672
RABBITMQ_USER=admin
RABBITMQ_PASS=admin
```

**Importante:** A URL do MongoDB deve incluir `?replicaSet=rs0` para que as transações funcionem corretamente.

## Rodando a aplicação

Com os serviços Docker rodando, inicie a aplicação Konecty:

```bash
bun run dev
```

A aplicação se conectará ao MongoDB e RabbitMQ rodando nos containers.

## RabbitMQ Management UI

Acesse a interface de gerenciamento do RabbitMQ em:
- **URL:** http://localhost:15672
- **Usuário:** `admin` (ou o valor de `RABBITMQ_USER`)
- **Senha:** `admin` (ou o valor de `RABBITMQ_PASS`)

## Customização Local

Para personalizações locais que não devem ser commitadas, crie um arquivo `docker-compose.override.yml`:

```yaml
services:
  mongodb:
    ports:
      - "27018:27017"  # Porta diferente
```

Este arquivo está no `.gitignore` e será automaticamente mesclado pelo docker-compose.

## Troubleshooting

### MongoDB não inicia
- Verifique se a porta não está em uso: `lsof -i :27017`
- Verifique os logs: `docker-compose logs mongodb`

### RabbitMQ não inicia
- Verifique se a porta não está em uso: `lsof -i :5672`
- Verifique os logs: `docker-compose logs rabbitmq`

### Limpar tudo e começar do zero
```bash
docker-compose down -v
docker-compose up -d
```

### Verificar status do Replica Set

Para verificar se o replica set foi configurado corretamente:

```bash
docker-compose exec mongodb mongosh --eval "rs.status()"
```

Você deve ver algo como:
```json
{
  "set": "rs0",
  "members": [
    {
      "_id": 0,
      "host": "mongodb:27017",
      "stateStr": "PRIMARY"
    }
  ]
}
```

## Por que Replica Set?

O MongoDB requer um replica set para habilitar transações. Sem isso, você verá erros como:
```
Transaction numbers are only allowed on a replica set member or mongos
```

O serviço `mongodb-init` configura automaticamente um replica set com um único membro para desenvolvimento local.

