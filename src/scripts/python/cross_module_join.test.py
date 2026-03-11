# /// script
# dependencies = [
#   "pytest",
# ]
# ///

"""
Tests for cross_module_join.py
Run with: uv run --script pytest cross_module_join.test.py
"""

import json
import subprocess
from pathlib import Path
from typing import Any

SCRIPT_PATH = Path(__file__).parent / 'cross_module_join.py'
SUBPROCESS_TIMEOUT = 30

PARENT_COUNT = 3
CHILD_COUNT_ALICE = 2
CHILD_COUNT_BRUNO = 1
SUM_ALICE = 150000.0
SUM_BRUNO = 300000.0
AVG_ALICE = 75000.0


def run_cross_module_join(config: dict, datasets: dict[str, list[dict]]) -> list[dict]:
    """Helper: runs cross_module_join.py with stdin and returns parsed result records."""
    rpc_request = {
        'jsonrpc': '2.0',
        'method': 'aggregate',
        'params': {'config': config},
    }

    input_lines = [json.dumps(rpc_request)]

    for dataset_name, records in datasets.items():
        for record in records:
            tagged = {**record, '_dataset': dataset_name}
            input_lines.append(json.dumps(tagged))

    stdin_input = '\n'.join(input_lines) + '\n'

    result = subprocess.run(
        ['uv', 'run', '--script', str(SCRIPT_PATH)],
        input=stdin_input,
        capture_output=True,
        text=True,
        timeout=SUBPROCESS_TIMEOUT,
    )

    lines = [l for l in result.stdout.strip().split('\n') if l.strip()]
    assert len(lines) >= 1, f'Expected at least 1 output line, got {len(lines)}. stderr: {result.stderr}'

    rpc_response = json.loads(lines[0])
    assert 'result' in rpc_response, f'RPC error: {rpc_response}'

    records_out = []
    for line in lines[1:]:
        records_out.append(json.loads(line))

    return records_out


CONTACTS = [
    {'_id': 'c1', 'code': 1001, 'name': {'full': 'Alice Santos'}},
    {'_id': 'c2', 'code': 1002, 'name': {'full': 'Bruno Silva'}},
    {'_id': 'c3', 'code': 1003, 'name': {'full': 'Carlos Mendes'}},
]

OPPORTUNITIES = [
    {'_id': 'o1', 'contact': {'_id': 'c1'}, 'status': 'Nova', 'value': 50000},
    {'_id': 'o2', 'contact': {'_id': 'c1'}, 'status': 'Em Visitacao', 'value': 100000},
    {'_id': 'o3', 'contact': {'_id': 'c2'}, 'status': 'Nova', 'value': 300000},
]


def make_config(aggregators: dict) -> dict:
    return {
        'parentDataset': 'Contact',
        'relations': [
            {
                'dataset': 'Opportunity',
                'parentKey': '_id',
                'childKey': 'contact._id',
                'aggregators': aggregators,
            },
        ],
    }


def make_datasets() -> dict:
    return {
        'Contact': CONTACTS,
        'Opportunity': OPPORTUNITIES,
    }


def test_count():
    config = make_config({'oppCount': {'aggregator': 'count'}})
    results = run_cross_module_join(config, make_datasets())
    assert len(results) == PARENT_COUNT
    alice = next(r for r in results if r['_id'] == 'c1')
    bruno = next(r for r in results if r['_id'] == 'c2')
    carlos = next(r for r in results if r['_id'] == 'c3')
    assert alice['oppCount'] == CHILD_COUNT_ALICE
    assert bruno['oppCount'] == CHILD_COUNT_BRUNO
    assert carlos['oppCount'] == 0


def test_sum():
    config = make_config({'totalValue': {'aggregator': 'sum', 'field': 'value'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    bruno = next(r for r in results if r['_id'] == 'c2')
    carlos = next(r for r in results if r['_id'] == 'c3')
    assert alice['totalValue'] == SUM_ALICE
    assert bruno['totalValue'] == SUM_BRUNO
    assert carlos['totalValue'] == 0


def test_avg():
    config = make_config({'avgValue': {'aggregator': 'avg', 'field': 'value'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['avgValue'] == AVG_ALICE


def test_min():
    config = make_config({'minValue': {'aggregator': 'min', 'field': 'value'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['minValue'] == 50000.0


def test_max():
    config = make_config({'maxValue': {'aggregator': 'max', 'field': 'value'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['maxValue'] == 100000.0


def test_first():
    config = make_config({'firstOpp': {'aggregator': 'first'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['firstOpp']['_id'] == 'o1'
    assert '_dataset' not in alice['firstOpp']


def test_first_with_field():
    config = make_config({'firstStatus': {'aggregator': 'first', 'field': 'status'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['firstStatus'] == 'Nova'


def test_last():
    config = make_config({'lastOpp': {'aggregator': 'last'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['lastOpp']['_id'] == 'o2'


def test_last_with_field():
    config = make_config({'lastStatus': {'aggregator': 'last', 'field': 'status'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['lastStatus'] == 'Em Visitacao'


def test_push():
    config = make_config({'opportunities': {'aggregator': 'push'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert len(alice['opportunities']) == CHILD_COUNT_ALICE
    for opp in alice['opportunities']:
        assert '_dataset' not in opp


def test_push_with_field():
    config = make_config({'statuses': {'aggregator': 'push', 'field': 'status'}})
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['statuses'] == ['Nova', 'Em Visitacao']


def test_addToSet():
    config = make_config({'uniqueStatuses': {'aggregator': 'addToSet', 'field': 'status'}})
    opps_with_dupes = OPPORTUNITIES + [
        {'_id': 'o4', 'contact': {'_id': 'c1'}, 'status': 'Nova', 'value': 0},
    ]
    datasets = {'Contact': CONTACTS, 'Opportunity': opps_with_dupes}
    results = run_cross_module_join(config, datasets)
    alice = next(r for r in results if r['_id'] == 'c1')
    assert set(alice['uniqueStatuses']) == {'Nova', 'Em Visitacao'}


def test_multiple_aggregators():
    config = make_config({
        'count': {'aggregator': 'count'},
        'total': {'aggregator': 'sum', 'field': 'value'},
        'first': {'aggregator': 'first', 'field': 'status'},
    })
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['count'] == CHILD_COUNT_ALICE
    assert alice['total'] == SUM_ALICE
    assert alice['first'] == 'Nova'


def test_empty_parent_no_matches():
    config = make_config({'count': {'aggregator': 'count'}})
    results = run_cross_module_join(config, make_datasets())
    carlos = next(r for r in results if r['_id'] == 'c3')
    assert carlos['count'] == 0


def test_empty_dataset():
    config = make_config({'count': {'aggregator': 'count'}})
    datasets = {'Contact': CONTACTS, 'Opportunity': []}
    results = run_cross_module_join(config, datasets)
    assert len(results) == PARENT_COUNT
    for r in results:
        assert r['count'] == 0


def test_no_parent_records():
    config = make_config({'count': {'aggregator': 'count'}})
    datasets = {'Contact': [], 'Opportunity': OPPORTUNITIES}
    results = run_cross_module_join(config, datasets)
    assert len(results) == 0


def test_nested_field_value():
    config = {
        'parentDataset': 'Contact',
        'relations': [
            {
                'dataset': 'Opportunity',
                'parentKey': '_id',
                'childKey': 'contact._id',
                'aggregators': {
                    'firstName': {'aggregator': 'first', 'field': 'contact._id'},
                },
            },
        ],
    }
    results = run_cross_module_join(config, make_datasets())
    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['firstName'] == 'c1'


def test_recursive_relations():
    products = [
        {'_id': 'p1', 'code': 'PROD-1'},
        {'_id': 'p2', 'code': 'PROD-2'},
    ]
    ppos = [
        {'_id': 'ppo1', 'opportunity': {'_id': 'o1'}, 'product': {'_id': 'p1'}, 'status': 'Ofertado'},
        {'_id': 'ppo2', 'opportunity': {'_id': 'o1'}, 'product': {'_id': 'p2'}, 'status': 'Visitado'},
        {'_id': 'ppo3', 'opportunity': {'_id': 'o3'}, 'product': {'_id': 'p1'}, 'status': 'Ofertado'},
    ]

    config = {
        'parentDataset': 'Contact',
        'relations': [
            {
                'dataset': 'Opportunity',
                'parentKey': '_id',
                'childKey': 'contact._id',
                'aggregators': {
                    'oppCount': {'aggregator': 'count'},
                    'opportunities': {'aggregator': 'push'},
                },
                'relations': [
                    {
                        'dataset': 'PPO',
                        'parentKey': '_id',
                        'childKey': 'opportunity._id',
                        'aggregators': {
                            'ppoCount': {'aggregator': 'count'},
                            'ppoStatuses': {'aggregator': 'push', 'field': 'status'},
                        },
                    },
                ],
            },
        ],
    }

    datasets = {
        'Contact': CONTACTS,
        'Opportunity': OPPORTUNITIES,
        'PPO': ppos,
    }

    results = run_cross_module_join(config, datasets)

    alice = next(r for r in results if r['_id'] == 'c1')
    assert alice['oppCount'] == CHILD_COUNT_ALICE

    opp_o1 = next(o for o in alice['opportunities'] if o['_id'] == 'o1')
    assert opp_o1['ppoCount'] == 2
    assert set(opp_o1['ppoStatuses']) == {'Ofertado', 'Visitado'}
