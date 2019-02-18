import { createHash } from 'crypto';
import { isArray, isString, isObject, get, has, map, size, keys, reduce, startsWith } from 'lodash';
/*
rest/data/OK Activity/find
	&fields=_user,_updatedAt,code
	TODO &filter={"match":"and","conditions":[]}
	&start=0
	&limit=1000
	&sort=[{"property":"_createdAt","direction":"DESC"}]
*/

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
	'exists'
];

const operatoresByType = {
	text: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	url: ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'email.address': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	number: [
		'exists',
		'equals',
		'not_equals',
		'in',
		'not_in',
		'less_than',
		'greater_than',
		'less_or_equals',
		'greater_or_equals',
		'between'
	],
	autoNumber: [
		'exists',
		'equals',
		'not_equals',
		'in',
		'not_in',
		'less_than',
		'greater_than',
		'less_or_equals',
		'greater_or_equals',
		'between'
	],
	date: [
		'exists',
		'equals',
		'not_equals',
		'in',
		'not_in',
		'less_than',
		'greater_than',
		'less_or_equals',
		'greater_or_equals',
		'between'
	],
	dateTime: [
		'exists',
		'equals',
		'not_equals',
		'in',
		'not_in',
		'less_than',
		'greater_than',
		'less_or_equals',
		'greater_or_equals',
		'between'
	],
	//TODO 'time'        : ['exists', 'equals', 'not_equals', 'in', 'not_in',                                                        'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
	'money.currency': [
		'exists',
		'equals',
		'not_equals',
		'in',
		'not_in',
		'less_than',
		'greater_than',
		'less_or_equals',
		'greater_or_equals',
		'between'
	],
	'money.value': [
		'exists',
		'equals',
		'not_equals',
		'in',
		'not_in',
		'less_than',
		'greater_than',
		'less_or_equals',
		'greater_or_equals',
		'between'
	],
	boolean: ['exists', 'equals', 'not_equals'],
	'address.country': ['exists', 'equals', 'not_equals'],
	'address.city': ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with'],
	'address.state': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	'address.district': ['exists', 'equals', 'not_equals', 'in', 'not_in'],
	'address.place': ['exists', 'equals', 'not_equals', 'contains'],
	'address.number': ['exists', 'equals', 'not_equals'],
	'address.postalCode': ['exists', 'equals', 'not_equals', 'contains'],
	'address.complement': ['exists', 'equals', 'not_equals', 'contains'],
	'address.geolocation.0': [
		'exists',
		'equals',
		'not_equals',
		'in',
		'not_in',
		'less_than',
		'greater_than',
		'less_or_equals',
		'greater_or_equals',
		'between'
	],
	'address.geolocation.1': [
		'exists',
		'equals',
		'not_equals',
		'in',
		'not_in',
		'less_than',
		'greater_than',
		'less_or_equals',
		'greater_or_equals',
		'between'
	],
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
	percentage: ['exists', 'equals', 'not_equals', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']
};

filterUtils = {};

filterUtils.parseConditionValue = function(condition, field, req, subTermPart) {
	let group;
	if (field.type === 'lookup' && subTermPart !== '._id' && subTermPart.indexOf('.') !== -1) {
		const meta = Meta[field.document];
		if (!meta) {
			const e = new Meteor.Error('utils-internal-error', `Meta ${field.document} of field ${field.name} not found`);
			NotifyErrors.notify('FilterError', e);
			return e;
		}

		subTermPart = subTermPart.split('.');
		subTermPart.shift();

		const lookupField = meta.fields[subTermPart.shift()];

		if (subTermPart.length > 0) {
			subTermPart = `.${subTermPart.join('.')}`;
		} else {
			subTermPart = '';
		}

		return filterUtils.parseConditionValue(condition, lookupField, req, subTermPart);
	}

	switch (condition.value) {
		case '$user':
			return req.user._id;
			break;
		case '$group':
			return get(req, 'user.group._id');
			break;
		case '$groups':
			var groups = [];
			if (isArray(get(req, 'user.groups'))) {
				for (group of req.user.groups) {
					groups.push(group._id);
				}
			}
			return groups;
			break;
		case '$allgroups':
			groups = [];

			if ((req.user.group != null ? req.user.group._id : undefined) != null) {
				groups.push(req.user.group._id);
			}

			if (isArray(get(req, 'user.groups'))) {
				for (group of req.user.groups) {
					groups.push(group._id);
				}
			}
			return groups;
			break;
		case '$now':
			return new Date();
			break;
	}

	if (/^\$user\..+/.test(condition.value)) {
		return utils.getObjectPathAgg(req.user, condition.value.replace('$user.', ''));
	}

	if (subTermPart === '._id' && isString(condition.value)) {
		return condition.value;
	}

	switch (field.type) {
		case 'Number':
			return parseInt(condition.value);
		case 'encrypted':
			return createHash('md5')
				.update(condition.value)
				.digest('hex');
		default:
			return condition.value;
	}
};

filterUtils.validateOperator = function(condition, field, subTermPart) {
	let e;
	if (field.type === 'lookup' && subTermPart !== '._id' && subTermPart.indexOf('.') !== -1) {
		const meta = Meta[field.document];
		if (!meta) {
			e = new Meteor.Error('utils-internal-error', `Meta ${field.document} of field ${field.name} not found`);
			NotifyErrors.notify('FilterError', e);
			return e;
		}

		subTermPart = subTermPart.split('.');
		subTermPart.shift();

		const lookupField = meta.fields[subTermPart.shift()];

		if (subTermPart.length > 0) {
			subTermPart = `.${subTermPart.join('.')}`;
		} else {
			subTermPart = '';
		}

		return filterUtils.validateOperator(condition, lookupField, subTermPart);
	}

	const type = field.type + subTermPart;
	if (!operatoresByType[type]) {
		e = new Meteor.Error('utils-internal-error', `Field type [${type}] of [${field.name}] not supported to filter`);
		NotifyErrors.notify('FilterError', e, { condition, field });
		return e;
	}

	if (operatoresByType[type].indexOf(condition.operator) === -1) {
		e = new Meteor.Error(
			'utils-internal-error',
			`Field [${condition.term}] only supports operators [${operatoresByType[type].join(', ')}]. Trying to use operator [${
				condition.operator
			}]`
		);
		NotifyErrors.notify('FilterError', e, { condition });
		return e;
	}

	return true;
};

filterUtils.parseFilterCondition = function(condition, metaObject, req, invert) {
	if (!isString(condition.term) || validOperators.indexOf(condition.operator) === -1 || !has(condition, 'value')) {
		return new Meteor.Error('utils-internal-error', 'All conditions must contain term, operator and value');
	}

	// Allow compatibility with old filters containing .data in isList fields
	condition.term = condition.term.replace('.data', '');

	const termParts = condition.term.split('.');
	let subTermPart = condition.term.split('.');
	subTermPart.shift();
	subTermPart = subTermPart.join('.');
	if (subTermPart.length > 0) {
		subTermPart = `.${subTermPart}`;
	}
	let field = metaObject.fields[termParts[0]];

	if (termParts[0] === '_id') {
		field = { type: 'ObjectId' };
	}

	if (!field) {
		return new Meteor.Error('utils-internal-error', `Field [${condition.term}] does not exists at [${metaObject._id}]`);
	}

	const result = filterUtils.validateOperator(condition, field, subTermPart);
	if (result instanceof Error) {
		return result;
	}

	let value = filterUtils.parseConditionValue(condition, field, req, subTermPart);
	if (value instanceof Error) {
		return value;
	}

	const queryCondition = {};

	const type = field.type + subTermPart;

	const processValueByType = function(value) {
		switch (type) {
			case 'ObjectId':
				if (isString(value)) {
					value = value;
				}
				break;
			case 'date':
			case 'dateTime':
				if (isObject(value) && isString(value.$date)) {
					value = new Date(value.$date);
				}
				break;
			case 'phone.countryCode':
				if (isString(value)) {
					value = parseInt(value);
				}
				break;
			case 'money.currency':
				if (!['not_equals', 'exists'].includes(condition.operator)) {
					condition.operator = 'equals';
				}
				break;
		}
		return value;
	};

	if (condition.operator === 'between') {
		if (isObject(value)) {
			if (isObject(value.greater_or_equals) && isString(value.greater_or_equals.$date)) {
				value.greater_or_equals = processValueByType(value.greater_or_equals);
			}

			if (isObject(value.less_or_equals) && isString(value.less_or_equals.$date)) {
				value.less_or_equals = processValueByType(value.less_or_equals);
			}
		}
	} else {
		value = processValueByType(value);
	}

	switch (condition.operator) {
		case 'equals':
			queryCondition[condition.term] = value;
			if (invert === true) {
				invert = false;
				queryCondition[condition.term] = { $ne: queryCondition[condition.term] };
			}
			break;
		case 'not_equals':
			queryCondition[condition.term] = { $ne: value };
			break;
		case 'contains':
			queryCondition[condition.term] = { $regex: value, $options: 'i' };
			break;
		case 'not_contains':
			queryCondition[condition.term] = { $not: { $regex: value, $options: 'i' } };
			break;
		case 'starts_with':
			queryCondition[condition.term] = { $regex: `^${value}`, $options: 'i' };
			break;
		case 'end_with':
			queryCondition[condition.term] = { $regex: value + '$', $options: 'i' };
			break;
		case 'in':
			queryCondition[condition.term] = { $in: value };
			break;
		case 'not_in':
			queryCondition[condition.term] = { $nin: value };
			break;
		case 'greater_than':
			queryCondition[condition.term] = { $gt: value };
			break;
		case 'greater_or_equals':
			queryCondition[condition.term] = { $gte: value };
			break;
		case 'less_than':
			queryCondition[condition.term] = { $lt: value };
			break;
		case 'less_or_equals':
			queryCondition[condition.term] = { $lte: value };
			break;
		case 'between':
			queryCondition[condition.term] = {};
			if (value.greater_or_equals != null) {
				queryCondition[condition.term].$gte = value.greater_or_equals;
			}
			if (value.less_or_equals != null) {
				queryCondition[condition.term].$lte = value.less_or_equals;
			}
			break;
		case 'exists':
			queryCondition[condition.term] = { $exists: value };
			break;
		default:
			var e = new Meteor.Error('utils-internal-error', `Operator [${condition.operator}] not supported`);
			NotifyErrors.notify('FilterError', e, { condition });
			return e;
	}

	if (invert === true) {
		queryCondition[condition.term] = { $not: queryCondition[condition.term] };
	}

	return queryCondition;
};

filterUtils.parseFilterObject = function(filter, metaObject, req) {
	let condition, result;
	const query = [];

	if (isArray(filter.filters) && filter.filters.length > 0) {
		for (let subFilter of filter.filters) {
			result = filterUtils.parseFilterObject(subFilter, metaObject, req);
			if (result instanceof Error) {
				console.log(result);
				return result;
			}
			query.push(result);
		}
	}

	if (isArray(filter.conditions) && filter.conditions.length > 0) {
		for (condition of filter.conditions) {
			if (condition && condition.disabled !== true) {
				result = filterUtils.parseFilterCondition(condition, metaObject, req);
				if (result instanceof Error) {
					console.log(result);
					return result;
				}
				query.push(result);
			}
		}
	} else if (isObject(filter.conditions) && Object.keys(filter.conditions).length > 0) {
		for (let key in filter.conditions) {
			condition = filter.conditions[key];
			if (condition.disabled !== true) {
				result = filterUtils.parseFilterCondition(condition, metaObject, req);
				if (result instanceof Error) {
					console.log(result);
					return result;
				}
				query.push(result);
			}
		}
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
};

filterUtils.parseDynamicData = function(filter, keyword, data) {
	if (!filter) {
		return;
	}

	if (filter.filter) {
		return {
			...filter,
			filter: filterUtils.parseDynamicData(filter.filter, keyword, data)
		};
	}

	const parseConditions = function(condition) {
		if (condition && startsWith(condition.value, keyword)) {
			return {
				...condition,
				value: get(data, condition.value.replace(keyword + '.', ''))
			};
		}
	};

	if (isArray(filter.conditions) && size(filter.conditions) > 0) {
		return {
			...filter,
			conditions: map(filter.conditions.filter(c => c.disabled !== true), parseConditions)
		};
	} else if (isObject(filter.conditions) && size(keys(filter.conditions)) > 0) {
		return {
			...filter,
			conditions: reduce(
				filter.conditions,
				(result, condition) => {
					if (condition.disabled !== true) {
						return [...result, parseConditions(condition)];
					}
				},
				[]
			)
		};
	}

	return filter;
};
