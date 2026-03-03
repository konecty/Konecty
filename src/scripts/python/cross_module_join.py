# /// script
# dependencies = [
#   "polars",
# ]
# ///

# cross_module_join.py
# Aggregates tagged NDJSON data from multiple Konecty modules.
# Protocol: Same JSON-RPC via stdin/stdout as pivot_table.py and kpi_aggregator.py.
# ADR-0010: no-magic-numbers, functional style, structured logging.

import sys
import json
from typing import Any, Dict, List, Optional
from datetime import datetime
import os

RPC_VERSION = '2.0'
RPC_ERROR_METHOD_NOT_FOUND = -32601
RPC_ERROR_INVALID_PARAMS = -32602
RPC_ERROR_INTERNAL = -32603
DATASET_TAG = '_dataset'

DEBUG_LOG_FILE = os.path.join(os.path.dirname(__file__), 'cross_module_debug.log')


def debug_log(message: str) -> None:
    try:
        with open(DEBUG_LOG_FILE, 'a', encoding='utf-8') as f:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            f.write(f'[{timestamp}] {message}\n')
    except Exception:
        pass


def send_error(code: int, message: str) -> None:
    response = json.dumps({
        'jsonrpc': RPC_VERSION,
        'error': {'code': code, 'message': message},
    })
    print(response, flush=True)
    sys.exit(1)


def send_rpc_ok() -> None:
    rpc_response = json.dumps({
        'jsonrpc': RPC_VERSION,
        'result': 'ok',
    })
    print(rpc_response, flush=True)


def extract_nested_value(record: Dict[str, Any], field_path: str) -> Any:
    parts = field_path.split('.')
    current = record
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def group_records_by_key(records: List[Dict[str, Any]], key_path: str) -> Dict[str, List[Dict[str, Any]]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for record in records:
        key_value = extract_nested_value(record, key_path)
        if key_value is None:
            continue
        key_str = str(key_value)
        if key_str not in grouped:
            grouped[key_str] = []
        grouped[key_str].append(record)
    return grouped


def apply_aggregator(aggregator_name: str, field: Optional[str], records: List[Dict[str, Any]]) -> Any:
    if aggregator_name == 'count':
        return len(records)

    if aggregator_name == 'push':
        if field is not None:
            return [extract_nested_value(r, field) for r in records]
        clean = [{k: v for k, v in r.items() if k != DATASET_TAG} for r in records]
        return clean

    if aggregator_name == 'addToSet':
        if field is None:
            return []
        values = []
        seen = set()
        for r in records:
            v = extract_nested_value(r, field)
            if v is None:
                continue
            hashable = json.dumps(v, sort_keys=True, default=str) if isinstance(v, (dict, list)) else v
            if hashable not in seen:
                seen.add(hashable)
                values.append(v)
        return values

    if aggregator_name == 'first':
        if len(records) == 0:
            return None
        if field is not None:
            return extract_nested_value(records[0], field)
        r = records[0]
        return {k: v for k, v in r.items() if k != DATASET_TAG}

    if aggregator_name == 'last':
        if len(records) == 0:
            return None
        if field is not None:
            return extract_nested_value(records[-1], field)
        r = records[-1]
        return {k: v for k, v in r.items() if k != DATASET_TAG}

    numeric_values = _extract_numeric_values(records, field)

    if aggregator_name == 'sum':
        return sum(numeric_values) if numeric_values else 0

    if aggregator_name == 'avg':
        return sum(numeric_values) / len(numeric_values) if numeric_values else 0

    if aggregator_name == 'min':
        return min(numeric_values) if numeric_values else None

    if aggregator_name == 'max':
        return max(numeric_values) if numeric_values else None

    return None


def _extract_numeric_values(records: List[Dict[str, Any]], field: Optional[str]) -> List[float]:
    if field is None:
        return []
    values = []
    for r in records:
        v = extract_nested_value(r, field)
        if v is None:
            continue
        if isinstance(v, dict) and 'value' in v:
            v = v['value']
        try:
            values.append(float(v))
        except (TypeError, ValueError):
            continue
    return values


def process_relation(
    parent_records: List[Dict[str, Any]],
    relation_config: Dict[str, Any],
    datasets: Dict[str, List[Dict[str, Any]]],
) -> None:
    dataset_name = relation_config['dataset']
    parent_key = relation_config['parentKey']
    child_key = relation_config['childKey']
    aggregators = relation_config.get('aggregators', {})
    sub_relations = relation_config.get('relations', [])

    child_records = datasets.get(dataset_name, [])
    debug_log(f'Processing relation {dataset_name}: {len(child_records)} child records, parent_key={parent_key}, child_key={child_key}')

    grouped = group_records_by_key(child_records, child_key)

    if sub_relations:
        all_child_list = [r for records in grouped.values() for r in records]
        for sub_relation in sub_relations:
            process_relation(all_child_list, sub_relation, datasets)

    for parent in parent_records:
        parent_id = extract_nested_value(parent, parent_key)
        if parent_id is None:
            for agg_field in aggregators:
                parent[agg_field] = None
            continue

        matching = grouped.get(str(parent_id), [])

        for agg_field, agg_config in aggregators.items():
            agg_name = agg_config['aggregator']
            agg_source_field = agg_config.get('field')
            parent[agg_field] = apply_aggregator(agg_name, agg_source_field, matching)


# --- Main execution ---

try:
    with open(DEBUG_LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f'=== Cross Module Join Debug Log - Started at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} ===\n')
except Exception:
    pass

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
parent_dataset = config.get('parentDataset')
relations = config.get('relations', [])

if not parent_dataset:
    send_error(RPC_ERROR_INVALID_PARAMS, 'parentDataset is required')

if not relations:
    send_error(RPC_ERROR_INVALID_PARAMS, 'At least one relation is required')

debug_log(f'Config: parentDataset={parent_dataset}, relations={len(relations)}')

datasets: Dict[str, List[Dict[str, Any]]] = {}
for line in sys.stdin:
    stripped = line.strip()
    if not stripped:
        continue
    try:
        record = json.loads(stripped)
        tag = record.get(DATASET_TAG, parent_dataset)
        if tag not in datasets:
            datasets[tag] = []
        datasets[tag].append(record)
    except json.JSONDecodeError:
        debug_log(f'Skipping invalid JSON line: {stripped[:100]}')

parent_records = datasets.get(parent_dataset, [])
debug_log(f'Read datasets: {", ".join(f"{k}={len(v)}" for k, v in datasets.items())}')
debug_log(f'Parent records: {len(parent_records)}')

if len(parent_records) == 0:
    send_rpc_ok()
    sys.exit(0)

try:
    for relation in relations:
        process_relation(parent_records, relation, datasets)

    send_rpc_ok()

    for record in parent_records:
        record.pop(DATASET_TAG, None)
        print(json.dumps(record, default=str), flush=True)

except Exception as e:
    debug_log(f'Error during processing: {str(e)}')
    send_error(RPC_ERROR_INTERNAL, f'Processing error: {str(e)}')
