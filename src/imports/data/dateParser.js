import { DateTime } from 'luxon';

import isObject from 'lodash/isObject';
import isFunction from 'lodash/isFunction';
import reduce from 'lodash/reduce';
import isDate from 'lodash/isDate';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import map from 'lodash/map';

export function dateToString(record) {
	if (isObject(record) && isFunction(record.toHexString)) {
		return record.toHexString();
	} else if (isArray(record)) {
		return map(record, dateToString);
	} else if (isObject(record)) {
		return reduce(
			record,
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
	} else {
		return record;
	}
}

export function stringToDate(record) {
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
