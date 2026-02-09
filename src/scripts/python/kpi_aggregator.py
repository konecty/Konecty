# /// script
# dependencies = [
#   "polars",
# ]
# ///

# kpi_aggregator.py
# Aggregates streamed NDJSON data for KPI widget values.
# Protocol: Same JSON-RPC via stdin/stdout as pivot_table.py and graph_generator.py.
# ADR-0012: no-magic-numbers, functional style, structured logging.

import sys
import json
import polars as pl
from typing import Any, Dict, Optional
from datetime import datetime
import os

# --- Constants (ADR-0012: no-magic-numbers) ---
RPC_VERSION = '2.0'
RPC_ERROR_METHOD_NOT_FOUND = -32601
RPC_ERROR_INVALID_PARAMS = -32602
RPC_ERROR_INTERNAL = -32603
VALID_OPERATIONS = ('sum', 'avg', 'min', 'max')
PERCENTAGE_MULTIPLIER = 100

# Debug log file
DEBUG_LOG_FILE = os.path.join(os.path.dirname(__file__), 'kpi_debug.log')


def debug_log(message: str) -> None:
    """Write debug message to log file."""
    try:
        with open(DEBUG_LOG_FILE, 'a', encoding='utf-8') as f:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            f.write(f'[{timestamp}] {message}\n')
    except Exception:
        pass


def send_error(code: int, message: str) -> None:
    """Send JSON-RPC error response and exit."""
    response = json.dumps({
        'jsonrpc': RPC_VERSION,
        'error': {'code': code, 'message': message},
    })
    print(response, flush=True)
    sys.exit(1)


def send_result(result: Dict[str, Any]) -> None:
    """Send JSON-RPC success response followed by result data."""
    rpc_response = json.dumps({
        'jsonrpc': RPC_VERSION,
        'result': 'ok',
    })
    print(rpc_response, flush=True)
    print(json.dumps(result), flush=True)


def extract_nested_value(record: Dict[str, Any], field_path: str) -> Any:
    """Extract value from a nested dict using dot notation (e.g., 'value.amount')."""
    parts = field_path.split('.')
    current = record
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def flatten_records(records: list, field: str, field_b: Optional[str] = None) -> list:
    """Flatten nested field paths into top-level keys for Polars ingestion."""
    needs_flatten = '.' in field or (field_b is not None and '.' in field_b)
    if not needs_flatten:
        return records

    flattened = []
    flat_field = field.replace('.', '_')
    flat_field_b = field_b.replace('.', '_') if field_b else None

    for record in records:
        flat = dict(record)
        flat[flat_field] = extract_nested_value(record, field)
        if field_b is not None and flat_field_b is not None:
            flat[flat_field_b] = extract_nested_value(record, field_b)
        flattened.append(flat)

    return flattened


def compute_aggregation(
    df: pl.DataFrame,
    operation: str,
    field: str,
    field_b: Optional[str] = None,
) -> Dict[str, Any]:
    """Compute the requested aggregation on the dataframe."""
    # Use flattened column names (dots replaced with underscores)
    col_name = field.replace('.', '_') if '.' in field else field
    col_name_b = field_b.replace('.', '_') if field_b and '.' in field_b else field_b

    row_count = len(df)

    if col_name not in df.columns:
        debug_log(f'Column {col_name} not found in dataframe. Available: {df.columns}')
        return {'result': 0, 'count': row_count, 'error': f'Field {field} not found in data'}

    # Cast column to float for numeric operations, dropping nulls
    series = df[col_name].cast(pl.Float64, strict=False).drop_nulls()
    valid_count = len(series)

    if valid_count == 0:
        return {'result': 0, 'count': row_count, 'validCount': 0}

    if operation == 'sum':
        result = series.sum()
    elif operation == 'avg':
        result = series.mean()
    elif operation == 'min':
        result = series.min()
    elif operation == 'max':
        result = series.max()
    elif operation == 'percentage':
        if col_name_b is None or col_name_b not in df.columns:
            debug_log(f'fieldB column {col_name_b} not found for percentage')
            return {'result': 0, 'count': row_count, 'error': f'fieldB {field_b} not found'}

        series_b = df[col_name_b].cast(pl.Float64, strict=False).drop_nulls()
        denominator = series_b.sum()

        if denominator == 0:
            return {'result': 0, 'count': row_count, 'validCount': valid_count}

        result = (series.sum() / denominator) * PERCENTAGE_MULTIPLIER
    else:
        return {'result': 0, 'count': row_count, 'error': f'Unknown operation: {operation}'}

    return {
        'result': round(float(result), 4) if result is not None else 0,
        'count': row_count,
        'validCount': valid_count,
    }


# --- Main execution ---

# Clear log file at start
try:
    with open(DEBUG_LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f'=== KPI Aggregator Debug Log - Started at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} ===\n')
except Exception:
    pass

# 1. Read RPC request from first line of stdin
request_line = sys.stdin.readline()
if not request_line:
    sys.exit(1)

try:
    request = json.loads(request_line)
except json.JSONDecodeError as e:
    send_error(RPC_ERROR_INTERNAL, f'Invalid JSON in RPC request: {str(e)}')

method = request.get('method')
params = request.get('params', {})

if method != 'aggregate':
    send_error(RPC_ERROR_METHOD_NOT_FOUND, f'Method not found: {method}')

config = params.get('config', {})
operation = config.get('operation')
field = config.get('field')
field_b = config.get('fieldB')

debug_log(f'Config: operation={operation}, field={field}, fieldB={field_b}')

# Validate operation
if operation not in VALID_OPERATIONS and operation != 'percentage':
    send_error(RPC_ERROR_INVALID_PARAMS, f'Invalid operation: {operation}. Must be one of: {", ".join(VALID_OPERATIONS)}, percentage')

# Validate field is present for all operations
if not field:
    send_error(RPC_ERROR_INVALID_PARAMS, 'field is required for aggregation')

# Validate fieldB for percentage
if operation == 'percentage' and not field_b:
    send_error(RPC_ERROR_INVALID_PARAMS, 'fieldB is required for percentage operation')

# 2. Read NDJSON data from remaining stdin
data = []
for line in sys.stdin:
    stripped = line.strip()
    if stripped:
        try:
            data.append(json.loads(stripped))
        except json.JSONDecodeError:
            debug_log(f'Skipping invalid JSON line: {stripped[:100]}')

debug_log(f'Read {len(data)} records from stdin')

if len(data) == 0:
    send_result({'result': 0, 'count': 0, 'validCount': 0})
    sys.exit(0)

# 3. Flatten nested fields if needed
flattened_data = flatten_records(data, field, field_b)

# 4. Create Polars DataFrame and compute aggregation
try:
    df = pl.DataFrame(flattened_data)
    debug_log(f'DataFrame created: {len(df)} rows, columns: {df.columns}')

    result = compute_aggregation(df, operation, field, field_b)
    debug_log(f'Aggregation result: {result}')

    send_result(result)
except Exception as e:
    debug_log(f'Error during aggregation: {str(e)}')
    send_error(RPC_ERROR_INTERNAL, f'Aggregation error: {str(e)}')
