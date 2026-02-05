# ADR-0008: Endpoint de Gráficos com Polars e Pandas

## Status
Aceito

## Contexto
Foi necessário implementar um endpoint `/rest/data/:document/graph` que gera gráficos SVG a partir de dados do MongoDB. A implementação requer:
- Agregações eficientes de grandes volumes de dados
- Geração de gráficos SVG usando bibliotecas Python
- Performance otimizada para datasets médios/grandes (10k+ registros)

Foram avaliadas duas abordagens principais:
1. **Pandas puro**: Usar apenas pandas para agregações e visualização
2. **Polars + Pandas**: Usar Polars para agregações e converter para Pandas apenas para visualização

## Decisão
Implementar usando **Polars para agregações** e **Pandas/matplotlib para visualização**, com conversão `to_pandas()` apenas do resultado agregado (menor).

### Justificativa de Performance

Pesquisa realizada indica:
- Polars é **3-10x mais rápido** que Pandas para groupby/agregações em datasets grandes
- Conversão `to_pandas()` tem overhead (~20-50%), mas o pipeline completo (Polars groupby + to_pandas + matplotlib) ainda é **mais rápido que Pandas puro** para datasets médios/grandes
- **Estratégia ótima**: Fazer todas as agregações em Polars, converter apenas o resultado agregado (menor) para Pandas para plotar

## Detalhes da Implementação

### Fluxo de Processamento

1. **Carregar dados NDJSON em Polars DataFrame** (`pl.read_ndjson()` ou iterativo)
2. **Aplicar agregações/groupby em Polars** (performance):
   - Se `categoryField` e `aggregation` especificados: `df.group_by(categoryField).agg(...)`
   - Se apenas `aggregation`: `df.agg(...)`
   - Se nenhum: usar dados diretos
3. **Converter resultado agregado para Pandas**: `df_polars.to_pandas()` (apenas dados agregados, menor)
4. **Gerar gráfico com matplotlib** (integração nativa com Pandas)
5. **Exportar SVG para stdout**

### Dependências Python

```python
# /// script
# dependencies = [
#   "polars",
#   "pandas",
#   "matplotlib",
#   "pyarrow",  # Necessário para to_pandas()
# ]
# ///
```

### Arquivos Criados

- `src/scripts/python/graph_generator.py`: Script Python que processa dados e gera gráficos
- `src/imports/data/api/graphStream.ts`: Função que orquestra findStream + Python
- `src/imports/types/graph.ts`: Tipos TypeScript para configuração de gráficos
- `src/server/routes/rest/data/dataApi.ts`: Endpoint HTTP `/rest/data/:document/graph`

## Consequências

### Positivas

- **Performance**: 3-10x mais rápido que Pandas puro para agregações em datasets grandes
- **Eficiência de memória**: Conversão apenas do resultado agregado (menor), não dos dados brutos
- **Compatibilidade**: matplotlib integra nativamente com Pandas DataFrames
- **Reutilização**: Aproveita `findStream` existente para obter dados (DRY)
- **Escalabilidade**: Suporta grandes volumes sem degradação de performance

### Negativas

- **Overhead de conversão**: `to_pandas()` adiciona ~20-50% de overhead
- **Duas bibliotecas**: Requer polars e pandas (mas benefício de performance justifica)
- **Dependência adicional**: Requer `pyarrow` para conversão Polars → Pandas

### Mitigação

- Overhead de conversão é compensado pela performance superior do Polars em agregações
- Para datasets pequenos (<1GB), a diferença é mínima, mas ainda não degrada
- Dependências são gerenciadas automaticamente pelo `uv` quando o script roda pela primeira vez

## Alternativas Consideradas

### 1. Pandas Puro
- **Vantagem**: Mais simples, uma única biblioteca
- **Desvantagem**: Mais lento para agregações em datasets grandes (3-10x)
- **Decisão**: Rejeitado devido à performance inferior

### 2. Polars com pl.plot()
- **Vantagem**: Ficaria 100% em Polars, sem conversão
- **Desvantagem**: `polars-plot` ou `hvplot` têm menos recursos que matplotlib, menos maduro
- **Decisão**: Rejeitado devido à maturidade e recursos limitados

### 3. Plotly/Bokeh
- **Vantagem**: Gráficos interativos
- **Desvantagem**: Mais pesado, não necessário para SVG estático
- **Decisão**: Rejeitado (YAGNI - não precisamos de interatividade)

## Referências

- ADR-0006: Integração Python para Geração de Pivot Tables
- ADR-0001: HTTP Streaming para Busca de Dados
- [Polars vs Pandas Performance Benchmarks](https://www.datacamp.com/blog/top-python-libraries-for-data-science)
- [Polars to_pandas() Performance](https://python.plainenglish.io/5-underrated-python-libraries-every-data-scientist-should-know-in-2026-7d23d57ed7f2)

