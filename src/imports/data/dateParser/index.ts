import { DateTime } from 'luxon';

import isObject from 'lodash/isObject';
import isFunction from 'lodash/isFunction';
import reduce from 'lodash/reduce';
import isDate from 'lodash/isDate';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import map from 'lodash/map';

type RecordObject = {
	toHexString?: () => string;
};

export function dateToString(record: any): string | Array<any> | object {
	if (isObject(record)) {
		const typedRecord = record as RecordObject;

		if (isFunction(typedRecord.toHexString)) {
			return typedRecord.toHexString();
		}

		return reduce(
			typedRecord,
			(acc, value, key) => {
				if (isDate(value)) {
					return {
						...acc,
						[key]: DateTime.fromJSDate(value).toISO(),
					};
				}
				if (isArray(value)) {
					return {
						...acc,
						[key]: map(value, dateToString),
					};
				}
				if (isObject(value)) {
					return {
						...acc,
						[key]: dateToString(value),
					};
				}
				return {
					...acc,
					[key]: value,
				};
			},
			{},
		);
	} else if (isArray(record)) {
		return map(record, dateToString);
	} else {
		return record;
	}
}

export function stringToDate(record: { [key: string]: any } | string) {
	if (isString(record)) {
		return record;
	}

	const result = Object.entries(record).reduce((acc, [key, value]) => {
		if (value == null) {
			return acc;
		}
		if (value.$date != null) {
			acc[key] = DateTime.fromISO(value.$date).toJSDate();
		} else if (Array.isArray(value)) {
			acc[key] = value.map(stringToDate);
		} else if (isString(value) || isDate(value)) {
			acc[key] = value;
		} else if (isObject(value)) {
			acc[key] = stringToDate(value);
		}
		return acc;
	}, record);
	return result;
}
