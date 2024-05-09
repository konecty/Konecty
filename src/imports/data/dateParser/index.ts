import { DateTime } from 'luxon';

import isArray from 'lodash/isArray';
import isDate from 'lodash/isDate';
import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import map from 'lodash/map';
import reduce from 'lodash/reduce';

type RecordObject = {
	toHexString?: () => string;
};

type TransformFn = (date: DateTime) => string;

export function dateToString<ReturnT = string | Array<any> | object>(record: ReturnT, transformFn?: TransformFn): ReturnT {
	if (isObject(record)) {
		const typedRecord = record as RecordObject;

		if (isFunction(typedRecord.toHexString)) {
			return typedRecord.toHexString() as ReturnT;
		}

		const transformToString = isFunction(transformFn) ? transformFn : (date: DateTime) => date.toISO();

		return reduce(
			typedRecord,
			(acc, value, key) => {
				if (isDate(value)) {
					return {
						...acc,
						[key]: transformToString(DateTime.fromJSDate(value)),
					};
				}
				if (isArray(value)) {
					return {
						...acc,
						[key]: map(value, v => dateToString(v, transformFn)),
					};
				}
				if (isObject(value)) {
					return {
						...acc,
						[key]: dateToString(value, transformFn),
					};
				}
				return {
					...acc,
					[key]: value,
				};
			},
			{},
		) as ReturnT;
	} else if (isArray(record)) {
		return map(record, v => dateToString(v, transformFn)) as ReturnT;
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
