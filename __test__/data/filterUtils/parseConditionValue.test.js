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

	// --- Dynamic date variables ---

	const dateField = { type: 'date' };
	const dateUser = { _id: 'u1' };
	const dateCondition = (value) => ({ term: 'date', operator: 'greater_than', value });

	describe('Dynamic date variable: $today', () => {
		it('should return start of today (00:00:00.000)', () => {
			const before = new Date();
			before.setHours(0, 0, 0, 0);

			const result = parseConditionValue(dateCondition('$today'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data).toBeInstanceOf(Date);
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMinutes()).toBe(0);
			expect(result.data.getSeconds()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
			expect(result.data.getDate()).toBe(before.getDate());
		});
	});

	describe('Dynamic date variable: $yesterday', () => {
		it('should return start of yesterday (00:00:00.000)', () => {
			const expected = new Date();
			expected.setDate(expected.getDate() - 1);
			expected.setHours(0, 0, 0, 0);

			const result = parseConditionValue(dateCondition('$yesterday'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getDate()).toBe(expected.getDate());
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMinutes()).toBe(0);
			expect(result.data.getSeconds()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
		});
	});

	describe('Dynamic date variable: $startOfWeek', () => {
		it('should return Monday of the current week at 00:00:00.000', () => {
			const result = parseConditionValue(dateCondition('$startOfWeek'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			const day = result.data.getDay();
			expect(day).toBe(1); // Monday
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMinutes()).toBe(0);
			expect(result.data.getSeconds()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
		});
	});

	describe('Dynamic date variable: $startOfMonth', () => {
		it('should return first day of the current month at 00:00:00.000', () => {
			const result = parseConditionValue(dateCondition('$startOfMonth'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getDate()).toBe(1);
			expect(result.data.getMonth()).toBe(new Date().getMonth());
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
		});
	});

	describe('Dynamic date variable: $startOfYear', () => {
		it('should return January 1st of the current year at 00:00:00.000', () => {
			const result = parseConditionValue(dateCondition('$startOfYear'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getMonth()).toBe(0);
			expect(result.data.getDate()).toBe(1);
			expect(result.data.getFullYear()).toBe(new Date().getFullYear());
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
		});
	});

	describe('Dynamic date variable: $endOfDay', () => {
		it('should return end of today (23:59:59.999)', () => {
			const result = parseConditionValue(dateCondition('$endOfDay'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getDate()).toBe(new Date().getDate());
			expect(result.data.getHours()).toBe(23);
			expect(result.data.getMinutes()).toBe(59);
			expect(result.data.getSeconds()).toBe(59);
			expect(result.data.getMilliseconds()).toBe(999);
		});
	});

	describe('Dynamic date variable: $endOfWeek', () => {
		it('should return Sunday of the current week at 23:59:59.999', () => {
			const result = parseConditionValue(dateCondition('$endOfWeek'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getDay()).toBe(0); // Sunday
			expect(result.data.getHours()).toBe(23);
			expect(result.data.getMinutes()).toBe(59);
			expect(result.data.getSeconds()).toBe(59);
			expect(result.data.getMilliseconds()).toBe(999);
		});
	});

	describe('Dynamic date variable: $endOfMonth', () => {
		it('should return last day of the current month at 23:59:59.999', () => {
			const now = new Date();
			const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

			const result = parseConditionValue(dateCondition('$endOfMonth'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getDate()).toBe(lastDay);
			expect(result.data.getHours()).toBe(23);
			expect(result.data.getMinutes()).toBe(59);
			expect(result.data.getSeconds()).toBe(59);
			expect(result.data.getMilliseconds()).toBe(999);
		});
	});

	describe('Dynamic date variable: $endOfYear', () => {
		it('should return December 31st of the current year at 23:59:59.999', () => {
			const result = parseConditionValue(dateCondition('$endOfYear'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getMonth()).toBe(11);
			expect(result.data.getDate()).toBe(31);
			expect(result.data.getFullYear()).toBe(new Date().getFullYear());
			expect(result.data.getHours()).toBe(23);
			expect(result.data.getMinutes()).toBe(59);
			expect(result.data.getSeconds()).toBe(59);
			expect(result.data.getMilliseconds()).toBe(999);
		});
	});

	describe('Dynamic date variable: $hoursAgo:N', () => {
		it('should return a date N hours in the past', () => {
			const before = new Date();

			const result = parseConditionValue(dateCondition('$hoursAgo:3'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data).toBeInstanceOf(Date);
			// Should be approximately 3 hours ago (within 2 seconds tolerance)
			const diffMs = before.getTime() - result.data.getTime();
			const threeHoursMs = 3 * 60 * 60 * 1000;
			expect(Math.abs(diffMs - threeHoursMs)).toBeLessThan(2000);
		});
	});

	describe('Dynamic date variable: $hoursFromNow:N', () => {
		it('should return a date N hours in the future', () => {
			const before = new Date();

			const result = parseConditionValue(dateCondition('$hoursFromNow:3'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data).toBeInstanceOf(Date);
			const diffMs = result.data.getTime() - before.getTime();
			const threeHoursMs = 3 * 60 * 60 * 1000;
			expect(Math.abs(diffMs - threeHoursMs)).toBeLessThan(2000);
		});
	});

	describe('Dynamic date variable: $daysAgo:N', () => {
		it('should return a date N days ago at 00:00:00.000', () => {
			const expected = new Date();
			expected.setDate(expected.getDate() - 7);
			expected.setHours(0, 0, 0, 0);

			const result = parseConditionValue(dateCondition('$daysAgo:7'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getDate()).toBe(expected.getDate());
			expect(result.data.getMonth()).toBe(expected.getMonth());
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMinutes()).toBe(0);
			expect(result.data.getSeconds()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
		});
	});

	describe('Dynamic date variable: $daysFromNow:N', () => {
		it('should return a date N days in the future at 00:00:00.000', () => {
			const expected = new Date();
			expected.setDate(expected.getDate() + 1);
			expected.setHours(0, 0, 0, 0);

			const result = parseConditionValue(dateCondition('$daysFromNow:1'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getDate()).toBe(expected.getDate());
			expect(result.data.getMonth()).toBe(expected.getMonth());
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
		});
	});

	describe('Dynamic date variable: $monthsAgo:N', () => {
		it('should return a date N months ago at 00:00:00.000', () => {
			const expected = new Date();
			expected.setMonth(expected.getMonth() - 1);
			expected.setHours(0, 0, 0, 0);

			const result = parseConditionValue(dateCondition('$monthsAgo:1'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getMonth()).toBe(expected.getMonth());
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
		});
	});

	describe('Dynamic date variable: $monthsFromNow:N', () => {
		it('should return a date N months from now at 00:00:00.000', () => {
			const expected = new Date();
			expected.setMonth(expected.getMonth() + 1);
			expected.setHours(0, 0, 0, 0);

			const result = parseConditionValue(dateCondition('$monthsFromNow:1'), dateField, { user: dateUser }, '');

			expect(result.success).toBe(true);
			expect(result.data.getMonth()).toBe(expected.getMonth());
			expect(result.data.getHours()).toBe(0);
			expect(result.data.getMilliseconds()).toBe(0);
		});
	});
});
