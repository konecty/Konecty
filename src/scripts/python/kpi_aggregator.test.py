"""
Tests for kpi_aggregator.py
Run with: uv run --script pytest kpi_aggregator.test.py
"""

import json
import subprocess
import os
import sys
from pathlib import Path

SCRIPT_PATH = Path(__file__).parent / 'kpi_aggregator.py'

# ADR-0012: no-magic-numbers
EXPECTED_SUM = 60.0  # 10 + 20 + 30
EXPECTED_AVG = 20.0  # 60 / 3
EXPECTED_MIN = 10.0
EXPECTED_MAX = 30.0
SAMPLE_COUNT = 3
DECIMAL_PLACES = 4


def run_kpi_aggregator(rpc_request: dict, ndjson_data: list[dict]) -> dict:
    """Helper: runs kpi_aggregator.py with stdin and returns parsed result."""
    input_lines = [json.dumps(rpc_request)]
    input_lines.extend(json.dumps(row) for row in ndjson_data)
    stdin_input = '\n'.join(input_lines) + '\n'

    result = subprocess.run(
        ['uv', 'run', '--script', str(SCRIPT_PATH)],
        input=stdin_input,
        capture_output=True,
        text=True,
        timeout=30,
    )

    lines = result.stdout.strip().split('\n')
    assert len(lines) >= 2, f'Expected at least 2 output lines, got {len(lines)}. stderr: {result.stderr}'

    rpc_response = json.loads(lines[0])
    assert 'result' in rpc_response, f'RPC error: {rpc_response}'

    result_data = json.loads(lines[1])
    return result_data


SAMPLE_DATA = [
    {'_id': '1', 'amount': 10, 'total': 50},
    {'_id': '2', 'amount': 20, 'total': 30},
    {'_id': '3', 'amount': 30, 'total': 20},
]


def test_sum():
    result = run_kpi_aggregator(
        {'method': 'aggregate', 'params': {'config': {'operation': 'sum', 'field': 'amount'}}},
        SAMPLE_DATA,
    )
    assert result['result'] == EXPECTED_SUM
    assert result['count'] == SAMPLE_COUNT


def test_avg():
    result = run_kpi_aggregator(
        {'method': 'aggregate', 'params': {'config': {'operation': 'avg', 'field': 'amount'}}},
        SAMPLE_DATA,
    )
    assert result['result'] == EXPECTED_AVG
    assert result['count'] == SAMPLE_COUNT


def test_min():
    result = run_kpi_aggregator(
        {'method': 'aggregate', 'params': {'config': {'operation': 'min', 'field': 'amount'}}},
        SAMPLE_DATA,
    )
    assert result['result'] == EXPECTED_MIN


def test_max():
    result = run_kpi_aggregator(
        {'method': 'aggregate', 'params': {'config': {'operation': 'max', 'field': 'amount'}}},
        SAMPLE_DATA,
    )
    assert result['result'] == EXPECTED_MAX


def test_nested_fields():
    nested_data = [
        {'_id': '1', 'value': {'amount': 100}},
        {'_id': '2', 'value': {'amount': 200}},
    ]
    result = run_kpi_aggregator(
        {'method': 'aggregate', 'params': {'config': {'operation': 'sum', 'field': 'value.amount'}}},
        nested_data,
    )
    assert result['result'] == 300.0
    assert result['count'] == 2


def test_empty_data():
    result = run_kpi_aggregator(
        {'method': 'aggregate', 'params': {'config': {'operation': 'sum', 'field': 'amount'}}},
        [],
    )
    assert result['result'] == 0
    assert result['count'] == 0


def test_null_values():
    data_with_nulls = [
        {'_id': '1', 'amount': 10},
        {'_id': '2', 'amount': None},
        {'_id': '3', 'amount': 30},
    ]
    result = run_kpi_aggregator(
        {'method': 'aggregate', 'params': {'config': {'operation': 'sum', 'field': 'amount'}}},
        data_with_nulls,
    )
    assert result['result'] == 40.0
    assert result['count'] == 3
    assert result['validCount'] == 2


if __name__ == '__main__':
    test_sum()
    test_avg()
    test_min()
    test_max()
    test_nested_fields()
    test_empty_data()
    test_null_values()
    print('All Python KPI aggregator tests passed!')
