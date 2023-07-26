import { mapObjIndexed } from 'ramda';
import { DateTime } from 'luxon';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import isDate from 'lodash/isDate';
import isObject from 'lodash/isObject';
import map from 'lodash/map';

export const processDateObjects = mapObjIndexed(value => {
	if (value) {
		if (value.$date) {
			return DateTime.fromISO(value.$date).toJSDate();
		}
		if (isArray(value)) {
			return map(value, v => {
				if (isObject(v) || isArray(v)) {
					return processDateObjects(v);
				}
				return v;
			});
		}
		if (isString(value) || isDate(value)) {
			return value;
		}
		if (isObject(value)) {
			return processDateObjects(value);
		}
	}
	return value;
});
