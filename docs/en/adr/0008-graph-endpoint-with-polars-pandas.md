# ADR-0008: Graph Endpoint with Polars and Pandas

## Status
Accepted

## Context
It was necessary to implement a `/rest/data/:document/graph` endpoint that generates SVG charts from MongoDB data. The implementation requires:
- Efficient aggregations of large data volumes
- SVG chart generation using Python libraries
- Optimized performance for medium/large datasets (10k+ records)

Two main approaches were evaluated:
1. **Pure Pandas**: Use only pandas for aggregations and visualization
2. **Polars + Pandas**: Use Polars for aggregations and convert to Pandas only for visualization

## Decision
Implement using **Polars for aggregations** and **Pandas/matplotlib for visualization**, with `to_pandas()` conversion only of the aggregated result (smaller).

### Performance Justification

Research indicates:
- Polars is **3-10x faster** than Pandas for groupby/aggregations on large datasets
- `to_pandas()` conversion has overhead (~20-50%), but the complete pipeline (Polars groupby + to_pandas + matplotlib) is still **faster than pure Pandas** for medium/large datasets
- **Optimal strategy**: Perform all aggregations in Polars, convert only the aggregated result (smaller) to Pandas for plotting

## Implementation Details

### Processing Flow

1. **Load NDJSON data into Polars DataFrame** (`pl.read_ndjson()` or iterative)
2. **Apply aggregations/groupby in Polars** (performance):
   - If `categoryField` and `aggregation` specified: `df.group_by(categoryField).agg(...)`
   - If only `aggregation`: `df.agg(...)`
   - If none: use raw data
3. **Convert aggregated result to Pandas**: `df_polars.to_pandas()` (only aggregated data, smaller)
4. **Generate chart with matplotlib** (native integration with Pandas)
5. **Export SVG to stdout**

### Python Dependencies

```python
# /// script
# dependencies = [
#   "polars",
#   "pandas",
#   "matplotlib",
#   "pyarrow",  # Required for to_pandas()
# ]
# ///
```

### Files Created

- `src/scripts/python/graph_generator.py`: Python script that processes data and generates charts
- `src/imports/data/api/graphStream.ts`: Function that orchestrates findStream + Python
- `src/imports/types/graph.ts`: TypeScript types for graph configuration
- `src/server/routes/rest/data/dataApi.ts`: HTTP endpoint `/rest/data/:document/graph`

## Consequences

### Positive

- **Performance**: 3-10x faster than pure Pandas for aggregations on large datasets
- **Memory efficiency**: Conversion only of aggregated result (smaller), not raw data
- **Compatibility**: matplotlib natively integrates with Pandas DataFrames
- **Reusability**: Leverages existing `findStream` to get data (DRY)
- **Scalability**: Supports large volumes without performance degradation

### Negative

- **Conversion overhead**: `to_pandas()` adds ~20-50% overhead
- **Two libraries**: Requires polars and pandas (but performance benefit justifies)
- **Additional dependency**: Requires `pyarrow` for Polars → Pandas conversion

### Mitigation

- Conversion overhead is offset by Polars' superior performance in aggregations
- For small datasets (<1GB), the difference is minimal, but still doesn't degrade
- Dependencies are automatically managed by `uv` when the script runs for the first time

## Alternatives Considered

### 1. Pure Pandas
- **Advantage**: Simpler, single library
- **Disadvantage**: Slower for aggregations on large datasets (3-10x)
- **Decision**: Rejected due to inferior performance

### 2. Polars with pl.plot()
- **Advantage**: Would stay 100% in Polars, no conversion
- **Disadvantage**: `polars-plot` or `hvplot` have fewer features than matplotlib, less mature
- **Decision**: Rejected due to maturity and limited features

### 3. Plotly/Bokeh
- **Advantage**: Interactive charts
- **Disadvantage**: Heavier, not needed for static SVG
- **Decision**: Rejected (YAGNI - we don't need interactivity)

## References

- ADR-0006: Python Integration for Pivot Table Generation
- ADR-0001: HTTP Streaming for Data Retrieval
- [Polars vs Pandas Performance Benchmarks](https://www.datacamp.com/blog/top-python-libraries-for-data-science)
- [Polars to_pandas() Performance](https://python.plainenglish.io/5-underrated-python-libraries-every-data-scientist-should-know-in-2026-7d23d57ed7f2)

