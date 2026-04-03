# /// script
# dependencies = [
#   "polars",
# ]
# ///

# cross_module_join.py
# Aggregates tagged NDJSON data from multiple Konecty modules.
# Protocol: Same JSON-RPC via stdin/stdout as pivot_table.py and kpi_aggregator.py.
# ADR-0010: no-magic-numbers, functional style, structured logging.

import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

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
    if field_path in record:
        return record[field_path]
    parts = field_path.split('.')
    current = record
    for part in parts:
        if isinstance(current, list):
            current = current[0] if len(current) > 0 else None
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def extract_all_ids(record: Dict[str, Any], key_path: str) -> List[str]:
    """Extract all IDs from a path that may traverse arrays (isList lookups)."""
    parts = key_path.split('.')
    current: list = [record]
    for part in parts:
        next_vals: list = []
        for item in current:
            if not isinstance(item, dict):
                continue
            val = item.get(part)
            if isinstance(val, list):
                next_vals.extend(val)
            elif val is not None:
                next_vals.append(val)
        current = next_vals
    return [str(v) for v in current if v is not None]


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


def _clean_record_for_aggregation(
    record: Dict[str, Any],
    parent_ref_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a copy of the record without internal tags and without the parent reference key."""
    out = {k: v for k, v in record.items() if k != DATASET_TAG}
    if parent_ref_key and parent_ref_key in out:
        out = {k: v for k, v in out.items() if k != parent_ref_key}
    return out


def apply_aggregator(
    aggregator_name: str,
    field: Optional[str],
    records: List[Dict[str, Any]],
    parent_ref_key: Optional[str] = None,
) -> Any:
    if aggregator_name == 'count':
        return len(records)

    if aggregator_name == 'push':
        if field is not None:
            return [extract_nested_value(r, field) for r in records]
        return [_clean_record_for_aggregation(r, parent_ref_key) for r in records]

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

    if aggregator_name == 'countDistinct':
        if field is None:
            return 0
        seen = set()
        for r in records:
            v = extract_nested_value(r, field)
            if v is not None:
                hashable = json.dumps(v, sort_keys=True, default=str) if isinstance(v, (dict, list)) else str(v)
                seen.add(hashable)
        return len(seen)

    if aggregator_name == 'first':
        if len(records) == 0:
            return None
        if field is not None:
            return extract_nested_value(records[0], field)
        return _clean_record_for_aggregation(records[0], parent_ref_key)

    if aggregator_name == 'last':
        if len(records) == 0:
            return None
        if field is not None:
            return extract_nested_value(records[-1], field)
        return _clean_record_for_aggregation(records[-1], parent_ref_key)

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
    prefix = relation_config.get('prefix', '')
    aggregators = relation_config.get('aggregators', {})
    sub_relations = relation_config.get('relations', [])

    child_records = datasets.get(dataset_name, [])
    debug_log(f'Processing relation {dataset_name}: {len(child_records)} child records, parent_key={parent_key}, child_key={child_key}, prefix={prefix}')

    grouped = group_records_by_key(child_records, child_key)

    if sub_relations:
        all_child_list = [r for records in grouped.values() for r in records]
        for sub_relation in sub_relations:
            process_relation(all_child_list, sub_relation, datasets)

    parent_ref_key = child_key.split('.')[0] if child_key else None

    for parent in parent_records:
        all_ids = extract_all_ids(parent, parent_key)
        matching = [r for pid in all_ids for r in grouped.get(pid, [])]

        for agg_field, agg_config in aggregators.items():
            agg_name = agg_config['aggregator']
            agg_source_field = agg_config.get('field')
            parent[agg_field] = apply_aggregator(
                agg_name, agg_source_field, matching, parent_ref_key=parent_ref_key
            )

        if prefix:
            parent[f'_rel_{prefix}_matches'] = matching


def expand_records_for_relations(
    parent_records: List[Dict[str, Any]],
    group_by_fields: List[str],
    root_aggregators: Dict[str, Any],
    relations: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Expand parent records for relation-prefixed groupBy fields."""
    prefixes = {r.get('prefix', ''): r for r in relations if r.get('prefix')}
    relation_gb_fields = [gf for gf in group_by_fields if gf.split('.')[0] in prefixes]
    if not relation_gb_fields:
        return parent_records

    all_relation_fields = list(relation_gb_fields)
    for agg_alias, agg_config in root_aggregators.items():
        agg_field = agg_config.get('field')
        if agg_field and agg_field.split('.')[0] in prefixes:
            all_relation_fields.append(agg_field)

    expanded: List[Dict[str, Any]] = []
    for parent in parent_records:
        prefixes_with_matches: Dict[str, List[Dict[str, Any]]] = {}
        for pf in prefixes:
            prefixes_with_matches[pf] = parent.get(f'_rel_{pf}_matches', [])

        match_lists = list(prefixes_with_matches.items())
        if not match_lists:
            expanded.append(parent)
            continue

        main_prefix, main_matches = match_lists[0]
        if not main_matches:
            row = {**parent}
            for rf in all_relation_fields:
                row[rf] = None
            expanded.append(row)
        else:
            for child in main_matches:
                row = {**parent}
                for rf in all_relation_fields:
                    parts = rf.split('.', 1)
                    if len(parts) == 2 and parts[0] in prefixes:
                        row[rf] = extract_nested_value(child, parts[1])
                expanded.append(row)

    debug_log(f'Expanded {len(parent_records)} parent records to {len(expanded)} rows')
    return expanded


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
    relations = []

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
    prefixes = []
    for relation in relations:
        process_relation(parent_records, relation, datasets)
        if relation.get('prefix'):
            prefixes.append(relation.get('prefix'))

    group_by_fields = config.get('groupBy', [])
    root_aggregators = config.get('aggregators', {})

    if relations and group_by_fields:
        parent_records = expand_records_for_relations(parent_records, group_by_fields, root_aggregators, relations)

    if group_by_fields:
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for record in parent_records:
            key_parts = []
            for gf in group_by_fields:
                val = extract_nested_value(record, gf)
                key_parts.append(json.dumps(val, sort_keys=True, default=str) if isinstance(val, (dict, list)) else str(val))
            group_key = '||'.join(key_parts)
            if group_key not in grouped:
                grouped[group_key] = []
            grouped[group_key].append(record)

        aggregated_records: List[Dict[str, Any]] = []
        for records_in_group in grouped.values():
            row: Dict[str, Any] = {}
            for gf in group_by_fields:
                row[gf] = extract_nested_value(records_in_group[0], gf)
            for agg_alias, agg_config in root_aggregators.items():
                agg_name = agg_config['aggregator']
                agg_field = agg_config.get('field')
                row[agg_alias] = apply_aggregator(agg_name, agg_field, records_in_group)
            aggregated_records.append(row)

        send_rpc_ok()
        for record in aggregated_records:
            record.pop(DATASET_TAG, None)
            for prefix in prefixes:
                record.pop(f'_rel_{prefix}_matches', None)
            print(json.dumps(record, default=str), flush=True)
    else:
        send_rpc_ok()
        for record in parent_records:
            record.pop(DATASET_TAG, None)
            for prefix in prefixes:
                record.pop(f'_rel_{prefix}_matches', None)
            print(json.dumps(record, default=str), flush=True)

except Exception as e:
    debug_log(f'Error during processing: {str(e)}')
    send_error(RPC_ERROR_INTERNAL, f'Processing error: {str(e)}')
