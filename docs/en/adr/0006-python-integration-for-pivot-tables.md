# ADR-0006: Python Integration for Pivot Table Generation

## Status
Accepted

## Context
The system needs to generate pivot tables from large volumes of MongoDB data. This requires:

- **Efficient data processing**: Transform aggregated data into pivot table format
- **Specialized libraries**: Use mature Python libraries for data manipulation (Polars)
- **Internal streaming**: Process data in streaming to avoid memory accumulation
- **Processing isolation**: Execute heavy processing in a separate process to avoid blocking Node.js
- **Maintainability**: Keep Python code simple and isolated from main codebase

## Decision
Integrate Python via `uv` for pivot table processing, using stdin/stdout communication with minimal RPC protocol. Processing is done internally with streaming, but HTTP response is synchronous (JSON).

## Implementation Details

### Architecture

1. **HTTP Endpoint**: `/rest/data/:document/pivot`
   - Receives search parameters (filter, sort, limit, etc.) + pivot configuration
   - Returns synchronous JSON response (not HTTP streaming)
   - Streaming is used only internally for efficiency

2. **Data Flow**:
   - Node.js receives HTTP request
   - `findStream` gets data from MongoDB (internal streaming)
   - Data is sent to Python via stdin (NDJSON)
   - Python processes with Polars and returns result via stdout
   - Node.js collects result and returns JSON to client

3. **Minimal RPC Protocol**:
   - First line: JSON-RPC request with method and parameters
   - Following lines: NDJSON data
   - Response: First line JSON-RPC, followed by NDJSON data

### Technologies Used

1. **uv**: Fast Python package manager, written in Rust
   - Installation via standalone installer
   - Automatic dependency management via PEP 723 (inline metadata)
   - Execution: `uv run --script <script>`

2. **Polars**: Python library for data manipulation
   - Optimized performance for large volumes
   - Native pivot table support
   - Declared inline in Python script using PEP 723

3. **PEP 723**: Inline script metadata
   - Dependencies declared in the script itself
   - No separate `pyproject.toml` needed
   - Portability and simplicity

### File Structure

```
src/
  scripts/
    python/
      pivot_table.py          # Python script with inline metadata
  imports/
    data/
      api/
        pivotStream.ts        # Processing orchestration
        pythonStreamBridge.ts # Node.js ↔ Python bridge
    types/
      pivot.ts                # TypeScript types for pivot
```

### Docker

- `uv` installation in Docker image (before switching to non-root user)
- Python scripts copied to `/app/scripts/python/`
- `uv` binary installed in `/usr/local/bin` for all users access

## Consequences

### Positive

- **Performance**: Polars is optimized for large data volumes
- **Isolation**: Heavy processing doesn't block Node.js
- **Maintainability**: Python code isolated and simple
- **Portability**: Inline dependencies, no extra files
- **Efficiency**: Internal streaming reduces memory usage

### Negative

- **External dependency**: Requires `uv` installed in environment
- **Process overhead**: Python process spawn adds initial latency
- **Complexity**: stdin/stdout communication requires custom protocol
- **Debugging**: Python errors may be harder to trace

### Mitigations

- **Automatic installation**: `uv` automatically installed in Docker
- **Simple protocol**: Minimal RPC facilitates debugging
- **Logging**: Python errors captured via stderr and logged
- **Cleanup**: Python process always properly terminated, even on errors

## Alternatives Considered

1. **Implement pivot in Node.js**
   - ❌ JavaScript libraries don't have the same performance as Polars
   - ❌ More complex code for data manipulation

2. **Use pyproject.toml for dependencies**
   - ❌ Additional file to maintain
   - ✅ Chosen: PEP 723 inline metadata (simpler and more portable)

3. **HTTP streaming to client**
   - ❌ Client would need to process incremental stream
   - ✅ Chosen: Synchronous JSON response (simpler for client)

4. **HTTP communication between Node.js and Python**
   - ❌ Unnecessary network overhead
   - ✅ Chosen: stdin/stdout (more efficient)

## References

- [uv documentation](https://github.com/astral-sh/uv/blob/53cc00eab5c44e360333224f74fe14646f8edf0e/docs/guides/scripts.md)
- [PEP 723 - Inline script metadata](https://peps.python.org/pep-0723/)
- [Polars documentation](https://docs.pola.rs/api/python/stable/reference/dataframe/api/polars.DataFrame.pivot.html)
- ADR-0001: HTTP Streaming for Data Retrieval
- ADR-0005: Mandatory Secondary Nodes for Reading

