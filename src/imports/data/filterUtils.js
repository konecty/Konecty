import { createHash } from 'crypto';
import fromPairs from 'lodash/fromPairs';
import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import keys from 'lodash/keys';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import size from 'lodash/size';
import startsWith from 'lodash/startsWith';
import tail from 'lodash/tail';
import uniqBy from 'lodash/uniqBy';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '../utils/logger';
import { errorReturn, successReturn } from '../utils/return';
import { accentToRegex } from '@imports/utils/strUtils';

const validOperators = [
	'equals',
	'not_equals',
	'starts_with',
	'end_with',
	'contains',
	'not_contains',
	'less_than',
	'greater_than',
	'less_or_equals',
	'greater_or_equals',
	'between',
	'current_user',
	'not_current_user',
	'current_user_group',
	'not_current_user_group',
	'current_user_groups',
	'in',
	'not_in',
	'exists',
];

const operatoresByType = {
	text: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	url: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'email.address': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	number: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	autoNumber: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	date: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	dateTime: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	//TODO 'time'        : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	'money.currency': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	'money.value': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	boolean: ['exists', 'equals', 'not_equals'],
	'address.country': ['exists', 'equals', 'not_equals'],
	'address.city': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'address.state': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	'address.district': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	'address.place': ['exists', 'equals', 'not_equals', 'contains'],
	'address.number': ['exists', 'equals', 'not_equals'],
	'address.postalCode': ['exists', 'equals', 'not_equals', 'contains'],
	'address.complement': ['exists', 'equals', 'not_equals', 'contains'],
	'address.geolocation.0': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	'address.geolocation.1': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
	'personName.first': ['exists', 'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'personName.last': ['exists', 'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'personName.full': ['exists', 'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'phone.phoneNumber': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'phone.countryCode': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	picklist: ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	//TODO 'json':
	//TODO improve lookup
	lookup: ['exists'],
	'lookup._id': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	ObjectId: ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	//TODO 'inherit_lookup':
	encrypted: ['exists', 'equals', 'not_equals'],
	//TODO improve filter
	filter: ['exists'],
	'filter.conditions': ['exists'],
	richText: ['exists', 'contains'],
	file: ['exists'],
	percentage: ['exists', 'equals', 'not_equals', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between'],
};

/**
 * Resolves a filter condition value, handling special variables and type conversions.
 *
 * Supported special variables:
 * - `$user`        — Current user's _id
 * - `$group`       — Current user's main group _id
 * - `$groups`      — Array of current user's secondary group _ids
 * - `$allgroups`   — Array of all user's group _ids (main + secondary)
 * - `$user.field`  — Access to specific fields of the current user (e.g. `$user.branch._id`)
 * - `$now`         — Current date and time
 *
 * Dynamic date variables (start of period — 00:00:00.000):
 * - `$today`         — Start of current day
 * - `$yesterday`     — Start of previous day
 * - `$startOfWeek`   — Monday of current week
 * - `$startOfMonth`  — First day of current month
 * - `$startOfYear`   — January 1st of current year
 *
 * Dynamic date variables (end of period — 23:59:59.999):
 * - `$endOfDay`      — End of current day
 * - `$endOfWeek`     — Sunday of current week
 * - `$endOfMonth`    — Last day of current month
 * - `$endOfYear`     — December 31st of current year
 *
 * Parametric relative date variables:
 * - `$hoursAgo:N`      — N hours before now
 * - `$hoursFromNow:N`  — N hours after now
 * - `$daysAgo:N`       — N days ago at 00:00:00.000
 * - `$daysFromNow:N`   — N days from now at 00:00:00.000
 * - `$monthsAgo:N`     — N months ago at 00:00:00.000
 * - `$monthsFromNow:N` — N months from now at 00:00:00.000
 *
 * @param {Object} condition - The filter condition { term, operator, value }
 * @param {Object} field - The field metadata { type, document, name, ... }
 * @param {{ user: Object }} context - Context object with the current user
 * @param {string} subTermPart - Sub-term path for nested/lookup fields
 * @returns {{ success: boolean, data?: any, errors?: string[] }} Result object
 */
export function parseConditionValue(condition, field, { user }, subTermPart) {
	if (field.type === 'lookup' && subTermPart !== '._id' && subTermPart.indexOf('.') !== -1) {
		const meta = MetaObject.Meta[field.document];
		if (!meta) {
			logger.error(`MetaObject.Meta ${field.document} of field ${field.name} not found`);
			return errorReturn(`MetaObject.Meta ${field.document} of field ${field.name} not found`);
		}

		subTermPart = subTermPart.split('.');
		subTermPart.shift();

		const lookupField = meta.fields[subTermPart.shift()];

		if (subTermPart.length > 0) {
			subTermPart = `.${subTermPart.join('.')}`;
		} else {
			subTermPart = '';
		}

		return parseConditionValue(condition, lookupField, { user }, subTermPart);
	}

	switch (condition.value) {
		case '$user':
			return successReturn(user._id);

		case '$group':
			return successReturn(get(user, 'group._id'));

		case '$groups':
			if (isArray(get(user, 'groups'))) {
				return successReturn(map(user.groups, '_id'));
			}
			return successReturn([]);
		case '$allgroups':
			return successReturn([user?.group?._id, ...map(user?.groups, '_id')].filter(p => p));

		case '$now':
			return successReturn(new Date());

		// --- Dynamic date variables: start of period (00:00:00.000) ---

		case '$today': {
			const d = new Date();
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}

		case '$yesterday': {
			const d = new Date();
			d.setDate(d.getDate() - 1);
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}

		case '$startOfWeek': {
			const d = new Date();
			const dow = d.getDay();
			d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}

		case '$startOfMonth': {
			const d = new Date();
			d.setDate(1);
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}

		case '$startOfYear': {
			const d = new Date();
			d.setMonth(0, 1);
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}

		// --- Dynamic date variables: end of period (23:59:59.999) ---

		case '$endOfDay': {
			const d = new Date();
			d.setHours(23, 59, 59, 999);
			return successReturn(d);
		}

		case '$endOfWeek': {
			const d = new Date();
			const dow = d.getDay();
			d.setDate(d.getDate() + (dow === 0 ? 0 : 7 - dow)); // Sunday
			d.setHours(23, 59, 59, 999);
			return successReturn(d);
		}

		case '$endOfMonth': {
			const d = new Date();
			d.setMonth(d.getMonth() + 1, 0); // last day of current month
			d.setHours(23, 59, 59, 999);
			return successReturn(d);
		}

		case '$endOfYear': {
			const d = new Date();
			d.setMonth(11, 31);
			d.setHours(23, 59, 59, 999);
			return successReturn(d);
		}
	}

	// --- Dynamic date variables: parametric (relative) ---
	if (isString(condition.value) && condition.value.startsWith('$')) {
		const hoursAgoMatch = condition.value.match(/^\$hoursAgo:(\d+)$/);
		if (hoursAgoMatch) {
			const d = new Date();
			d.setHours(d.getHours() - parseInt(hoursAgoMatch[1], 10));
			return successReturn(d);
		}

		const hoursFwdMatch = condition.value.match(/^\$hoursFromNow:(\d+)$/);
		if (hoursFwdMatch) {
			const d = new Date();
			d.setHours(d.getHours() + parseInt(hoursFwdMatch[1], 10));
			return successReturn(d);
		}

		const daysAgoMatch = condition.value.match(/^\$daysAgo:(\d+)$/);
		if (daysAgoMatch) {
			const d = new Date();
			d.setDate(d.getDate() - parseInt(daysAgoMatch[1], 10));
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}

		const daysFwdMatch = condition.value.match(/^\$daysFromNow:(\d+)$/);
		if (daysFwdMatch) {
			const d = new Date();
			d.setDate(d.getDate() + parseInt(daysFwdMatch[1], 10));
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}

		const monthsAgoMatch = condition.value.match(/^\$monthsAgo:(\d+)$/);
		if (monthsAgoMatch) {
			const d = new Date();
			d.setMonth(d.getMonth() - parseInt(monthsAgoMatch[1], 10));
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}

		const monthsFwdMatch = condition.value.match(/^\$monthsFromNow:(\d+)$/);
		if (monthsFwdMatch) {
			const d = new Date();
			d.setMonth(d.getMonth() + parseInt(monthsFwdMatch[1], 10));
			d.setHours(0, 0, 0, 0);
			return successReturn(d);
		}
	}

	// Check if value is a string before calling .replace()
	// For "between" operator, value is an object {greater_or_equals: "...", less_or_equals: "..."}
	if (isString(condition.value) && /^\$user\..+/.test(condition.value)) {
		return successReturn(get(user, condition.value.replace('$user.', '')));
	}

	if (subTermPart === '._id' && isString(condition.value)) {
		return successReturn(condition.value);
	}

	switch (field.type) {
		case 'Number':
			return successReturn(parseInt(condition.value));
		case 'encrypted':
			if (condition.operator === 'exists') {
				return successReturn(condition.value);
			}
			return successReturn(createHash('md5').update(condition.value).digest('hex'));
		default:
			return successReturn(condition.value);
	}
}

export function validateOperator(condition, field, subTermPart) {
	if (field.type === 'lookup' && subTermPart !== '._id' && subTermPart.indexOf('.') !== -1) {
		const meta = MetaObject.Meta[field.document];
		if (meta == null) {
			logger.error(`MetaObject.Meta ${field.document} of field ${field.name} not found`);
			return errorReturn(`MetaObject.Meta ${field.document} of field ${field.name} not found`);
		}

		subTermPart = subTermPart.split('.');
		subTermPart.shift();

		const lookupField = meta.fields[subTermPart.shift()];

		if (subTermPart.length > 0) {
			subTermPart = `.${subTermPart.join('.')}`;
		} else {
			subTermPart = '';
		}

		return validateOperator(condition, lookupField, subTermPart);
	}

	const type = field.type + subTermPart;
	if (operatoresByType[type] == null) {
		logger.error(`Field type [${type}] of [${field.name}] not supported to filter`);
		return errorReturn(`Field type [${type}] of [${field.name}] not supported to filter`);
	}

	if (operatoresByType[type].indexOf(condition.operator) === -1) {
		logger.error(`Field [${condition.term}] only supports operators [${operatoresByType[type].join(', ')}]. Trying to use operator [${condition.operator}]`);
		return errorReturn(`Field [${condition.term}] only supports operators [${operatoresByType[type].join(', ')}]. Trying to use operator [${condition.operator}]`);
	}

	return successReturn();
}

export function parseFilterCondition(condition, metaObject, { user }, invert) {
	if (!isString(condition.term) || validOperators.indexOf(condition.operator) === -1 || !has(condition, 'value')) {
		logger.error('All conditions must contain term, operator and value');
		return errorReturn('All conditions must contain term, operator and value');
	}

	// Allow compatibility with old filters containing .data in isList fields
	condition.term = condition.term.replace('.data', '');

	const termParts = condition.term.split('.');

	const getSubTermPart = function (condition) {
		const termParts = condition.term.split('.');
		termParts.shift();
		const result = termParts.join('.');
		if (result.length > 0) {
			return `.${result}`;
		}
		return result;
	};

	const subTermPart = getSubTermPart(condition);

	const field = termParts[0] === '_id' ? { type: 'ObjectId' } : metaObject.fields[termParts[0]];

	if (field == null) {
		logger.error(`Field [${condition.term}] does not exists at [${metaObject._id}]`);
		return errorReturn(`Field [${condition.term}] does not exists at [${metaObject._id}]`);
	}

	const operatorResult = validateOperator(condition, field, subTermPart);
	if (operatorResult.success === false) {
		return operatorResult;
	}

	const conditionValueResult = parseConditionValue(condition, field, { user }, subTermPart);
	if (conditionValueResult.success === false) {
		return conditionValueResult;
	}

	const type = field.type + subTermPart;

	const processValueByType = function (value) {
		switch (type) {
			case 'ObjectId':
				if (isString(value)) {
					return value;
				}
				break;
			case 'date':
			case 'dateTime':
				if (isObject(value) && isString(value.$date)) {
					return new Date(value.$date);
				}
				break;
			case 'phone.countryCode':
				if (isString(value)) {
					return parseInt(value);
				}
				break;
			case 'phone.phoneNumber':
				if (value && !isString(value)) {
					return value.toString();
				}
				break;
		}
		return value;
	};

	const operator = type === ('money.currency' && ['not_equals', 'exists'].includes(condition.operator) === false) ? 'equals' : condition.operator;

	const getValue = function (value) {
		if (operator === 'between') {
			const result = {};
			if (isObject(value) && value != null) {
				if (value.greater_or_equals != null) {
					if (value.greater_or_equals.$date != null && isString(value.greater_or_equals.$date)) {
						result.greater_or_equals = processValueByType(value.greater_or_equals);
					} else {
						result.greater_or_equals = value.greater_or_equals;
					}
				}

				if (value.less_or_equals != null) {
					if (value.less_or_equals.$date != null && isString(value.less_or_equals.$date)) {
						result.less_or_equals = processValueByType(value.less_or_equals);
					} else {
						result.less_or_equals = value.less_or_equals;
					}
				}
			}
			return result;
		} else {
			return processValueByType(value);
		}
	};

	const conditionValue = getValue(conditionValueResult.data);
	const queryCondition = {};
	switch (operator) {
		case 'equals':
			queryCondition[condition.term] = conditionValue;
			if (invert === true) {
				invert = false;
				queryCondition[condition.term] = { $ne: queryCondition[condition.term] };
			}
			break;
		case 'not_equals':
			queryCondition[condition.term] = { $ne: conditionValue };
			break;
		case 'contains':
			queryCondition[condition.term] = { $regex: accentToRegex(conditionValue), $options: 'i' };
			break;
		case 'not_contains':
			queryCondition[condition.term] = { $not: { $regex: accentToRegex(conditionValue), $options: 'i' } };
			break;
		case 'starts_with':
			queryCondition[condition.term] = { $regex: `^${accentToRegex(conditionValue)}`, $options: 'i' };
			break;
		case 'end_with':
			queryCondition[condition.term] = { $regex: accentToRegex(conditionValue) + '$', $options: 'i' };
			break;
		case 'in':
			queryCondition[condition.term] = { $in: [].concat(conditionValue) };
			break;
		case 'not_in':
			queryCondition[condition.term] = { $nin: [].concat(conditionValue) };
			break;
		case 'greater_than':
			queryCondition[condition.term] = { $gt: conditionValue };
			break;
		case 'greater_or_equals':
			queryCondition[condition.term] = { $gte: conditionValue };
			break;
		case 'less_than':
			queryCondition[condition.term] = { $lt: conditionValue };
			break;
		case 'less_or_equals':
			queryCondition[condition.term] = { $lte: conditionValue };
			break;
		case 'between':
			queryCondition[condition.term] = {};
			if (conditionValue != null && conditionValue.greater_or_equals != null) {
				queryCondition[condition.term].$gte = conditionValue.greater_or_equals;
			}
			if (conditionValue != null && conditionValue.less_or_equals != null) {
				queryCondition[condition.term].$lte = conditionValue.less_or_equals;
			}
			if (Object.keys(queryCondition[condition.term]).length === 0) {
				delete queryCondition[condition.term];
			}

			break;
		case 'exists':
			queryCondition[condition.term] = { $exists: conditionValue };
			break;
		default:
			logger.error(`Operator [${condition.operator}] not supported`);
			return errorReturn(`Operator [${condition.operator}] not supported`);
	}

	if (invert === true) {
		queryCondition[condition.term] = { $not: queryCondition[condition.term] };
	}

	return successReturn(queryCondition);
}

/**
 *
 * @param {import("@imports/model/Filter").KonFilter} filter
 * @param {import("@imports/types/metadata").MetaObjectType} metaObject
 * @param {{ user: import('@imports/model/User').User }} req
 * @returns {import('mongodb').Filter} - mongo filter
 */
export function parseFilterObject(filter, metaObject, { user } = {}) {
	const query = [];

	if (isArray(filter.filters) && filter.filters.length > 0) {
		const filters = filter.filters.map(subFilter => parseFilterObject(subFilter, metaObject, { user }));
		query.push(...filters);
	}

	if (isArray(filter.conditions) && filter.conditions.length > 0) {
		const conditions = filter.conditions.filter(({ disabled = false }) => disabled !== true).map(condition => parseFilterCondition(condition, metaObject, { user }));

		if (conditions.some(({ success }) => success === false)) {
			return conditions.find(({ success }) => success === false);
		}

		query.push(...conditions.map(({ data }) => data));
	} else if (isObject(filter.conditions) && Object.keys(filter.conditions).length > 0) {
		const objectConditions = Object.entries(filter.conditions)
			.filter(([, { disabled = false }]) => disabled !== true)
			.map(([, condition]) => parseFilterCondition(condition, metaObject, { user }));

		if (objectConditions.some(({ success }) => success === false)) {
			return objectConditions.find(({ success }) => success === false);
		}

		query.push(...objectConditions.map(({ data }) => data));
	}

	if (query.length === 0) {
		return {};
	}

	if (query.length === 1) {
		return query[0];
	}

	if (filter.match === 'or') {
		return { $or: query };
	}

	return { $and: query };
}

export function parseDynamicData(filter, keyword, data) {
	if (filter == null) {
		return successReturn();
	}

	if (filter.filter) {
		const parsedFilter = parseDynamicData(filter.filter, keyword, data);

		if (parsedFilter.success === false) {
			return parsedFilter;
		}

		return successReturn({
			...filter,
			filter: parsedFilter.data,
		});
	}

	const parseConditions = function (condition) {
		if (condition != null && startsWith(condition.value, keyword)) {
			return {
				...condition,
				value: get(data, condition.value.replace(keyword + '.', '')),
			};
		}
		return condition;
	};

	if (isArray(filter.conditions) && size(filter.conditions) > 0) {
		return successReturn({
			...filter,
			conditions: map(
				filter.conditions.filter(c => c.disabled !== true),
				parseConditions,
			),
		});
	} else if (isObject(filter.conditions) && size(keys(filter.conditions)) > 0) {
		return successReturn({
			...filter,
			conditions: reduce(
				filter.conditions,
				(result, condition) => {
					if (condition.disabled !== true) {
						return [...result, parseConditions(condition)];
					}
				},
				[],
			),
		});
	}

	return successReturn(filter);
}

/**
 * Deduplicate projection keys so as to not trigger Mongo Path Collision error, implemented after version 4.4
 *
 * @example clearProjectionPathCollision({ group: 1, 'group._id': 1, _user: 1 })
 * // returns { group: 1, _user: 1 }
 *
 * @param {Object<string, unknown>} projection
 * @returns {Object<string, unknown>} projection
 */
export function clearProjectionPathCollision(projection) {
	const fields = Object.entries(projection);
	const fieldsCleaned = uniqBy(fields, field => field[0].split('.')[0]);

	const fieldsFiltered = fieldsCleaned.filter(([field]) => field != null && field.length > 0);

	return fromPairs(fieldsFiltered);
}

export function filterConditionToFn(condition, metaObject, req) {
	if (req == null || req.user == null) {
		logger.error('Logged user is required to parse condition');
		return errorReturn('Logged user is required to parse condition');
	}

	if (!isString(condition.term) || validOperators.indexOf(condition.operator) === -1 || !has(condition, 'value')) {
		logger.error('All conditions must contain term, operator and value');
		return errorReturn('All conditions must contain term, operator and value');
	}

	// Allow compatibility with old filters containing .data in isList fields
	condition.term = condition.term.replace('.data', '');

	const termParts = condition.term.split('.');

	const getSubTermPart = function (condition) {
		const termParts = condition.term.split('.');
		termParts.shift();
		const result = termParts.join('.');
		if (result.length > 0) {
			return `.${result}`;
		}
		return result;
	};

	const subTermPart = getSubTermPart(condition);

	const field = termParts[0] === '_id' ? { type: 'ObjectId' } : metaObject.fields[termParts[0]];

	if (field == null) {
		logger.error(`Field [${condition.term}] does not exists at [${metaObject._id}]`);
		return errorReturn(`Field [${condition.term}] does not exists at [${metaObject._id}]`);
	}

	const operatorResult = validateOperator(condition, field, subTermPart);
	if (operatorResult.success === false) {
		return operatorResult;
	}

	const conditionValueResult = parseConditionValue(condition, field, req, subTermPart);
	if (conditionValueResult.success === false) {
		return conditionValueResult;
	}

	const type = field.type + subTermPart;

	const processValueByType = function (value) {
		switch (type) {
			case 'ObjectId':
				if (isString(value)) {
					return value;
				}
				break;
			case 'date':
			case 'dateTime':
				if (isObject(value) && isString(value.$date)) {
					return new Date(value.$date);
				}
				break;
			case 'phone.countryCode':
				if (isString(value)) {
					return parseInt(value);
				}
				break;
		}
		return value;
	};

	const operator = type === ('money.currency' && ['not_equals', 'exists'].includes(condition.operator) === false) ? 'equals' : condition.operator;
	const getValue = function (value) {
		if (operator === 'between') {
			const result = {};
			if (isObject(value) && value != null) {
				if (value.greater_or_equals != null) {
					if (value.greater_or_equals.$date != null && isString(value.greater_or_equals.$date)) {
						result.greater_or_equals = processValueByType(value.greater_or_equals);
					} else {
						result.greater_or_equals = value.greater_or_equals;
					}
				}

				if (value.less_or_equals != null) {
					if (value.less_or_equals.$date != null && isString(value.less_or_equals.$date)) {
						value.less_or_equals = processValueByType(value.less_or_equals);
					} else {
						result.less_or_equals = value.less_or_equals;
					}
				}
			}

			return result;
		} else {
			return processValueByType(value);
		}
	};

	/**
	 * If the condition value points to another field from the data, then retrieve it
	 * Otherwise, process as normal
	 * @param {object} data - The whole document to search
	 * @returns {Array.<string | number | boolean>} - The field value as an array
	 */
	const getConditionValue = data => {
		const condValue = getValue(conditionValueResult.data);
		return get(data, condValue, condValue);
	};

	/**
	 * @param {object} data - The whole document to search
	 * @returns {Array.<string | number | boolean>} - The field value as an array
	 */
	const getFieldValue = data => {
		if (field.isList !== true || termParts.length === 1) {
			return [].concat(get(data, condition.term));
		}

		const fieldValue = get(data, termParts[0]);
		if (fieldValue == null) {
			return [];
		}

		// The field here has isList, it should be an array (altough it may not)
		return [].concat(fieldValue).map(value => {
			if (value == null) {
				return value;
			}

			return get(value, tail(termParts));
		});
	};

	switch (operator) {
		case 'equals':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => value === getConditionValue(data));
			});
		case 'not_equals':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.every(value => value !== getConditionValue(data));
			});
		case 'contains':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => String(value).includes(getConditionValue(data)));
			});
		case 'not_contains':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.every(value => !String(value).includes(getConditionValue(data)));
			});
		case 'starts_with':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => String(value).startsWith(getConditionValue(data)));
			});
		case 'end_with':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => String(value).endsWith(getConditionValue(data)));
			});
		case 'in':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				const conditionValue = getConditionValue(data);
				if (!isArray(conditionValue)) {
					return false;
				}

				return fieldValue.some(value => conditionValue.includes(value));
			});
		case 'not_in':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				const conditionValue = getConditionValue(data);
				if (!isArray(conditionValue)) {
					return false;
				}

				return fieldValue.every(value => !conditionValue.includes(value));
			});
		case 'greater_than':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => value > getConditionValue(data));
			});
		case 'greater_or_equals':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => value >= getConditionValue(data));
			});
		case 'less_than':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => value < getConditionValue(data));
			});
		case 'less_or_equals':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => value <= getConditionValue(data));
			});
		case 'between':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				const conditionValue = getConditionValue(data);
				return fieldValue.some(value => conditionValue.greater_or_equals <= value && value <= conditionValue.less_or_equals);
			});
		case 'exists':
			return successReturn(data => {
				const fieldValue = getFieldValue(data);
				return fieldValue.some(value => value != null);
			});
		default:
			logger.error(`Operator [${condition.operator}] not supported`);
			return errorReturn(`Operator [${condition.operator}] not supported`);
	}
}

/**
 * Check if the update is from interface upload. If its updating only a single file field, from a single record,
 * then it's probably from interface upload.
 * @param {object} metaObject - The meta object
 * @param {object} updateData - The data to check
 * @returns {boolean} - True if the update is from interface upload, false otherwise
 */
export function isUpdateFromInterfaceUpload(metaObject, updateData) {
	const keys = Object.keys(updateData.data);
	if (keys.length !== 1 || updateData.ids.length !== 1) {
		return false;
	}

	const key = keys[0];
	const field = metaObject.fields[key];
	if (field == null) {
		return false;
	}

	return field.type === 'file';
}
