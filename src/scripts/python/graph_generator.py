# /// script
# dependencies = [
#   "polars",
#   "pandas",
#   "matplotlib",
#   "pyarrow",
# ]
# ///

# graph_generator.py
import sys
import json
import io
import polars as pl
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from typing import Dict, Any, Optional

# 1. Read RPC request from first line of stdin
request_line = sys.stdin.readline()
if not request_line:
    sys.exit(1)

request = json.loads(request_line)
method = request.get('method')
params = request.get('params', {})

if method != 'graph':
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32601, 'message': 'Method not found'}
    })
    print(error_response, flush=True)
    sys.exit(1)

graph_config = params.get('config', {})

# 2. Read NDJSON data from remaining stdin
data = []
for line in sys.stdin:
    if line.strip():
        data.append(json.loads(line))

# 3. Helper function to resolve field names (handles lookup fields with _id suffix)
def resolve_field(field_name, available_columns):
    """Resolve field name, trying description fields for lookups if needed"""
    # First, check if the field exists directly
    if field_name in available_columns:
        return field_name
    
    # For lookup fields, after flattening, we get fields like _user._id, _user.name, etc.
    # Check if any field starts with field_name + '.' (indicating it was flattened)
    matching_fields = [col for col in available_columns if col.startswith(f'{field_name}.')]
    
    if matching_fields:
        # Prioritize description fields for display (name, code, label, title)
        for desc_field in ['name', 'code', 'label', 'title']:
            field_with_desc = f'{field_name}.{desc_field}'
            if field_with_desc in available_columns:
                return field_with_desc
        
        # If no description field found, try _id as fallback
        field_with_id = f'{field_name}._id'
        if field_with_id in available_columns:
            return field_with_id
        
        # If _id not found, return the first matching field (better than nothing)
        return matching_fields[0]
    
    return None

# 3.5. Helper function to apply date buckets
def apply_date_bucket(df: pl.DataFrame, field: str, bucket: str) -> tuple[pl.DataFrame, str]:
    """Apply date bucket grouping (D, W, M, Q, Y) to a date field
    Returns: (DataFrame with bucket column, bucket column name)
    """
    if field not in df.columns:
        return df, field
    
    bucket_col = f'{field}_bucket'
    
    # If bucket column already exists, return it (avoid duplicate application)
    if bucket_col in df.columns:
        return df, bucket_col
    
    # Try to convert to datetime if not already
    try:
        # Check if already datetime
        if df[field].dtype == pl.Datetime:
            date_col = pl.col(field)
        elif df[field].dtype == pl.Date:
            # Convert Date to Datetime for operations
            date_col = pl.col(field).cast(pl.Datetime)
            df = df.with_columns(date_col.alias(f'{field}_dt'))
            date_col = pl.col(f'{field}_dt')
        else:
            # Try to parse as datetime string
            df = df.with_columns(pl.col(field).str.strptime(pl.Datetime, format=None, strict=False).alias(f'{field}_dt'))
            date_col = pl.col(f'{field}_dt')
    except Exception:
        # If conversion fails, return original field
        return df, field
    
    if bucket == 'D':
        # Group by day: YYYY-MM-DD
        df = df.with_columns(date_col.dt.date().cast(pl.Utf8).alias(bucket_col))
    elif bucket == 'W':
        # Group by week: YYYY-WW
        df = df.with_columns(
            (date_col.dt.year().cast(pl.Utf8) + '-W' + 
             date_col.dt.week().cast(pl.Utf8).str.zfill(2)).alias(bucket_col)
        )
    elif bucket == 'M':
        # Group by month: YYYY-MM
        df = df.with_columns(
            (date_col.dt.year().cast(pl.Utf8) + '-' + 
             date_col.dt.month().cast(pl.Utf8).str.zfill(2)).alias(bucket_col)
        )
    elif bucket == 'Q':
        # Group by quarter: YYYY-QX
        df = df.with_columns(
            (date_col.dt.year().cast(pl.Utf8) + '-Q' + 
             date_col.dt.quarter().cast(pl.Utf8).cast(pl.Utf8)).alias(bucket_col)
        )
    elif bucket == 'Y':
        # Group by year: YYYY
        df = df.with_columns(
            date_col.dt.year().cast(pl.Utf8).alias(bucket_col)
        )
    else:
        # No bucket, return original field
        return df, field
    
    return df, bucket_col

# 4. Flatten nested objects to support dot notation fields
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

# 5. Convert to Polars DataFrame
if not flattened_data:
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32602, 'message': 'No data provided for graph'}
    })
    print(error_response, flush=True)
    sys.exit(1)

df_polars = pl.DataFrame(flattened_data)

# 6. Extract configuration
graph_type = graph_config.get('type')
# Normalize graph_type to lowercase for comparison
if graph_type:
    graph_type = graph_type.lower()
category_field = graph_config.get('categoryField')
category_field_label = graph_config.get('categoryFieldLabel')
aggregation = graph_config.get('aggregation')
x_axis = graph_config.get('xAxis', {})
y_axis = graph_config.get('yAxis', {})
series = graph_config.get('series', [])  # Multiple series support
title = graph_config.get('title', '')
width = graph_config.get('width', 800)
height = graph_config.get('height', 600)
colors = graph_config.get('colors')
show_legend = graph_config.get('showLegend', True)
show_grid = graph_config.get('showGrid', True)

# 7. Apply aggregations in Polars (fast)
# Check if we're using series (new) or yAxis+aggregation (legacy)
# For pie charts, always use category_field + aggregation (ignore series)
# IMPORTANT: Pie charts should NEVER use series mode, even if series are configured
use_series = len(series) > 0 and (not graph_type or graph_type.lower() != 'pie')

# Pre-resolve category_field if present (used by pie charts)
available_columns = df_polars.columns
category_field_bucket = graph_config.get('categoryFieldBucket')
if category_field:
    # First, try to resolve the field
    resolved_category = resolve_field(category_field, available_columns)
    if resolved_category:
        category_field = resolved_category
    else:
        # Try without the underscore prefix in case it was normalized differently
        alt_name = category_field.lstrip('_')
        if alt_name in available_columns:
            category_field = alt_name
        elif category_field in available_columns:
            # Field exists as-is (e.g., system fields like _createdAt)
            category_field = category_field
        else:
            # Field not found - this will be caught later, but log available columns for debugging
            available_cols_str = ', '.join(list(available_columns)[:10])
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Category field not found: {category_field}. Available: [{available_cols_str}]'}
            })
            print(error_response, flush=True)
            sys.exit(1)
    
    # Apply bucket to category_field if specified
    # IMPORTANT: category_field must exist in df_polars.columns before applying bucket
    if category_field_bucket:
        if category_field not in df_polars.columns:
            # Try to find the field one more time with different strategies
            # 1. Try exact match
            # 2. Try with/without underscore prefix
            # 3. Try as lookup field
            resolved_retry = resolve_field(category_field, df_polars.columns)
            if resolved_retry:
                category_field = resolved_retry
            else:
                # List all available columns for debugging
                available_cols = list(df_polars.columns)
                available_cols_str = ', '.join([f"'{c}'" for c in available_cols])
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': f'Category field not found for bucket: {category_field}. Available: [{available_cols_str}]'}
                })
                print(error_response, flush=True)
                sys.exit(1)
        
        # Now apply the bucket
        if category_field in df_polars.columns:
            df_polars, category_field = apply_date_bucket(df_polars, category_field, category_field_bucket)
            # category_field now points to the bucketed column name (e.g., _createdAt_bucket)
        else:
            available_cols_str = ', '.join([f"'{c}'" for c in list(df_polars.columns)])
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Category field not in DataFrame for bucket: {category_field}. Available: [{available_cols_str}]'}
            })
            print(error_response, flush=True)
            sys.exit(1)

if use_series:
    # Multiple series mode
    # IMPORTANT: Pie charts should NEVER use this block - they use category_field + aggregation instead
    # Double-check that we're not processing a pie chart
    if graph_type and graph_type.lower() == 'pie':
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': 'Pie charts should use categoryField + aggregation, not series'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
    x_field = x_axis.get('field') or category_field
    if not x_field:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': 'xAxis.field is required when using series'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
    # Resolve x_field
    available_columns = df_polars.columns
    resolved_x_field = resolve_field(x_field, available_columns)
    if not resolved_x_field:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': f'Field not found: {x_field}. Available: {list(available_columns)[:10]}'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    x_field = resolved_x_field
    
    # Apply bucket to x_field if specified
    x_axis_bucket = x_axis.get('bucket')
    if x_axis_bucket and x_field in df_polars.columns:
        df_polars, x_field = apply_date_bucket(df_polars, x_field, x_axis_bucket)
        # Atualizar x_axis['field'] para usar o campo bucketed na renderização
        x_axis['field'] = x_field
    
    # Aggregate each series
    series_dfs = []
    for idx, serie in enumerate(series):
        serie_field = serie.get('field')
        serie_aggregation = serie.get('aggregation', 'count')
        serie_label = serie.get('label', serie_field)
        
        if not serie_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Series {idx} is missing field'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        # Resolve serie field
        resolved_serie_field = resolve_field(serie_field, available_columns)
        if not resolved_serie_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {serie_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        serie_field = resolved_serie_field
        
        # Apply bucket to serie field if specified (rare case - usually series fields are aggregated, not grouped)
        # But we support it for flexibility
        serie_bucket = serie.get('bucket')
        if serie_bucket and serie_field in df_polars.columns:
            df_polars, serie_field = apply_date_bucket(df_polars, serie_field, serie_bucket)
        
        # Apply aggregation for this series
        if serie_aggregation == 'count':
            df_serie_agg = df_polars.group_by(x_field).agg(pl.len().alias(serie_label))
        elif serie_aggregation == 'sum':
            df_serie_agg = df_polars.group_by(x_field).agg(pl.col(serie_field).sum().alias(serie_label))
        elif serie_aggregation == 'avg':
            df_serie_agg = df_polars.group_by(x_field).agg(pl.col(serie_field).mean().alias(serie_label))
        elif serie_aggregation == 'min':
            df_serie_agg = df_polars.group_by(x_field).agg(pl.col(serie_field).min().alias(serie_label))
        elif serie_aggregation == 'max':
            df_serie_agg = df_polars.group_by(x_field).agg(pl.col(serie_field).max().alias(serie_label))
        else:
            df_serie_agg = df_polars.select([x_field, pl.col(serie_field).alias(serie_label)])
        
        series_dfs.append(df_serie_agg)
    
    # Join all series DataFrames
    df_agg = series_dfs[0]
    for df_serie in series_dfs[1:]:
        df_agg = df_agg.join(df_serie, on=x_field, how='outer')
    
    # Store x_label
    x_axis['label'] = x_axis.get('label') or category_field_label or x_field

elif category_field and aggregation:
    # Determine the grouping field based on graph type:
    # - Pie charts: always use categoryField as the grouping field
    # - Bar/Line/etc: use xAxis.field if available, otherwise fall back to categoryField
    if graph_type and graph_type.lower() == 'pie':
        x_field = category_field  # Pie charts always group by categoryField
    else:
        # For bar charts and others, prefer xAxis.field for grouping
        x_field = x_axis.get('field') or category_field
    
    y_field = y_axis.get('field')
    
    # Determine the label for the x-axis
    if x_field == category_field and not x_axis.get('label'):
        x_label_for_agg = category_field_label or category_field
    else:
        x_label_for_agg = x_axis.get('label') or x_field
    
    if not y_field:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': 'yAxis.field is required when using aggregation'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
    # Validate fields exist (check both direct field and _id variant for lookups)
    available_columns = df_polars.columns
    missing_fields = []
    
    # Resolve x_field (try _id variant for lookups)
    # IMPORTANT: If x_field is category_field and bucket was applied, category_field already points to the bucketed column
    # So we should use category_field directly if it exists in columns (it's already the bucketed name)
    if x_field == category_field and category_field in available_columns:
        # category_field is already the bucketed field name, use it directly
        x_field = category_field
    else:
        resolved_x_field = resolve_field(x_field, available_columns)
        if resolved_x_field:
            x_field = resolved_x_field
        else:
            missing_fields.append(x_field)
    
    # Resolve y_field (try _id variant for lookups)
    resolved_y_field = resolve_field(y_field, available_columns)
    if resolved_y_field:
        y_field = resolved_y_field
    else:
        missing_fields.append(y_field)
    
    if missing_fields:
        available_cols_str = ', '.join([f"'{c}'" for c in list(available_columns)[:15]])
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': f'Fields not found in data: {", ".join(missing_fields)}. Available: [{available_cols_str}]'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
    # Apply bucket to x_field if specified
    x_axis_bucket = x_axis.get('bucket')
    if x_axis_bucket and x_field in df_polars.columns:
        df_polars, x_field = apply_date_bucket(df_polars, x_field, x_axis_bucket)
        # Atualizar x_axis['field'] para usar o campo bucketed na renderização
        x_axis['field'] = x_field
    
    # Apply aggregation in Polars (group by category)
    if aggregation == 'count':
        df_agg = df_polars.group_by(x_field).agg(pl.len().alias(y_field))
    elif aggregation == 'sum':
        df_agg = df_polars.group_by(x_field).agg(pl.col(y_field).sum().alias(y_field))
    elif aggregation == 'avg':
        df_agg = df_polars.group_by(x_field).agg(pl.col(y_field).mean().alias(y_field))
    elif aggregation == 'min':
        df_agg = df_polars.group_by(x_field).agg(pl.col(y_field).min().alias(y_field))
    elif aggregation == 'max':
        df_agg = df_polars.group_by(x_field).agg(pl.col(y_field).max().alias(y_field))
    else:
        df_agg = df_polars
    
    # Store x_label_for_agg for later use in chart generation
    x_axis['label'] = x_label_for_agg
elif aggregation and not category_field:
    # Aggregation without grouping (single value result)
    y_field = y_axis.get('field')
    if not y_field:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': 'yAxis.field is required when using aggregation'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
    # Resolve y_field (try _id variant for lookups)
    resolved_y = resolve_field(y_field, df_polars.columns)
    if not resolved_y:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
    y_field = resolved_y
    # Apply aggregation without grouping
    if aggregation == 'count':
        df_agg = pl.DataFrame({y_field: [len(df_polars)]})
    elif aggregation == 'sum':
        df_agg = pl.DataFrame({y_field: [df_polars[y_field].sum()]})
    elif aggregation == 'avg':
        df_agg = pl.DataFrame({y_field: [df_polars[y_field].mean()]})
    elif aggregation == 'min':
        df_agg = pl.DataFrame({y_field: [df_polars[y_field].min()]})
    elif aggregation == 'max':
        df_agg = pl.DataFrame({y_field: [df_polars[y_field].max()]})
    else:
        df_agg = df_polars
else:
    df_agg = df_polars

# 8. Convert aggregated result to Pandas (smaller dataset)
df_pandas = df_agg.to_pandas()

# 9. Generate chart with matplotlib
plt.figure(figsize=(width / 100, height / 100), dpi=100)
plt.rcParams['svg.fonttype'] = 'none'  # Use text instead of paths for better scalability

try:
    if graph_type and graph_type.lower() == 'bar':
        x_field = x_axis.get('field') or category_field
        
        if not x_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'xAxis.field is required for bar chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        # Resolve x_field
        resolved_x = resolve_field(x_field, df_pandas.columns)
        if not resolved_x:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {x_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        x_field = resolved_x
        
        x_label = x_axis.get('label') or x_field
        
        if use_series:
            # Multiple series - grouped bars
            x_values = df_pandas[x_field]
            bar_width = 0.8 / len(series)
            x_positions = range(len(x_values))
            
            for idx, serie in enumerate(series):
                serie_label = serie.get('label', serie.get('field'))
                serie_color = serie.get('color') or (colors[idx] if colors and idx < len(colors) else None)
                
                offset = bar_width * idx - (bar_width * len(series) / 2) + bar_width / 2
                positions = [x + offset for x in x_positions]
                
                if serie_label in df_pandas.columns:
                    plt.bar(positions, df_pandas[serie_label], width=bar_width, label=serie_label, color=serie_color)
            
            plt.xticks(x_positions, x_values, rotation=45, ha='right')
            plt.xlabel(x_label)
            plt.ylabel('Values')
            plt.title(title or f'Multiple Series by {x_label}')
            if show_legend:
                plt.legend()
        else:
            # Legacy single series
            y_field = y_axis.get('field')
            if not y_field:
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': 'yAxis.field is required for bar chart'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            
            resolved_y = resolve_field(y_field, df_pandas.columns)
            if not resolved_y:
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            y_field = resolved_y
            y_label = y_axis.get('label') or y_field
            
            plt.bar(df_pandas[x_field], df_pandas[y_field], color=colors[0] if colors else None)
            plt.xlabel(x_label)
            plt.ylabel(y_label)
            plt.title(title or f'{y_label} by {x_label}')
            plt.xticks(rotation=45, ha='right')
        
    elif graph_type and graph_type.lower() == 'line':
        x_field = x_axis.get('field')
        
        if not x_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'xAxis.field is required for line chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        resolved_x = resolve_field(x_field, df_pandas.columns)
        if not resolved_x:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {x_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        x_field = resolved_x
        
        x_label = x_axis.get('label') or x_field
        
        if use_series:
            # Multiple series
            for idx, serie in enumerate(series):
                serie_label = serie.get('label', serie.get('field'))
                serie_color = serie.get('color') or (colors[idx] if colors and idx < len(colors) else None)
                
                if serie_label in df_pandas.columns:
                    plt.plot(df_pandas[x_field], df_pandas[serie_label], marker='o', label=serie_label, color=serie_color)
            
            plt.xlabel(x_label)
            plt.ylabel('Values')
            plt.title(title or f'Multiple Series over {x_label}')
            plt.xticks(rotation=45, ha='right')
            if show_legend:
                plt.legend()
        else:
            # Legacy single series
            y_field = y_axis.get('field')
            if not y_field:
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': 'yAxis.field is required for line chart'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            
            resolved_y = resolve_field(y_field, df_pandas.columns)
            if not resolved_y:
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            y_field = resolved_y
            y_label = y_axis.get('label') or y_field
            
            plt.plot(df_pandas[x_field], df_pandas[y_field], marker='o', color=colors[0] if colors else None)
            plt.xlabel(x_label)
            plt.ylabel(y_label)
            plt.title(title or f'{y_label} over {x_label}')
            plt.xticks(rotation=45, ha='right')
        
    elif graph_type and graph_type.lower() == 'pie':
        if not category_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'categoryField is required for pie chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        y_field = y_axis.get('field')
        if not y_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'yAxis.field is required for pie chart (values field)'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        if not aggregation:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'aggregation is required for pie chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        # category_field should already be resolved and bucketed in the pre-resolution step
        # The category_field variable already points to the bucketed column name if bucket was applied
        # Check if it exists in the DataFrame (it should, as it was used in aggregation)
        if category_field not in df_pandas.columns:
            # Try one more resolution attempt (in case of lookup field variations)
            resolved_category = resolve_field(category_field, df_pandas.columns)
            if not resolved_category:
                # List available columns for debugging
                available_cols = list(df_pandas.columns)
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': f'Field not found: {category_field}. Available: {available_cols[:10]}'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            category_field = resolved_category
        
        # Resolve y_field
        resolved_y = resolve_field(y_field, df_pandas.columns)
        if not resolved_y:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        y_field = resolved_y
        
        # For pie chart, use aggregated data (should already be aggregated)
        if category_field in df_pandas.columns and y_field in df_pandas.columns:
            labels = df_pandas[category_field]
            values = df_pandas[y_field]
        else:
            # Fallback: count occurrences (shouldn't happen if aggregation was done correctly)
            value_counts = df_pandas[category_field].value_counts()
            labels = value_counts.index
            values = value_counts.values
        
        plt.pie(values, labels=labels, autopct='%1.1f%%', colors=colors)
        category_label = category_field_label or category_field
        plt.title(title or f'Distribution by {category_label}')
        
    elif graph_type and graph_type.lower() == 'scatter':
        x_field = x_axis.get('field')
        
        if not x_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'xAxis.field is required for scatter chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        resolved_x = resolve_field(x_field, df_pandas.columns)
        if not resolved_x:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {x_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        x_field = resolved_x
        
        x_label = x_axis.get('label') or x_field
        
        if use_series:
            # Multiple series
            for idx, serie in enumerate(series):
                serie_label = serie.get('label', serie.get('field'))
                serie_color = serie.get('color') or (colors[idx] if colors and idx < len(colors) else None)
                
                if serie_label in df_pandas.columns:
                    plt.scatter(df_pandas[x_field], df_pandas[serie_label], label=serie_label, color=serie_color, alpha=0.6)
            
            plt.xlabel(x_label)
            plt.ylabel('Values')
            plt.title(title or f'Multiple Series Scatter')
            if show_legend:
                plt.legend()
        else:
            # Legacy single series
            y_field = y_axis.get('field')
            if not y_field:
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': 'yAxis.field is required for scatter chart'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            
            resolved_y = resolve_field(y_field, df_pandas.columns)
            if not resolved_y:
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            y_field = resolved_y
            y_label = y_axis.get('label') or y_field
            
            plt.scatter(df_pandas[x_field], df_pandas[y_field], color=colors[0] if colors else None)
            plt.xlabel(x_label)
            plt.ylabel(y_label)
            plt.title(title or f'{y_label} vs {x_label}')
        
    elif graph_type and graph_type.lower() == 'histogram':
        y_field = y_axis.get('field')
        
        if not y_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'yAxis.field is required for histogram'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        # Resolve y_field (try _id variant for lookups)
        resolved_y = resolve_field(y_field, df_pandas.columns)
        if not resolved_y:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        y_field = resolved_y
        
        y_label = y_axis.get('label') or y_field
        
        # Configurar bins (estilo Excel)
        histogram_config = graph_config.get('histogram', {})
        bins = 30  # Default
        
        if histogram_config.get('binWidth'):
            # Calcular quantidade de bins baseado na largura
            data_min = df_pandas[y_field].min()
            data_max = df_pandas[y_field].max()
            bin_width = histogram_config['binWidth']
            bins = int((data_max - data_min) / bin_width) if bin_width > 0 else 30
        elif histogram_config.get('binCount'):
            bins = int(histogram_config['binCount'])
        
        # Aplicar underflow/overflow se especificado
        data = df_pandas[y_field].copy()
        if histogram_config.get('underflow') is not None:
            underflow_val = histogram_config['underflow']
            data = data[data >= underflow_val]
        if histogram_config.get('overflow') is not None:
            overflow_val = histogram_config['overflow']
            data = data[data <= overflow_val]
        
        plt.hist(data, bins=bins, color=colors[0] if colors else None)
        plt.xlabel(y_label)
        plt.ylabel('Frequency')
        plt.title(title or f'Distribution of {y_label}')
        
    elif graph_type and graph_type.lower() == 'timeseries':
        x_field = x_axis.get('field')
        
        if not x_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'xAxis.field is required for time series chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        resolved_x = resolve_field(x_field, df_pandas.columns)
        if not resolved_x:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {x_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        x_field = resolved_x
        
        # Convert x_field to datetime if it's a string
        if df_pandas[x_field].dtype == 'object':
            df_pandas[x_field] = pd.to_datetime(df_pandas[x_field], errors='coerce')
        
        x_label = x_axis.get('label') or x_field
        
        if use_series:
            # Multiple series
            for idx, serie in enumerate(series):
                serie_label = serie.get('label', serie.get('field'))
                serie_color = serie.get('color') or (colors[idx] if colors and idx < len(colors) else None)
                
                if serie_label in df_pandas.columns:
                    plt.plot(df_pandas[x_field], df_pandas[serie_label], marker='o', label=serie_label, color=serie_color)
            
            plt.xlabel(x_label)
            plt.ylabel('Values')
            plt.title(title or 'Multiple Series over time')
            plt.xticks(rotation=45, ha='right')
            plt.gcf().autofmt_xdate()
            if show_legend:
                plt.legend()
        else:
            # Legacy single series
            y_field = y_axis.get('field')
            if not y_field:
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': 'yAxis.field is required for time series chart'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            
            resolved_y = resolve_field(y_field, df_pandas.columns)
            if not resolved_y:
                error_response = json.dumps({
                    'jsonrpc': '2.0',
                    'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
                })
                print(error_response, flush=True)
                sys.exit(1)
            y_field = resolved_y
            y_label = y_axis.get('label') or y_field
            
            plt.plot(df_pandas[x_field], df_pandas[y_field], marker='o', color=colors[0] if colors else None)
            plt.xlabel(x_label)
            plt.ylabel(y_label)
            plt.title(title or f'{y_label} over time')
            plt.xticks(rotation=45, ha='right')
            plt.gcf().autofmt_xdate()
        
    else:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': f'Unsupported graph type: {graph_type}'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
    if show_grid:
        plt.grid(True, alpha=0.3)
    
    if not show_legend and graph_type and graph_type.lower() != 'pie':
        plt.legend().set_visible(False)
    
    plt.tight_layout()
    
    # 9. Export SVG to stdout
    svg_buffer = io.StringIO()
    plt.savefig(svg_buffer, format='svg', bbox_inches='tight')
    svg_content = svg_buffer.getvalue()
    svg_buffer.close()
    plt.close()
    
    # Print RPC response first
    rpc_response = json.dumps({
        'jsonrpc': '2.0',
        'result': {'status': 'success'}
    })
    print(rpc_response, flush=True)
    
    # Then print SVG content
    print(svg_content, flush=True)
    
except Exception as e:
    error_response = json.dumps({
        'jsonrpc': '2.0',
        'error': {'code': -32603, 'message': f'Error generating graph: {str(e)}'}
    })
    print(error_response, flush=True)
    sys.exit(1)

