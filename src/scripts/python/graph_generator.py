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
        'error': {'code': -32602, 'message': 'No data provided for graph'}
    })
    print(error_response, flush=True)
    sys.exit(1)

df_polars = pl.DataFrame(flattened_data)

# 5. Extract configuration
graph_type = graph_config.get('type')
category_field = graph_config.get('categoryField')
aggregation = graph_config.get('aggregation')
x_axis = graph_config.get('xAxis', {})
y_axis = graph_config.get('yAxis', {})
title = graph_config.get('title', '')
width = graph_config.get('width', 800)
height = graph_config.get('height', 600)
colors = graph_config.get('colors')
show_legend = graph_config.get('showLegend', True)
show_grid = graph_config.get('showGrid', True)

# 6. Apply aggregations in Polars (fast)
if category_field and aggregation:
    x_field = x_axis.get('field') or category_field
    y_field = y_axis.get('field')
    
    if not y_field:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': 'yAxis.field is required when using aggregation'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
    # Validate fields exist
    available_columns = df_polars.columns
    missing_fields = []
    if x_field not in available_columns:
        missing_fields.append(x_field)
    if y_field not in available_columns:
        missing_fields.append(y_field)
    
    if missing_fields:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': f'Fields not found in data: {", ".join(missing_fields)}'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
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
    
    if y_field not in df_polars.columns:
        error_response = json.dumps({
            'jsonrpc': '2.0',
            'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
        })
        print(error_response, flush=True)
        sys.exit(1)
    
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

# 7. Convert aggregated result to Pandas (smaller dataset)
df_pandas = df_agg.to_pandas()

# 8. Generate chart with matplotlib
plt.figure(figsize=(width / 100, height / 100), dpi=100)
plt.rcParams['svg.fonttype'] = 'none'  # Use text instead of paths for better scalability

try:
    if graph_type == 'bar':
        x_field = x_axis.get('field') or category_field
        y_field = y_axis.get('field')
        
        if not x_field or not y_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'xAxis.field and yAxis.field are required for bar chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        if x_field not in df_pandas.columns or y_field not in df_pandas.columns:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Fields not found: {x_field} or {y_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        x_label = x_axis.get('label') or x_field
        y_label = y_axis.get('label') or y_field
        
        plt.bar(df_pandas[x_field], df_pandas[y_field], color=colors[0] if colors else None)
        plt.xlabel(x_label)
        plt.ylabel(y_label)
        plt.title(title or f'{y_label} by {x_label}')
        plt.xticks(rotation=45, ha='right')
        
    elif graph_type == 'line':
        x_field = x_axis.get('field')
        y_field = y_axis.get('field')
        
        if not x_field or not y_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'xAxis.field and yAxis.field are required for line chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        if x_field not in df_pandas.columns or y_field not in df_pandas.columns:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Fields not found: {x_field} or {y_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        x_label = x_axis.get('label') or x_field
        y_label = y_axis.get('label') or y_field
        
        plt.plot(df_pandas[x_field], df_pandas[y_field], marker='o', color=colors[0] if colors else None)
        plt.xlabel(x_label)
        plt.ylabel(y_label)
        plt.title(title or f'{y_label} over {x_label}')
        plt.xticks(rotation=45, ha='right')
        
    elif graph_type == 'pie':
        if not category_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'categoryField is required for pie chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        y_field = y_axis.get('field') or 'count'
        
        if category_field not in df_pandas.columns:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {category_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        # For pie chart, if aggregation was done, use the aggregated column
        if category_field and aggregation and y_field in df_pandas.columns:
            labels = df_pandas[category_field]
            values = df_pandas[y_field]
        else:
            # Count occurrences
            value_counts = df_pandas[category_field].value_counts()
            labels = value_counts.index
            values = value_counts.values
        
        plt.pie(values, labels=labels, autopct='%1.1f%%', colors=colors)
        plt.title(title or f'Distribution by {category_field}')
        
    elif graph_type == 'scatter':
        x_field = x_axis.get('field')
        y_field = y_axis.get('field')
        
        if not x_field or not y_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'xAxis.field and yAxis.field are required for scatter chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        if x_field not in df_pandas.columns or y_field not in df_pandas.columns:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Fields not found: {x_field} or {y_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        x_label = x_axis.get('label') or x_field
        y_label = y_axis.get('label') or y_field
        
        plt.scatter(df_pandas[x_field], df_pandas[y_field], color=colors[0] if colors else None)
        plt.xlabel(x_label)
        plt.ylabel(y_label)
        plt.title(title or f'{y_label} vs {x_label}')
        
    elif graph_type == 'histogram':
        y_field = y_axis.get('field')
        
        if not y_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'yAxis.field is required for histogram'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        if y_field not in df_pandas.columns:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Field not found: {y_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        y_label = y_axis.get('label') or y_field
        
        plt.hist(df_pandas[y_field], bins=30, color=colors[0] if colors else None)
        plt.xlabel(y_label)
        plt.ylabel('Frequency')
        plt.title(title or f'Distribution of {y_label}')
        
    elif graph_type == 'timeSeries':
        x_field = x_axis.get('field')
        y_field = y_axis.get('field')
        
        if not x_field or not y_field:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': 'xAxis.field and yAxis.field are required for time series chart'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        if x_field not in df_pandas.columns or y_field not in df_pandas.columns:
            error_response = json.dumps({
                'jsonrpc': '2.0',
                'error': {'code': -32602, 'message': f'Fields not found: {x_field} or {y_field}'}
            })
            print(error_response, flush=True)
            sys.exit(1)
        
        # Convert x_field to datetime if it's a string
        if df_pandas[x_field].dtype == 'object':
            df_pandas[x_field] = pd.to_datetime(df_pandas[x_field], errors='coerce')
        
        x_label = x_axis.get('label') or x_field
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
    
    if not show_legend and graph_type != 'pie':
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

