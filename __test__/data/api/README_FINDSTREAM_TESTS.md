# findStream Tests e Benchmark

## Executando os testes e benchmark diretamente em Node

Todos os testes e benchmarks devem ser executados diretamente em Node (sem Jest), usando o servidor já rodando.

### Pré-requisitos

1. Servidor rodando em `http://localhost:3000`
2. Token de autenticação válido

### Variáveis de ambiente

- `TEST_TOKEN`: Token de autenticação para usar nos testes (obrigatório)
- `TEST_SERVER_URL`: URL do servidor (padrão: `http://localhost:3000`)

## Testes Unitários e de Integração

Execute os testes diretamente sem Jest:

```bash
# Com token fornecido
TEST_TOKEN="seu-token-aqui" TEST_SERVER_URL="http://localhost:3000" npx tsx __test__/data/api/runFindStreamTests.ts

# Com servidor customizado
TEST_SERVER_URL="http://localhost:3000" TEST_TOKEN="seu-token" npx tsx __test__/data/api/runFindStreamTests.ts
```

### Resultados esperados

Os testes verificam:
1. ✅ Tratamento de erros quando buildFindQuery falha
2. ✅ Retorno de stream Readable via HTTP
3. ✅ Aplicação correta de Transform streams
4. ✅ Cálculo de total em paralelo
5. ✅ Opção transformDatesToString
6. ✅ Processamento registro por registro sem acumular
7. ✅ Tratamento gracioso de erros

## Teste de Confiança: Validação de Dados Idênticos

O teste de confiança garante que `findStream` retorna exatamente os mesmos registros e dados que o `find` paginado original.

### Executando o Teste de Confiança

```bash
# Com token fornecido
TEST_TOKEN="seu-token-aqui" TEST_SERVER_URL="http://localhost:3000" npx tsx __test__/data/api/runFindStreamConfidenceTest.ts

# Com servidor customizado
TEST_SERVER_URL="http://localhost:3000" TEST_TOKEN="seu-token" npx tsx __test__/data/api/runFindStreamConfidenceTest.ts
```

### O que o Teste de Confiança valida

O teste compara:
- **Mesmo número de registros**: Ambos endpoints retornam a mesma quantidade
- **Mesmos IDs**: Todos os `_id` são idênticos
- **Dados idênticos**: Todos os campos de cada registro são comparados campo a campo
- **Múltiplos tamanhos**: Testa com 100, 1000, 5000 e todos os registros

### Resultados esperados

O teste deve mostrar:
- ✅ **Mesmo número de registros** em ambos endpoints
- ✅ **Todos os IDs correspondem** entre find e findStream
- ✅ **Todos os campos são idênticos** (comparação profunda JSON)
- ✅ **Validação de amostra**: Mostra quantos campos foram validados em um registro de exemplo

## Benchmark: findStream vs Find Paginado Original

O benchmark compara o novo método `findStream` contra o `find` paginado original (`/rest/data/:document/find`), não contra o outro endpoint de stream.

### Executando o Benchmark

```bash
# Com token fornecido
TEST_TOKEN="seu-token-aqui" TEST_SERVER_URL="http://localhost:3000" npx tsx __test__/data/api/runFindStreamBenchmark.ts

# Com servidor customizado
TEST_SERVER_URL="http://localhost:3000" TEST_TOKEN="seu-token" npx tsx __test__/data/api/runFindStreamBenchmark.ts
```

### O que o Benchmark mede

O benchmark compara:
- **Find Paginado Original** (`/rest/data/:document/find`): Acumula todos os registros em memória no servidor antes de enviar
- **FindStream** (`/rest/stream/:document/findStream`): Processa registros incrementalmente, um por vez

### Métricas coletadas

- **Total Time**: Tempo total de execução
- **TTFB (Time To First Byte)**: Tempo até receber o primeiro byte de dados
- **Memory Increase**: Aumento de memória no cliente
- **Peak Memory**: Pico de memória durante o processamento
- **CPU Usage**: Uso de CPU (user e system)
- **Throughput**: Registros processados por segundo

### Cenário de teste

O benchmark testa especificamente:
- Documento: `Opportunity`
- Filtro: `status in ["Em Visitação", "Nova", "Ofertando Imóveis", "Proposta", "Contrato"]`
- Volume: ~50.000 registros (limitado a 1000 por iteração para comparação justa)

### Resultados esperados

O benchmark deve mostrar:
- ✅ **TTFB muito melhor** com findStream (cliente recebe dados muito mais cedo)
- ✅ **Throughput melhor** com findStream
- ✅ **Menor uso de memória no servidor** com findStream (processamento incremental)
- ⚠️ **Memória no cliente** pode ser similar ou ligeiramente maior (depende do parsing)

### Notas

- Os testes e benchmark verificam automaticamente se o servidor está disponível antes de executar
- Se o servidor não estiver disponível, falharão com mensagem clara
- Os testes criam e limpam dados de teste automaticamente
- O benchmark executa 3 iterações e calcula médias para resultados mais precisos

