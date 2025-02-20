import { DateTime } from 'luxon';
import { logger } from './logger';

interface DateWithDate {
	$date: string | Date;
}

/**
 * Parses a date value that can come in different formats into a DateTime object
 * @param dateValue - The date value to parse which can be a string, Date object, object with $date property or undefined
 * @returns DateTime object representing the parsed date or undefined if input is invalid
 */
export function getUpdatedDate(dateValue: string | Date | DateWithDate | undefined): DateTime | undefined {
	try {
		if (!dateValue) {
			return undefined;
		}

		if (dateValue instanceof Date) {
			return DateTime.fromJSDate(dateValue);
		}

		if (typeof dateValue === 'string') {
			return DateTime.fromISO(dateValue);
		}

		if ('$date' in dateValue) {
			const mongoDate = dateValue.$date;
			return mongoDate instanceof Date ? DateTime.fromJSDate(mongoDate) : DateTime.fromISO(mongoDate);
		}

		return undefined;
	} catch (error) {
		logger.error(error, 'Error parsing _updatedAt date');
		return undefined;
	}
}
