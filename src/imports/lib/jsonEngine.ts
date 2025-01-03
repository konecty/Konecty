import { DocumentEvent } from '@imports/model/Document/DocumentEvents';
import { Engine, TopLevelCondition } from 'json-rules-engine';
import get from 'lodash/get';

export function createEngine(rules: DocumentEvent[]) {
	const engine = new Engine(
		rules.map(rule => ({
			event: { type: rule.event.type, params: rule.event },
			conditions: rule.conditions as TopLevelCondition,
			name: rule.name,
		})),
		{ allowUndefinedFacts: true },
	);

	engine.addOperator('hasKey', (factValue, jsonValue: string) => {
		if (typeof factValue !== 'object' || factValue === null) {
			return false;
		}

		return get(factValue, jsonValue) !== undefined;
	});

	engine.addOperator('hasKeys', (factValue, jsonValue: string[]) => {
		if (typeof factValue !== 'object' || factValue === null || Array.isArray(jsonValue) === false) {
			return false;
		}

		return jsonValue.some(key => get(factValue, key) !== undefined);
	});

	engine.setCondition('has-id', { any: [{ fact: 'data', operator: 'hasKey', value: '_id' }] });
	engine.setCondition('operation:create', { any: [{ fact: 'operation', operator: 'equal', value: 'create' }] });
	engine.setCondition('operation:update', { any: [{ fact: 'operation', operator: 'equal', value: 'update' }] });
	engine.setCondition('operation:delete', { any: [{ fact: 'operation', operator: 'equal', value: 'delete' }] });

	return engine;
}
