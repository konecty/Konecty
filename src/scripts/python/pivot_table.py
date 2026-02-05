# /// script
# dependencies = [
#   "polars",
# ]
# ///

# pivot_table.py
import sys
import json
import polars as pl
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import os
import re

# Debug log file
DEBUG_LOG_FILE = os.path.join(os.path.dirname(__file__), 'pivot_debug.log')

def debug_log(message: str):
    """Write debug message to log file"""
    try:
        with open(DEBUG_LOG_FILE, 'a', encoding='utf-8') as f:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            f.write(f'[{timestamp}] {message}\n')
    except Exception:
        pass

# Clear log file at start
try:
    with open(DEBUG_LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f'=== Pivot Debug Log - Started at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} ===\n')
except Exception:
    pass

# 1. Read RPC request from first line of stdin
request_line = sys.stdin.readline()
if not request_line:
    sys.exit(1)

request = json.loads(request_line)
method = request.get('method')
params = request.get('params', {})

if method != 'pivot':
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32601, 'message': 'Method not found'}
    })
    print(error_response, flush=True)
    sys.exit(1)

enriched_config = params.get('config', {})
# Blank text for empty values (translated from backend)
BLANK_TEXT = params.get('blankText', '(vazio)')

# 2. Read NDJSON data from remaining stdin
data = []
for line in sys.stdin:
    if line.strip():
        data.append(json.loads(line))

# 3. Flatten nested objects to support dot notation fields
def flatten_dict(d, parent_key='', sep='.'):
    """Flatten nested dictionary with dot notation"""
    items = []
    for k, v in d.items():
        new_key = f'{parent_key}{sep}{k}' if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
            if len(v) > 0:
                items.extend(flatten_dict(v[0], new_key, sep=sep).items())
            else:
                items.append((new_key, None))
        else:
            items.append((new_key, v))
    return dict(items)

# Flatten all records
flattened_data = [flatten_dict(record) for record in data]

# 4. Convert to Polars DataFrame
if not flattened_data:
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32602, 'message': 'No data provided for pivot table'}
    })
    print(error_response, flush=True)
    sys.exit(1)

df = pl.DataFrame(flattened_data)
debug_log(f'DataFrame columns ({len(df.columns)}): {df.columns}')

# 5. Extract configuration
rows_meta = enriched_config.get('rows', [])
columns_meta = enriched_config.get('columns', [])
values_meta = enriched_config.get('values', [])
options = enriched_config.get('options', {})

if not rows_meta or not values_meta:
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32602, 'message': 'Rows and values are required for pivot table'}
    })
    print(error_response, flush=True)
    sys.exit(1)

rows_fields = [r['field'] for r in rows_meta]
columns_fields = [c['field'] for c in columns_meta] if columns_meta else None
values_fields = [v['field'] for v in values_meta]

# 6. Format lookup values based on formatPattern
def format_lookup_value(row: Dict, field: str, lookup_config: Optional[Dict]) -> str:
    """Format a lookup value following legacy ExtJS pattern"""
    if not lookup_config:
        value = row.get(field)
        if value is None or value == '':
            return BLANK_TEXT
        return str(value)
    
    simple_fields = lookup_config.get('simpleFields', ['name'])
    nested_fields = lookup_config.get('nestedFields', [])
    values = []
    
    # Process simple fields (e.g., 'code', 'name')
    for sf in simple_fields:
        flattened_field = f'{field}.{sf}'
        field_value = row.get(flattened_field)
        if field_value is not None and field_value != '':
            # Format boolean values in Portuguese
            if isinstance(field_value, bool):
                field_value = 'Sim' if field_value else 'Não'
            values.append(str(field_value))
    
    # Process nested fields (e.g., 'name.full' -> 'name_full' in flattened data)
    for nf in nested_fields:
        # Try both dot notation and underscore notation
        flattened_field = f'{field}.{nf}'
        field_value = row.get(flattened_field)
        if field_value is None:
            # Try with underscore
            flattened_field = f'{field}.{nf.replace(".", "_")}'
            field_value = row.get(flattened_field)
        if field_value is not None and field_value != '':
            values.append(str(field_value))
    
    if values:
        return ' - '.join(values)
    
    # Check if lookup has any value at all
    id_value = row.get(f'{field}._id')
    if id_value:
        return str(id_value)
    
    return BLANK_TEXT

# 7. Parse date and apply bucket formatting
def parse_date_value(value: Any) -> Optional[datetime]:
    """Parse a date value from various formats"""
    if value is None:
        return None
    
    if isinstance(value, datetime):
        return value
    
    if isinstance(value, str):
        # Try ISO format with timezone
        try:
            # Remove timezone suffix for parsing
            clean_value = re.sub(r'[+-]\d{2}:\d{2}$', '', value)
            clean_value = clean_value.replace('Z', '')
            
            if 'T' in clean_value:
                return datetime.fromisoformat(clean_value)
            else:
                return datetime.strptime(clean_value, '%Y-%m-%d')
        except Exception:
            pass
    
    return None

def format_date_bucket(date_val: Optional[datetime], bucket: str) -> str:
    """Format a date according to bucket type (matching ExtJS date formats)"""
    if date_val is None:
        return '--'
    
    if bucket == 'd':
        # Day of month with leading zero (01-31)
        return date_val.strftime('%d')
    elif bucket == 'j':
        # Day of month without leading zero (1-31)
        return str(date_val.day)
    elif bucket == 'W':
        # ISO week number
        return str(date_val.isocalendar()[1])
    elif bucket == 'm':
        # Month with leading zero (01-12)
        return date_val.strftime('%m')
    elif bucket == 'n':
        # Month without leading zero (1-12)
        return str(date_val.month)
    elif bucket == 'Y':
        # Full year (2026)
        return str(date_val.year)
    elif bucket == 'M':
        # Short month name (Jan, Feb, etc.)
        return date_val.strftime('%b')
    elif bucket == 'F':
        # Full month name (January, February, etc.)
        return date_val.strftime('%B')
    elif bucket == 'D':
        # Short day name (Mon, Tue, etc.)
        return date_val.strftime('%a')
    elif bucket == 'l':
        # Full day name (Monday, Tuesday, etc.)
        return date_val.strftime('%A')
    else:
        # Default to ISO date
        return date_val.strftime('%Y-%m-%d')
    
# 8. Build column hierarchy tree (similar to ExtJS axisTop)
def build_column_tree(
    records: List[Dict],
    columns_meta: List[Dict]
) -> Tuple[Dict, Dict]:
    """
    Build hierarchical column tree structure.
    Returns: (column_tree, column_key_to_path_map)
    
    For multiple columns, creates nested structure:
    - Level 0: First column values (e.g., dates: 27, 28, 29)
    - Level 1: Second column values (e.g., status: Cancelada, Em Andamento, Nova)
    
    The column_key is the full path joined by '|' for backward compatibility with cells.
    """
    column_tree = {}
    column_key_to_path = {}
    
    if not columns_meta:
        return column_tree, column_key_to_path
    
    for record in records:
        col_path = []
        col_values = []
        
        for col_idx, col_meta in enumerate(columns_meta):
            field = col_meta['field']
            bucket = col_meta.get('bucket')
            lookup_config = col_meta.get('lookup')
            
            if bucket:
                # Date bucket - parse and format
                raw_value = record.get(field)
                date_val = parse_date_value(raw_value)
                col_value = format_date_bucket(date_val, bucket)
                col_label = col_value
            elif lookup_config:
                # Lookup field
                col_value = record.get(f'{field}._id') or record.get(field, '')
                col_value = str(col_value) if col_value else BLANK_TEXT
                col_label = format_lookup_value(record, field, lookup_config)
            else:
                col_value = str(record.get(field, '') or '')
                if not col_value:
                    col_value = BLANK_TEXT
                col_label = col_value
            
            col_values.append(col_value)
            col_path.append((col_value, col_label, col_idx))
        
        # Build column tree
        current_level = column_tree
        parent_key = ''
        
        for col_value, col_label, col_idx in col_path:
            node_key = f'{parent_key}|{col_value}' if parent_key else col_value
            
            if col_value not in current_level:
                current_level[col_value] = {
                    'key': node_key,
                    'value': col_value,
                    'label': col_label,
                    'level': col_idx,
                    'children': {},
                    'expanded': False
                }
            
            parent_key = node_key
            current_level = current_level[col_value]['children']
        
        # Map full key to path for cell lookup
        full_key = '|'.join(col_values)
        column_key_to_path[full_key] = col_values
    
    return column_tree, column_key_to_path

def column_tree_to_list(tree: Dict, sort_numeric: bool = False) -> List[Dict]:
    """Convert column tree dict to sorted list format"""
    result = []
    
    for key, node in tree.items():
        node_data = {
            'key': node['key'],
            'value': node['value'],
            'label': node['label'],
            'level': node['level'],
            'expanded': node.get('expanded', False)
        }
        
        if node['children']:
            node_data['children'] = column_tree_to_list(node['children'], sort_numeric)
        
        result.append(node_data)
    
    # Sort: try numeric sort first, then alphabetic
    try:
        if sort_numeric and all(n['value'].isdigit() or n['value'] == '--' for n in result):
            result.sort(key=lambda n: int(n['value']) if n['value'].isdigit() else 9999)
        else:
            result.sort(key=lambda n: n['label'].lower())
    except Exception:
        result.sort(key=lambda n: n.get('label', '').lower())
    
    return result

# 9. Build pivot structure with subtotals
def build_pivot_hierarchy(
    records: List[Dict],
    rows_meta: List[Dict],
    columns_meta: Optional[List[Dict]],
    values_meta: List[Dict]
) -> Tuple[List[Dict], Dict, List[Dict]]:
    """
    Build hierarchical pivot structure with subtotals at each level.
    Returns: (row_hierarchy, grand_totals, column_headers)
    """
    
    # Data structure: nested dict by row levels
    # Each node: {key, label, level, children, cells, totals}
    
    root_children = {}
    grand_totals_cells = defaultdict(lambda: defaultdict(float))
    grand_totals_totals = defaultdict(float)
    
    # Build column tree first
    column_tree, column_key_map = build_column_tree(records, columns_meta or [])
    
    for record in records:
        # Extract row path (list of (key, label) tuples)
        row_path = []
        for row_meta in rows_meta:
            field = row_meta['field']
            lookup_config = row_meta.get('lookup')
            
            # Get key (stable identifier)
            id_field = f'{field}._id'
            key = record.get(id_field)
            if key is None:
                key = record.get(field, '')
            key = str(key) if key is not None else ''
            
            # Get label (formatted display value)
            if lookup_config:
                label = format_lookup_value(record, field, lookup_config)
            else:
                value = record.get(field)
                if value is None or value == '':
                    label = BLANK_TEXT
                else:
                    label = str(value)
            
            # Use BLANK_TEXT as key if key is empty
            if not key:
                key = BLANK_TEXT
            
            row_path.append((key, label))
        
        # Extract column key (for dynamic columns) - still using '|' joined for cells
        column_key = '__default__'
        if columns_meta:
            col_values = []
            for col_meta in columns_meta:
                field = col_meta['field']
                bucket = col_meta.get('bucket')
                lookup_config = col_meta.get('lookup')
                
                if bucket:
                    # Date bucket - parse and format
                    raw_value = record.get(field)
                    date_val = parse_date_value(raw_value)
                    col_value = format_date_bucket(date_val, bucket)
                elif lookup_config:
                    col_value = record.get(f'{field}._id') or record.get(field, '')
                    col_value = str(col_value) if col_value else BLANK_TEXT
                else:
                    col_value = str(record.get(field, '') or '')
                    if not col_value:
                        col_value = BLANK_TEXT
                
                col_values.append(col_value)
            column_key = '|'.join(col_values)
        
        # Extract values (aggregations)
        row_values = {}
        for val_meta in values_meta:
            field = val_meta['field']
            agg = val_meta.get('aggregator', 'sum')
            
            if agg == 'count':
                row_values[field] = 1
            else:
                val = record.get(field, 0)
                if val is None:
                    val = 0
                try:
                    row_values[field] = float(val)
                except (ValueError, TypeError):
                    row_values[field] = 0
        
        # Build/update tree structure
        current_level = root_children
        for level_idx, (key, label) in enumerate(row_path):
            if key not in current_level:
                current_level[key] = {
                    'key': key,
                    'label': label,
                    'level': level_idx,
                    'cells': defaultdict(lambda: defaultdict(float)),
                    'totals': defaultdict(float),
                    'count': 0,
                    'children': {}
                }
            
            node = current_level[key]
            
            # Update cells and totals at EVERY level (for subtotals)
            for field, value in row_values.items():
                val_meta = next((v for v in values_meta if v['field'] == field), {})
                agg = val_meta.get('aggregator', 'sum')
                
                if agg in ['sum', 'count']:
                    node['cells'][column_key][field] += value
                    node['totals'][field] += value
                elif agg == 'avg':
                    # For avg, we accumulate sum and count, then compute at the end
                    node['cells'][column_key][f'{field}_sum'] = node['cells'][column_key].get(f'{field}_sum', 0) + value
                    node['cells'][column_key][f'{field}_count'] = node['cells'][column_key].get(f'{field}_count', 0) + 1
            
            node['count'] += 1
            
            # Move to next level
            current_level = node['children']
        
        # Update grand totals
        for field, value in row_values.items():
            grand_totals_cells[column_key][field] += value
            grand_totals_totals[field] += value
    
    # Convert tree to list format
    def tree_to_list(node_dict: Dict) -> List[Dict]:
        result = []
        for key, node in node_dict.items():
            # Convert defaultdicts to regular dicts
            cells = {}
            for col_key, col_vals in node['cells'].items():
                cells[col_key] = dict(col_vals)
            
            node_data = {
                'key': node['key'],
                'label': node['label'],
                'level': node['level'],
                'cells': cells,
                'totals': dict(node['totals'])
            }
            
            if node['children']:
                node_data['children'] = tree_to_list(node['children'])
            
            result.append(node_data)
        
        return result
    
    hierarchy = tree_to_list(root_children)
    
    grand_totals = {
        'cells': {k: dict(v) for k, v in grand_totals_cells.items()},
        'totals': dict(grand_totals_totals)
    }
    
    # Convert column tree to list - sort numeric for date buckets
    has_date_bucket = any(c.get('bucket') for c in (columns_meta or []))
    column_headers = column_tree_to_list(column_tree, sort_numeric=has_date_bucket)
    
    return hierarchy, grand_totals, column_headers

# 10. Sort data by row fields for consistent grouping order
def get_sort_key(record: Dict, rows_meta: List[Dict]) -> tuple:
    """Get a sortable key tuple from record based on row fields"""
    keys = []
    for row_meta in rows_meta:
        field = row_meta['field']
        lookup_config = row_meta.get('lookup')
        
        # Get the value to sort by
        if lookup_config:
            # For lookups, use the label (formatted value) for sorting
            label = format_lookup_value(record, field, lookup_config)
            keys.append(label.lower() if label else '')
        else:
            value = record.get(field, '')
            keys.append(str(value).lower() if value else '')
    
    return tuple(keys)

# Sort data by row fields
try:
    flattened_data.sort(key=lambda r: get_sort_key(r, rows_meta))
    debug_log(f'Sorted {len(flattened_data)} records by row fields')
except Exception as e:
    debug_log(f'Warning: Could not sort data: {str(e)}')

# 11. Build pivot
try:
    hierarchy, grand_totals, column_headers = build_pivot_hierarchy(
        flattened_data,
        rows_meta,
        columns_meta if columns_meta else None,
        values_meta
    )
    
    # Sort hierarchy at each level alphabetically by label
    def sort_hierarchy(nodes: List[Dict]) -> List[Dict]:
        nodes.sort(key=lambda n: n.get('label', '').lower())
        for node in nodes:
            if 'children' in node and node['children']:
                node['children'] = sort_hierarchy(node['children'])
        return nodes
    
    hierarchy = sort_hierarchy(hierarchy)
    
    result = {
        'data': hierarchy,
        'grandTotals': grand_totals,
        'columnHeaders': column_headers  # Hierarchical column headers
    }
    
    debug_log(f'Built hierarchy with {len(hierarchy)} top-level nodes, {len(column_headers)} top-level columns')
    
except Exception as e:
    import traceback
    debug_log(f'Error building pivot: {str(e)}\n{traceback.format_exc()}')
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32603, 'message': f'Error building pivot table: {str(e)}'}
    })
    print(error_response, flush=True)
    sys.exit(1)

# 12. Send RPC response header
response = json.dumps({
    'jsonrpc': '2.0',
    'result': {'status': 'success', 'rowCount': len(result['data']), 'columnCount': len(result.get('columnHeaders', []))}
})
print(response, flush=True)

# 13. Send result as JSON
print(json.dumps(result), flush=True)
