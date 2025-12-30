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
from typing import Dict, List, Any, Optional

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
            # Handle arrays of objects - take first element
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

# 5. Extract configuration from enriched config
rows_meta = enriched_config.get('rows', [])
columns_meta = enriched_config.get('columns', [])
values_meta = enriched_config.get('values', [])

if not rows_meta:
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32602, 'message': 'Rows are required for pivot table'}
    })
    print(error_response, flush=True)
    sys.exit(1)

if not values_meta:
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32602, 'message': 'Values are required for pivot table'}
    })
    print(error_response, flush=True)
    sys.exit(1)

# Extract field names
rows_fields = [r['field'] for r in rows_meta]
columns_fields = [c['field'] for c in columns_meta] if columns_meta else None
values_fields = [v['field'] for v in values_meta]

# Validate fields exist
available_columns = df.columns
missing_fields = []

for field in rows_fields:
    if field not in available_columns:
        missing_fields.append(f'row field "{field}"')

if columns_fields:
    for field in columns_fields:
        if field not in available_columns:
            missing_fields.append(f'column field "{field}"')

for field in values_fields:
    if field not in available_columns:
        missing_fields.append(f'value field "{field}"')

if missing_fields:
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32602, 'message': f'Fields not found in data: {", ".join(missing_fields)}. Available fields: {", ".join(available_columns[:10])}{"..." if len(available_columns) > 10 else ""}'}
    })
    print(error_response, flush=True)
    sys.exit(1)

# 6. Format lookup values based on formatPattern
def format_lookup_value(value: Any, lookup_config: Optional[Dict]) -> str:
    """Format a lookup value using formatPattern like "{name} ({active})" """
    if not lookup_config or not lookup_config.get('formatPattern'):
        return str(value) if value is not None else ''
    
    format_pattern = lookup_config['formatPattern']
    simple_fields = lookup_config.get('simpleFields', [])
    
    # If value is a dict (lookup object), extract fields and apply pattern
    if isinstance(value, dict):
        # Extract values for each field in simple_fields
        field_values = {}
        for field in simple_fields:
            field_value = value.get(field, '')
            field_values[field] = str(field_value) if field_value is not None else ''
        
        # Apply format pattern by replacing {field} placeholders
        result = format_pattern
        for field in simple_fields:
            placeholder = f'{{{field}}}'
            result = result.replace(placeholder, field_values.get(field, ''))
        
        return result
    
    # If value is already a string (from flattened data), return as is
    return str(value) if value is not None else ''

# 7. Build pivot table using Polars
aggregator_map = {
    'count': 'count',
    'sum': 'sum',
    'avg': 'mean',
    'min': 'min',
    'max': 'max'
}

try:
    # Map row/column fields to actual DataFrame columns
    # If a field doesn't exist, it's a lookup without sub-field - use displayField
    # Also include all simpleFields for formatting
    def get_actual_fields_for_grouping(field: str, meta: Dict) -> List[str]:
        if field in df.columns:
            return [field]
        # Field is a lookup without sub-field - include all simpleFields for formatting
        lookup_config = meta.get('lookup')
        if lookup_config:
            fields_to_include = []
            for simple_field in lookup_config.get('simpleFields', []):
                flattened_field = f'{field}.{simple_field}'
                if flattened_field in df.columns:
                    fields_to_include.append(flattened_field)
            if fields_to_include:
                return fields_to_include
        return [field]
    
    # Get actual fields for grouping (including all fields needed for formatting)
    actual_rows_fields = []
    for field, meta in zip(rows_fields, rows_meta):
        actual_rows_fields.extend(get_actual_fields_for_grouping(field, meta))
    
    actual_columns_fields = []
    if columns_fields and columns_meta:
        for field, meta in zip(columns_fields, columns_meta):
            actual_columns_fields.extend(get_actual_fields_for_grouping(field, meta))
    
    # Build aggregation expressions
    agg_exprs = []
    for value_meta in values_meta:
        field = value_meta['field']
        agg_type = aggregator_map.get(value_meta.get('aggregator', 'sum'), 'sum')
        
        if agg_type == 'count':
            agg_exprs.append(pl.len().alias(f'{field}_count'))
        elif agg_type == 'sum':
            agg_exprs.append(pl.col(field).sum().alias(f'{field}_sum'))
        elif agg_type == 'mean':
            agg_exprs.append(pl.col(field).mean().alias(f'{field}_avg'))
        elif agg_type == 'min':
            agg_exprs.append(pl.col(field).min().alias(f'{field}_min'))
        elif agg_type == 'max':
            agg_exprs.append(pl.col(field).max().alias(f'{field}_max'))
    
    # Group by rows and columns (using actual fields)
    group_by_fields = actual_rows_fields.copy()
    if actual_columns_fields:
        group_by_fields.extend(actual_columns_fields)
    
    pivot_df = df.group_by(group_by_fields).agg(agg_exprs)
    
except Exception as e:
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32603, 'message': f'Error building pivot table: {str(e)}'}
    })
    print(error_response, flush=True)
    sys.exit(1)

# 8. Build hierarchical structure
def build_hierarchy(pivot_df: pl.DataFrame, rows_meta: List[Dict], columns_meta: Optional[List[Dict]], values_meta: List[Dict]) -> Dict:
    """Build hierarchical structure with children, subtotals, and grand totals"""
    
    # Convert to dict for easier processing
    rows_data = pivot_df.to_dicts()
    
    # Build tree structure
    tree = {}
    grand_totals_cells = defaultdict(lambda: defaultdict(float))
    grand_totals_totals = defaultdict(float)
    
    # Map original fields to actual DataFrame columns used in group_by
    def get_row_value(field: str, meta: Dict, row: Dict) -> tuple:
        """Get value and formatted label for a row field"""
        lookup_config = meta.get('lookup')
        
        # Check if field exists directly (for flattened fields like _user.name)
        if field in row:
            value = row.get(field)
            # If it's a lookup with formatPattern, reconstruct object for formatting
            if lookup_config and lookup_config.get('formatPattern'):
                lookup_obj = {}
                base_field = field.rsplit('.', 1)[0] if '.' in field else field
                for simple_field in lookup_config.get('simpleFields', []):
                    flattened_field = f'{base_field}.{simple_field}'
                    if flattened_field in row:
                        lookup_obj[simple_field] = row.get(flattened_field)
                formatted_value = format_lookup_value(lookup_obj if lookup_obj else value, lookup_config)
                row_key = str(value) if value is not None else ''
            else:
                formatted_value = str(value) if value is not None else ''
                row_key = formatted_value
        else:
            # Field is a lookup without sub-field - reconstruct from flattened fields in row
            if lookup_config:
                lookup_obj = {}
                for simple_field in lookup_config.get('simpleFields', []):
                    flattened_field = f'{field}.{simple_field}'
                    if flattened_field in row:
                        lookup_obj[simple_field] = row.get(flattened_field)
                
                formatted_value = format_lookup_value(lookup_obj, lookup_config)
                display_field = lookup_config.get('displayField', 'name')
                # Use displayField value as key
                row_key = str(lookup_obj.get(display_field, '')) if lookup_obj else ''
            else:
                value = None
                formatted_value = str(value) if value is not None else ''
                row_key = formatted_value
        
        return row_key, formatted_value
    
    for row in rows_data:
        # Extract row keys (hierarchy path)
        row_keys = []
        row_labels = []
        for i, row_meta in enumerate(rows_meta):
            field = row_meta['field']
            row_key, formatted_value = get_row_value(field, row_meta, row)
            row_keys.append(row_key)
            row_labels.append(formatted_value)
        
        # Build nested structure
        current = tree
        for i, key in enumerate(row_keys):
            if key not in current:
                lookup_config = rows_meta[i].get('lookup')
                label = row_labels[i]
                current[key] = {
                    'key': key,
                    'label': label,
                    'level': i,
                    'cells': defaultdict(lambda: defaultdict(float)),
                    'totals': defaultdict(float),
                    'children': {}
                }
            current = current[key]['children']
        
        # Extract column keys and values
        column_key = None
        if columns_fields and columns_meta:
            column_values = []
            for col_field in columns_fields:
                col_value = row.get(col_field)
                # Format picklist value if needed
                col_meta = next((c for c in columns_meta if c['field'] == col_field), None)
                if col_meta and col_meta.get('values'):
                    # Find matching option
                    option = next((opt for opt in col_meta['values'] if opt['key'] == str(col_value)), None)
                    if option:
                        col_value = option['label']
                column_values.append(str(col_value) if col_value is not None else '')
            column_key = '|'.join(column_values) if column_values else None
        else:
            column_key = '__default__'
        
        # Extract aggregated values
        node = tree
        for key in row_keys:
            node = node[key]['children']
        
        # Get parent node (last level)
        parent = tree
        for key in row_keys[:-1]:
            parent = parent[key]['children']
        parent = parent[row_keys[-1]]
        
        # Add cell values
        for value_meta in values_meta:
            field = value_meta['field']
            agg_type = value_meta.get('aggregator', 'sum')
            
            # Find aggregated column name
            agg_suffix = f'_{agg_type}' if agg_type != 'count' else '_count'
            agg_col = f'{field}{agg_suffix}'
            
            value = row.get(agg_col, 0)
            if value is None:
                value = 0
            
            parent['cells'][column_key][field] = float(value)
            parent['totals'][field] = parent['totals'].get(field, 0) + float(value)
            
            # Add to grand totals
            grand_totals_cells[column_key][field] = grand_totals_cells[column_key].get(field, 0) + float(value)
            grand_totals_totals[field] = grand_totals_totals.get(field, 0) + float(value)
    
    # Convert tree to list structure
    def convert_to_list(node_dict: Dict, level: int) -> List[Dict]:
        result = []
        for key, node in node_dict.items():
            # Convert cells and totals to regular dicts
            cells = {k: dict(v) for k, v in node['cells'].items()}
            totals = dict(node['totals'])
            
            node_data = {
                'key': node['key'],
                'label': node['label'],
                'level': node['level'],
                'cells': cells,
                'totals': totals
            }
            
            # Add children recursively
            if node['children']:
                node_data['children'] = convert_to_list(node['children'], level + 1)
            
            result.append(node_data)
        
        return result
    
    hierarchy = convert_to_list(tree, 0)
    
    # Convert grand totals
    grand_totals = {
        'cells': {k: dict(v) for k, v in grand_totals_cells.items()},
        'totals': dict(grand_totals_totals)
    }
    
    return {
        'data': hierarchy,
        'grandTotals': grand_totals
    }

# 9. Build hierarchy
result = build_hierarchy(pivot_df, rows_meta, columns_meta, values_meta)

# 10. Send RPC response header
response = json.dumps({
    'jsonrpc': '2.0',
    'result': {'status': 'success', 'rowCount': len(result['data'])}
})
print(response, flush=True)

# 11. Send result as JSON (single object, not NDJSON)
print(json.dumps(result), flush=True)
