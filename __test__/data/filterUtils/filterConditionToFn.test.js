import { filterConditionToFn } from '../../../src/imports/data/filterUtils';

describe('filterConditionToFn', () => {
	it('should return a function that correctly filters data based on the given condition', () => {
		const condition = {
			term: 'name',
			operator: 'equals',
			value: 'John',
		};

		const metaObject = {
			_id: '123',
			fields: {
				name: {
					type: 'text',
				},
			},
		};

		const result = filterConditionToFn(condition, metaObject, { user: '123' });
		expect(result.success).toBe(true);
		expect(result.data).toBeInstanceOf(Function);

		const data = { name: 'John' };
		expect(result.data(data)).toBe(true);

		const data2 = { name: 'Jane' };
		expect(result.data(data2)).toBe(false);
	});

	it('should correctly handle conditions with valid term, operator and value', () => {
		const condition = {
			term: 'age',
			operator: 'greater_than',
			value: 18,
		};

		const metaObject = {
			_id: '123',
			fields: {
				age: {
					type: 'number',
				},
			},
		};

		const result = filterConditionToFn(condition, metaObject, { user: '123' });
		expect(result.success).toBe(true);
		expect(result.data).toBeInstanceOf(Function);

		const data = { age: 20 };
		expect(result.data(data)).toBe(true);

		const data2 = { age: 16 };
		expect(result.data(data2)).toBe(false);
	});

	it('should correctly handle conditions with _id as term', () => {
		const condition = {
			term: '_id',
			operator: 'equals',
			value: '123',
		};

		const metaObject = {
			_id: '123',
			fields: {},
		};

		const result = filterConditionToFn(condition, metaObject, { user: '123' });
		expect(result.success).toBe(true);
		expect(result.data).toBeInstanceOf(Function);

		const data = { _id: '123' };
		expect(result.data(data)).toBe(true);

		const data2 = { _id: '456' };
		expect(result.data(data2)).toBe(false);
	});

	it('should return an error when condition is missing term, operator or value', () => {
		const condition1 = {
			operator: 'equals',
			value: 'John',
		};

		const metaObject1 = {
			_id: '123',
			fields: {
				name: {
					type: 'String',
				},
			},
		};

		const req = { user: '123' };

		const result1 = filterConditionToFn(condition1, metaObject1, req);
		expect(result1).toEqual({
			success: false,
			errors: [
				{
					message: 'All conditions must contain term, operator and value',
				},
			],
		});

		const condition2 = {
			term: 'name',
			value: 'John',
		};

		const metaObject2 = {
			_id: '123',
			fields: {
				name: {
					type: 'String',
				},
			},
		};

		const result2 = filterConditionToFn(condition2, metaObject2, req);
		expect(result2).toEqual({
			success: false,
			errors: [
				{
					message: 'All conditions must contain term, operator and value',
				},
			],
		});

		const condition3 = {
			term: 'name',
			operator: 'equals',
		};

		const metaObject3 = {
			_id: '123',
			fields: {
				name: {
					type: 'String',
				},
			},
		};

		const result3 = filterConditionToFn(condition3, metaObject3, req);
		expect(result3).toEqual({
			success: false,
			errors: [
				{
					message: 'All conditions must contain term, operator and value',
				},
			],
		});
	});

	it('should correctly handle conditions with sub-terms', () => {
		const condition = {
			term: 'address.place',
			operator: 'equals',
			value: 'Nilo',
		};

		const metaObject = {
			_id: '123',
			fields: {
				address: {
					type: 'address',
				},
			},
		};

		const result = filterConditionToFn(condition, metaObject, { user: '123' });
		expect(result.success).toBe(true);
		expect(result.data).toBeInstanceOf(Function);

		const data = { address: { place: 'Nilo' } };
		expect(result.data(data)).toBe(true);

		const data2 = { address: { place: 'Broadway' } };
		expect(result.data(data2)).toBe(false);
	});

	it('should correctly handle conditions with special values', () => {
		const condition1 = {
			term: '_id',
			operator: 'equals',
			value: '$user',
		};

		const condition2 = {
			term: 'group._id',
			operator: 'equals',
			value: '$group',
		};

		const condition3 = {
			term: 'group._id',
			operator: 'in',
			value: '$groups',
		};

		const condition4 = {
			term: 'group._id',
			operator: 'in',
			value: '$allgroups',
		};

		const condition5 = {
			term: '_createdAt',
			operator: 'greater_than',
			value: '$now',
		};

		const metaObject = {
			_id: '123',
			fields: {
				_id: {
					type: 'text',
				},
				group: {
					type: 'lookup',
					document: 'Group',
				},
				groups: {
					type: 'lookup',
					isArray: true,
					document: 'Group',
				},
				_createdAt: {
					type: 'date',
				},
			},
		};

		const req = {
			user: {
				_id: 'user123',
				group: {
					_id: 'group123',
				},
				groups: [{ _id: 'group456' }, { _id: 'group789' }],
			},
		};

		const result1 = filterConditionToFn(condition1, metaObject, req);
		expect(result1.success).toBe(true);
		expect(result1.data).toBeInstanceOf(Function);
		expect(result1.data({ _id: 'user123' })).toBe(true);
		expect(result1.data({ _id: 'user456' })).toBe(false);

		const result2 = filterConditionToFn(condition2, metaObject, req);
		expect(result2.success).toBe(true);
		expect(result2.data).toBeInstanceOf(Function);
		expect(result2.data({ group: { _id: 'group123' } })).toBe(true);
		expect(result2.data({ group: { _id: 'group456' } })).toBe(false);

		const result3 = filterConditionToFn(condition3, metaObject, req);
		expect(result3.success).toBe(true);
		expect(result3.data).toBeInstanceOf(Function);
		expect(result3.data({ group: { _id: 'group456' } })).toBe(true);
		expect(result3.data({ group: { _id: 'group123' } })).toBe(false);

		const result4 = filterConditionToFn(condition4, metaObject, req);
		expect(result4.success).toBe(true);
		expect(result4.data).toBeInstanceOf(Function);
		expect(result4.data({ group: { _id: 'group456' } })).toBe(true);
		expect(result4.data({ group: { _id: 'group123' } })).toBe(true);
		expect(result4.data({ group: { _id: 'group666' } })).toBe(false);

		const result5 = filterConditionToFn(condition5, metaObject, req);
		expect(result5.success).toBe(true);
		expect(result5.data).toBeInstanceOf(Function);
		expect(result5.data({ _createdAt: new Date('2022-01-01') })).toBe(false);
	});

	it('should return error if no logged user is provided', () => {
		const condition = {
			term: 'name',
			operator: 'equals',
			value: 'John',
		};

		const metaObject = {
			_id: '123',
			fields: {
				name: {
					type: 'text',
				},
			},
		};

		const result = filterConditionToFn(condition, metaObject, undefined);
		expect(result.success).toBe(false);
		expect(result.errors).toEqual([{ message: 'Logged user is required to parse condition' }]);
	});
});
