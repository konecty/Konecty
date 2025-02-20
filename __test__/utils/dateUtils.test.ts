import { DateTime } from 'luxon';
import { getUpdatedDate } from '../../src/imports/utils/dateUtils';

describe('getUpdatedDate', () => {
	const testISOString = '2024-02-20T10:30:00.000Z';
	const testDate = new Date(testISOString);
	const expectedDateTime = DateTime.fromISO(testISOString);

	it('should handle undefined input', () => {
		const result = getUpdatedDate(undefined);
		expect(result).toBeUndefined();
	});

	it('should parse Date object correctly', () => {
		const result = getUpdatedDate(testDate);
		expect(result?.toISO()).toBe(expectedDateTime.toISO());
	});

	it('should parse ISO string correctly', () => {
		const result = getUpdatedDate(testISOString);
		expect(result?.toISO()).toBe(expectedDateTime.toISO());
	});

	it('should parse MongoDB style object with Date correctly', () => {
		const result = getUpdatedDate({ $date: testDate });
		expect(result?.toISO()).toBe(expectedDateTime.toISO());
	});

	it('should parse MongoDB style object with ISO string correctly', () => {
		const result = getUpdatedDate({ $date: testISOString });
		expect(result?.toISO()).toBe(expectedDateTime.toISO());
	});

	it('should handle invalid date string', () => {
		const result = getUpdatedDate('invalid-date');
		expect(result?.isValid).toBe(false);
	});

	it('should handle null value', () => {
		// @ts-expect-error Testing null input even though types don't allow it
		const result = getUpdatedDate(null);
		expect(result).toBeUndefined();
	});

	it('should handle empty object', () => {
		// @ts-expect-error Testing invalid object input
		const result = getUpdatedDate({});
		expect(result).toBeUndefined();
	});
});
