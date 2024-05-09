import { parseConditionValue } from '../../../src/imports/data/filterUtils';
import { errorReturn, successReturn } from '../../../src/imports/utils/return';

describe('FilterUtils > ParseConditionValue', () => {
	it('should return successReturn with user id when condition value is "$user"', () => {
		const condition = {
			term: '_user._id',
			operator: 'equals',
			value: '$user',
		};

		const field = {
			type: 'lookup',
		};

		const user = {
			_id: '123456789',
		};

		const result = parseConditionValue(condition, field, { user }, '._id');
		expect(result).toEqual(successReturn(user._id));
	});

	it('should return successReturn with user group id when condition value is "$group"', () => {
		const condition = {
			term: 'group._id',
			operator: 'equals',
			value: '$group',
		};

		const field = {
			type: 'lookup',
		};

		const user = {
			_id: '123456789',
			age: 25,
			group: {
				_id: 'group123',
			},
		};

		const result = parseConditionValue(condition, field, { user }, '._id');
		expect(result).toEqual(successReturn(user.group._id));
	});

	it('should return successReturn with array of user group ids when condition value is "$allgroups"', () => {
		const condition = {
			term: 'group._id',
			operator: 'in',
			value: '$allgroups',
		};

		const field = {
			type: 'lookup',
		};

		const user = {
			_id: '123456789',
			age: 25,
			group: { _id: 'thegroup' },
			groups: [{ _id: 'group1' }, { _id: 'group2' }],
		};

		const result = parseConditionValue(condition, field, { user }, '._id');
		expect(result).toEqual(successReturn(['thegroup', 'group1', 'group2']));
	});

	// returns errorReturn when MetaObject.Meta[field.document] is not found for lookup field
	it('should return errorReturn when MetaObject.Meta[field.document] is not found for lookup field', () => {
		const condition = {
			term: 'lookupField._id',
			operator: 'greater_than',
			value: 'value',
		};

		const field = {
			name: 'lookupField',
			type: 'lookup',
			document: 'documentId',
		};

		const user = {
			_id: '123456789',
			age: 25,
		};

		const subTermPart = '.name';

		const result = parseConditionValue(condition, field, { user }, subTermPart);
		expect(result).toEqual(errorReturn('MetaObject.Meta documentId of field lookupField not found'));
	});

	// returns successReturn with current date when condition value is '$now'
	it('should return successReturn with current date when condition value is "$now"', () => {
		const condition = {
			term: 'date',
			operator: 'greater_than',
			value: '$now',
		};

		const field = {
			type: 'date',
		};

		const user = {
			_id: '123456789',
			date: new Date(),
		};

		const subTermPart = '';

		const result = parseConditionValue(condition, field, { user }, subTermPart);
		expect(result.success).toBe(true);
		expect(result.data).toBeInstanceOf(Date);
	});

	// returns successReturn with user property value when condition value is '$user.{property}'
	it('should return successReturn with user property value when condition value is "$user.{property}"', () => {
		const condition = {
			term: 'name',
			operator: 'equals',
			value: '$user.name',
		};

		const field = {
			type: 'String',
		};

		const user = {
			_id: '123456789',
			name: 'John Doe',
		};

		const subTermPart = '';

		const result = parseConditionValue(condition, field, { user }, subTermPart);
		expect(result).toEqual(successReturn(user.name));
	});
});
