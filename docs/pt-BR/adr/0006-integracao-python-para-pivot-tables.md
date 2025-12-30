# ADR-0006: Integração Python para Geração de Pivot Tables

## Status
Aceito

## Contexto
O sistema precisa gerar tabelas dinâmicas (pivot tables) a partir de grandes volumes de dados do MongoDB. Para isso, é necessário:

- **Processamento eficiente de dados**: Transformar dados agregados em formato de tabela dinâmica
- **Bibliotecas especializadas**: Utilizar bibliotecas Python maduras para manipulação de dados (Polars)
- **Streaming interno**: Processar dados em streaming para evitar acúmulo em memória
- **Isolamento de processamento**: Executar processamento pesado em processo separado para não bloquear o Node.js
- **Manutenibilidade**: Manter código Python simples e isolado do código principal

## Decisão
Integrar Python via `uv` para processamento de pivot tables, utilizando comunicação via stdin/stdout com protocolo RPC mínimo. O processamento é feito internamente com streaming, mas a resposta HTTP é síncrona (JSON).

## Detalhes da Implementação

### Arquitetura

1. **Endpoint HTTP**: `/rest/data/:document/pivot`
   - Recebe parâmetros de busca (filter, sort, limit, etc.) + configuração de pivot
   - Retorna resposta JSON síncrona (não streaming HTTP)
   - Streaming é usado apenas internamente para eficiência

2. **Fluxo de Dados**:
   - Node.js recebe requisição HTTP
   - `findStream` obtém dados do MongoDB (streaming interno)
   - Dados são enviados para Python via stdin (NDJSON)
   - Python processa com Polars e retorna resultado via stdout
   - Node.js coleta resultado e retorna JSON ao cliente

3. **Protocolo RPC Mínimo**:
   - Primeira linha: JSON-RPC request com método e parâmetros
   - Linhas seguintes: Dados NDJSON
   - Resposta: Primeira linha JSON-RPC, seguida de dados NDJSON

### Tecnologias Utilizadas

1. **uv**: Gerenciador de pacotes Python rápido, escrito em Rust
   - Instalação via instalador standalone
   - Gerenciamento automático de dependências via PEP 723 (inline metadata)
   - Execução: `uv run --script <script>`

2. **Polars**: Biblioteca Python para manipulação de dados
   - Performance otimizada para grandes volumes
   - Suporte nativo a pivot tables
   - Declarada inline no script Python usando PEP 723

3. **PEP 723**: Inline script metadata
   - Dependências declaradas no próprio script
   - Sem necessidade de `pyproject.toml` separado
   - Portabilidade e simplicidade

### Estrutura de Arquivos

```
src/
  scripts/
    python/
      pivot_table.py          # Script Python com inline metadata
  imports/
    data/
      api/
        pivotStream.ts        # Orquestração do processamento
        pythonStreamBridge.ts # Bridge Node.js ↔ Python
    types/
      pivot.ts                # Tipos TypeScript para pivot
```

### Docker

- Instalação do `uv` na imagem Docker (antes de trocar para usuário não-root)
- Cópia dos scripts Python para `/app/scripts/python/`
- Binário `uv` instalado em `/usr/local/bin` para acesso de todos os usuários

## Consequências

### Positivas

- **Performance**: Polars é otimizado para grandes volumes de dados
- **Isolamento**: Processamento pesado não bloqueia Node.js
- **Manutenibilidade**: Código Python isolado e simples
- **Portabilidade**: Dependências declaradas inline, sem arquivos extras
- **Eficiência**: Streaming interno reduz uso de memória

### Negativas

- **Dependência externa**: Requer `uv` instalado no ambiente
- **Overhead de processo**: Spawn de processo Python adiciona latência inicial
- **Complexidade**: Comunicação via stdin/stdout requer protocolo customizado
- **Debugging**: Erros em Python podem ser mais difíceis de rastrear

### Mitigações

- **Instalação automática**: `uv` instalado automaticamente no Docker
- **Protocolo simples**: RPC mínimo facilita debugging
- **Logging**: Erros do Python capturados via stderr e logados
- **Cleanup**: Processo Python sempre finalizado corretamente, mesmo em erros

## Alternativas Consideradas

1. **Implementar pivot em Node.js**
   - ❌ Bibliotecas JavaScript não têm a mesma performance do Polars
   - ❌ Código mais complexo para manipulação de dados

2. **Usar pyproject.toml para dependências**
   - ❌ Arquivo adicional a ser mantido
   - ✅ Escolhido: PEP 723 inline metadata (mais simples e portátil)

3. **HTTP streaming para o cliente**
   - ❌ Cliente precisaria processar stream incrementalmente
   - ✅ Escolhido: Resposta JSON síncrona (mais simples para o cliente)

4. **Comunicação via HTTP entre Node.js e Python**
   - ❌ Overhead de rede desnecessário
   - ✅ Escolhido: stdin/stdout (mais eficiente)

## Referências

- [uv documentation](https://github.com/astral-sh/uv/blob/53cc00eab5c44e360333224f74fe14646f8edf0e/docs/guides/scripts.md)
- [PEP 723 - Inline script metadata](https://peps.python.org/pep-0723/)
- [Polars documentation](https://docs.pola.rs/api/python/stable/reference/dataframe/api/polars.DataFrame.pivot.html)
- ADR-0001: HTTP Streaming para Busca de Dados
- ADR-0005: Uso Obrigatório de Nós Secundários para Leitura

