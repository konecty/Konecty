import moment from 'moment';
import { mapObjIndexed } from 'ramda';

import { isArray, isObject, map, isString, isDate, reduce, isFunction } from 'lodash';

utils = {
	...utils
};

utils.accentsTidy = function(s) {
	if (!_.isString(s)) {
		return '';
	}
	let r = s.toLowerCase();
	r = r.replace(/\s/g, '');
	r = r.replace(/[àáâãäå]/g, 'a');
	r = r.replace(/æ/g, 'ae');
	r = r.replace(/ç/g, 'c');
	r = r.replace(/[èéêë]/g, 'e');
	r = r.replace(/[ìíîï]/g, 'i');
	r = r.replace(/ñ/g, 'n');
	r = r.replace(/[òóôõö]/g, 'o');
	r = r.replace(/œ/g, 'oe');
	r = r.replace(/[ùúûü]/g, 'u');
	r = r.replace(/[ýÿ]/g, 'y');
	return r;
};

utils.unicodeSortArrayOfObjectsByParam = (arr, param) =>
	arr.sort(function(a, b) {
		if (a[param] != null) {
			return utils.accentsTidy(a[param]).localeCompare(utils.accentsTidy(b[param]));
		}
		return 0;
	});

utils.sortArrayOfObjectsByParam = (arr, param) =>
	arr.sort(function(a, b) {
		if (a[param]) {
			return a[param].localeCompare(b[param]);
		}
		return 0;
	});

utils.processDate = mapObjIndexed(value => {
	if (value) {
		if (value.$date) {
			return moment(value.$date).toDate();
		}
		if (isArray(value)) {
			return map(value, v => {
				if (isObject(v) || isArray(v)) {
					return utils.processDate(v);
				}
				return v;
			});
		}
		if (isString(value) || isDate(value)) {
			return value;
		}
		if (isObject(value)) {
			return utils.processDate(value);
		}
	}
	return value;
});

utils.mapDateValue = record => {
	// Validate if object is a ObjectId
	if (isObject(record) && isFunction(record.toHexString)) {
		return record.toHexString();
	} else if (isObject(record)) {
		return reduce(
			record,
			(acc, value, key) => {
				if (isDate(value)) {
					return {
						...acc,
						[key]: moment(value).toISOString()
					};
				}
				if (isArray(value)) {
					return {
						...acc,
						[key]: map(value, utils.mapDateValue)
					};
				}
				if (isObject(value)) {
					return {
						...acc,
						[key]: utils.mapDateValue(value)
					};
				}
				return {
					...acc,
					[key]: value
				};
			},
			{}
		);
	} else {
		return record;
	}
};
