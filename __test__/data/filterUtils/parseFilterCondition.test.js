import { parseFilterCondition } from '../../../src/imports/data/filterUtils';

describe('FilterUtils > ParseFilterCondition', () => {
	it('should successfully parse a condition for equals', () => {
		const metaObject = {
			_id: 'example',
			fields: {
				name: {
					type: 'text',
				},
				age: {
					type: 'number',
				},
			},
		};

		const condition = {
			term: 'name',
			operator: 'equals',
			value: 'John',
		};

		const req = {
			user: {
				_id: 'user123',
			},
		};

		const result = parseFilterCondition(condition, metaObject, req);

		expect(result.success).toBe(true);

		expect(result.data).toEqual({ name: 'John' });
	});

	it('should successfully parse condition for not_equals', () => {
		const metaObject = {
			_id: 'example',
			fields: {
				name: {
					type: 'text',
				},
				age: {
					type: 'number',
				},
			},
		};

		const condition = {
			term: 'name',
			operator: 'not_equals',
			value: 'Lenny',
		};

		const req = {
			user: {
				_id: 'user123',
			},
		};

		const result = parseFilterCondition(condition, metaObject, req);

		expect(result.success).toBe(true);
		expect(result.data).toEqual({ name: { $ne: 'Lenny' } });
	});

	it('should correctly handle _id field as ObjectId type', () => {
		const metaObject = {
			_id: 'example',
			fields: {
				_id: {
					type: 'ObjectId',
				},
			},
		};

		const condition = {
			term: '_id',
			operator: 'equals',
			value: '123',
		};

		const req = {
			user: {
				_id: 'user123',
			},
		};

		const result = parseFilterCondition(condition, metaObject, req);

		expect(result.success).toBe(true);
		expect(result.data).toEqual({ _id: '123' });
	});

	it('should correctly handle encrypted field type', () => {
		const metaObject = {
			_id: 'example',
			fields: {
				password: {
					type: 'encrypted',
				},
			},
		};

		const condition = {
			term: 'password',
			operator: 'equals',
			value: 'password123',
		};

		const req = {
			user: {
				_id: 'user123',
			},
		};

		const result = parseFilterCondition(condition, metaObject, req);

		expect(result.success).toBe(true);
		expect(result.data).toEqual({ password: '482c811da5d5b4bc6d497ffa98491e38' });
	});

	it('should return errorReturn for invalid operator', () => {
		const metaObject = {
			_id: 'example',
			fields: {
				name: {
					type: 'String',
				},
			},
		};

		const condition = {
			term: 'name',
			operator: 'invalid_operator',
			value: 'John',
		};

		const req = {
			user: {
				_id: 'user123',
			},
		};

		const result = parseFilterCondition(condition, metaObject, req);

		expect(result.success).toBe(false);
		expect(result.errors).toHaveLength(1);
	});

	it('should return errorReturn for non-existent field', () => {
		const metaObject = {
			_id: 'example',
			fields: {
				name: {
					type: 'String',
				},
			},
		};

		const condition = {
			term: 'age',
			operator: 'equals',
			value: 25,
		};

		const req = {
			user: {
				_id: 'user123',
			},
		};

		const result = parseFilterCondition(condition, metaObject, req);

		expect(result.success).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].message).toBe('Field [age] does not exists at [example]');
	});
});
