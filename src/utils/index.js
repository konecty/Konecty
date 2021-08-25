import { Collection } from 'mongodb';

import { createContext, runInContext } from 'vm';
import momentzone from 'moment-timezone';
import moment from 'moment';
import luxon from 'luxon';
import dateFns from 'date-fns';
import axios from 'axios';
import crypto from 'crypto';

import isArray from 'lodash/isArray';
import isDate from 'lodash/isDate';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import each from 'lodash/each';
import has from 'lodash/has';
import get from 'lodash/get';

import { callMethod } from './methods';

const UNMISTAKABLE_CHARS = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
const BASE64_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789-_';

const numberFormat = (number, dec, dsep, tsep) => {
	if (isNaN(number) || number == null) return '';

	number = number.toFixed(~~dec);
	tsep = typeof tsep === 'string' ? tsep : ',';

	const parts = number.split('.');
	const fnums = parts[0];
	const decimals = parts[1] ? (dsep || '.') + parts[1] : '';

	return fnums.replace(/(\d)(?=(?:\d{3})+$)/g, `$1${tsep}`) + decimals;
};

const deepEqual = function (a, b) {
	if (!b && !a) {
		return true;
	}

	if (!b || !a) {
		return false;
	}

	const compareObject = function () {
		if (a instanceof Collection.ObjectID && b instanceof Collection.ObjectID) {
			return a._str === b._str;
		}

		if (a instanceof Collection.ObjectID || b instanceof Collection.ObjectID) {
			return false;
		}

		if (Object.keys(a).length !== Object.keys(b).length) {
			return false;
		}

		for (const key in a) {
			const value = a[key];
			if (deepEqual(value, b[key]) !== true) {
				return false;
			}
		}
		return true;
	};

	const compareArray = function () {
		if (a.length !== b.length) {
			return false;
		}

		for (let index = 0; index < a.length; index++) {
			const item = a[index];
			if (deepEqual(item, b[index]) !== true) {
				return false;
			}
		}
		return true;
	};

	if (typeof a !== typeof b) {
		return false;
	}

	if (isArray(a)) {
		if (!isArray(b)) {
			return false;
		}
		return compareArray();
	}

	if (isDate(a)) {
		if (!isDate(b)) {
			return false;
		}

		return a.getTime() === b.getTime();
	}

	if (isObject(a)) {
		if (!isObject(b)) {
			return false;
		}

		return compareObject();
	}

	return a === b;
};

const copyObjectFieldsByPaths = (fromObject, toObject, paths) => {
	for (const path of paths) {
		const sections = path.split('.');
		const leaf = sections.pop();

		let walkFrom = fromObject;
		let walkTo = toObject;

		for (const section of sections) {
			if (!isObject(walkFrom[section])) {
				continue;
			}

			if (!isObject(walkTo[section])) {
				walkTo[section] = {};
			}

			walkFrom = walkFrom[section];
			walkTo = walkTo[section];
		}

		if (walkFrom[leaf]) {
			walkTo[leaf] = walkFrom[leaf];
		}
	}
};

const copyObjectFieldsByPathsIncludingIds = function (fromObject, toObject, paths) {
	const pathsToAdd = [];

	if (paths.indexOf('_id') === -1) {
		pathsToAdd.push('_id');
	}

	for (const path of paths) {
		const sections = path.split('.');
		if (sections.length > 1) {
			pathsToAdd.push(`${sections[0]}._id`);
		}
	}

	paths = pathsToAdd.concat(paths);

	copyObjectFieldsByPaths(fromObject, toObject, paths);
};

const getTermsOfFilter = function (filter) {
	let condition;
	let terms = [];
	if (!isObject(filter)) {
		return terms;
	}

	if (isArray(filter.conditions)) {
		for (condition of filter.conditions) {
			terms.push(condition.term);
		}
	} else if (isObject(filter.conditions)) {
		for (const key in filter.conditions) {
			condition = filter.conditions[key];
			terms.push(condition.term);
		}
	}

	if (isArray(filter.filters)) {
		for (const i of filter.filters) {
			terms = terms.concat(getTermsOfFilter(i));
		}
	}

	return terms;
};

const getFirstPartOfArrayOfPaths = function (paths) {
	if (!isArray(paths)) {
		return paths;
	}

	return paths.map(i => i.split('.')[0]);
};

const getObjectIdString = function (objectId) {
	if (objectId instanceof Collection.ObjectID) {
		return objectId._str;
	}

	if (objectId instanceof Collection.ObjectID) {
		return objectId.toString();
	}

	if (isObject(objectId) && isString(objectId.$oid)) {
		return objectId.$oid;
	}

	return objectId;
};

const convertStringOfFieldsSeparatedByCommaIntoObjectToFind = function (fieldsString) {
	const fields = {};

	if (isString(fieldsString)) {
		const fieldsArray = fieldsString.replace(/\s/g, '').split(',');
		for (const key of fieldsArray) {
			fields[key] = 1;
		}
	}

	return fields;
};

const rpad = function (str, length) {
	while (str.length < length) {
		str += ' ';
	}
	return str;
};

const getByLocale = function (obj, user) {
	if (!has(user, 'locale') || !has(obj, user.locale)) {
		return;
	}

	return obj[user.locale];
};

const getLabel = function (obj, user) {
	if (!has(obj, 'label')) {
		return;
	}

	return getByLocale(obj.label, user);
};

const getPlurals = function (obj, user) {
	if (!has(obj, 'plurals')) {
		return;
	}

	return getByLocale(obj.plurals, user);
};

const convertObjectIdsToFn = function (values, fn) {
	if (isArray(values)) {
		values.forEach((item, index) => (values[index] = convertObjectIdsToFn(item, fn)));
		return values;
	}

	if (isObject(values)) {
		if (values instanceof Collection.ObjectID) {
			return fn(values._str);
		}

		each(values, (value, key) => (values[key] = convertObjectIdsToFn(value, fn)));
		return values;
	}

	return values;
};

const recursiveObject = function (obj, fn) {
	if (!isObject(obj)) {
		return obj;
	}

	each(obj, (value, key) => {
		if (isObject(value)) {
			recursiveObject(value, fn);
		}

		if (isArray(value)) {
			each(value, item => {
				if (isObject(item)) {
					recursiveObject(item, fn);
				}
			});
		}

		fn(key, value, obj);
	});
};

// Runs script in a sandboxed environment and returns resulting object
const runScriptBeforeValidation = async function (script, data, req, extraData) {
	try {
		let user;
		if (req.user) {
			user = JSON.parse(JSON.stringify(req.user));
		}
		const contextData = {
			data,
			emails: [],
			user,
			console,
			extraData,
		};

		const sandbox = createContext(contextData);
		script = `result = (function(data, emails, user, console) { ${script} })(data, emails, user, console);`;
		runInContext(script, sandbox);

		// Check if scriptBeforeValidation added any e-mails to be sent
		// Accepted values:
		//	emails.push({ from: '', to: '', server: '', subject: '', html: '' });
		//	emails.push({ from: '', to: '', server: '', subject: '', template: '_id', data: {  } });
		//	emails.push({ from: '', to: '', server: '', template: '_id', data: {  } });
		if (sandbox.emails && isArray(sandbox.emails) && sandbox.emails.length > 0 && has(Models, 'Message')) {
			sandbox.emails = JSON.parse(JSON.stringify(sandbox.emails));
			for (const email of sandbox.emails) {
				if (email.relations != null) {
					email.data = metapopulateLookupsData(req.meta._id, data, email.relations);
				}
				if (email.toPath != null) {
					email.to = getObjectPathAgg(email.data, email.toPath);
				}

				// HACK for dealing with modified date fields and inserting emails
				for (const key in email.data) {
					const value = email.data[key];
					if (isString(get(value, '$date'))) {
						email.data[key] = new Date(value.$date);
					}
				}

				email.type = 'Email';
				email.status = 'Send';

				await Models.Message.insert(email);
			}
		}

		if (sandbox.result && isObject(sandbox.result)) {
			return sandbox.result;
		}
		return {};
	} catch (e) {
		req.notifyError('runScriptBeforeValidation', e, { script, data });
		return {};
	}
};

// Runs script in a sandboxed environment and returns resulting object
const runValidationScript = function (script, data, req, extraData) {
	try {
		let user;
		if (req.user) {
			user = JSON.parse(JSON.stringify(req.user));
		}
		const contextData = {
			data,
			user,
			console,
			extraData,
		};

		const sandbox = createContext(contextData);
		script = `result = (function(data, user, console) { ${script} })(data, user, console);`;
		runInContext(script, sandbox);

		if (sandbox.result && isObject(sandbox.result)) {
			return sandbox.result;
		}
		return {};
	} catch (e) {
		req.notifyError('runValidationScript', e, { script, data });
		return {};
	}
};

const runScriptAfterSave = async function (script, data, context, extraData) {
	try {
		let user;
		const konectyCall = async function (method) {
			if (method.match(/^auth:/)) {
				throw new Error('[invalid-method] Trying to call an invalid method');
			}

			const result = await callMethod.apply(context, arguments);
			return result;
		};

		if (context.user) {
			user = JSON.parse(JSON.stringify(context.user));
		}
		const contextData = {
			data,
			user,
			console,
			konectyCall,
			Models,
			extraData,
			moment,
			momentzone,
			luxon,
			dateFns,
			request: axios,
		};

		const sandbox = createContext(contextData);
		script = `result = (function(data, user, console, Models, konectyCall, extraData) { ${script} })(data, user, console, Models, konectyCall, extraData);`;
		runInContext(script, sandbox);

		if (sandbox.result && isObject(sandbox.result)) {
			return sandbox.result;
		}
		return {};
	} catch (e) {
		console.error('scriptAfterSave Error ->'.red, e);
		context.notifyError('runScriptAfterSave', e, { script, data });
		return {};
	}
};

const formatValue = function (value, field, ignoreIsList) {
	if (!value) {
		return '';
	}

	if (field.isList === true && ignoreIsList !== true) {
		const values = [];
		for (const item of value) {
			values.push(formatValue(item, field, true));
		}
		return values.join(', ');
	}

	switch (field.type) {
		// TODO time

		case 'boolean':
			if (value === true) {
				return 'Sim';
			}
			return 'Não';

		case 'personName':
			return value.full;
		case 'lookup':
			var result = [];

			var recursive = function (field, value) {
				if (field.type === 'lookup') {
					const meta = Meta[field.document];
					const recursiveValues = [];

					each(field.descriptionFields, descriptionField => {
						descriptionField = descriptionField.split('.');

						descriptionField = meta.fields[descriptionField[0]];

						if (descriptionField && isObject(value)) {
							return recursiveValues.push(recursive(descriptionField, value[descriptionField.name]));
						}
					});

					return recursiveValues;
				}

				value = formatValue(value, field);
				return value;
			};

			result = recursive(field, value);

			var sort = items => items.sort((a, b) => isArray(a));

			var resultRecursive = function (items) {
				if (isArray(items)) {
					items = sort(items);
					each(items, (item, index) => (items[index] = resultRecursive(item)));

					return `(${items.join(' - ')})`;
				}

				return items;
			};

			result = sort(result);
			each(result, (r, index) => (result[index] = resultRecursive(r)));

			return result.join(' - ');
		case 'address':
			result = [];
			value.placeType && result.push(`${value.placeType}`);
			value.place && result.push(` ${value.place}`);
			value.number && result.push(`, ${value.number}`);
			value.complement && result.push(`, ${value.complement}`);
			value.district && result.push(`, ${value.district}`);
			value.city && result.push(`, ${value.city}`);
			value.state && result.push(`, ${value.state}`);
			value.country && result.push(`, ${value.country}`);
			value.postalCode && result.push(`, ${value.postalCode}`);
			return result.join('');
		case 'phone':
			result = [];
			value.countryCode && result.push(`${value.countryCode}`);
			value.phoneNumber && value.phoneNumber.length > 6 && result.push(` (${value.phoneNumber.substr(0, 2)}) ${value.phoneNumber.substr(2, 4)}-${value.phoneNumber.substr(6)}`);
			return result.join('');
		case 'money':
			result = [];
			if (get(value, 'currency') === 'BRL') {
				return `R$ ${numberFormat(value.value, 2, ',', '.')}`;
			}
			return `$ ${numberFormat(value.value, 2)}`;

		case 'date':
			if (value.toISOString != null) {
				return value.toISOString().replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$3/$2/$1');
			}
			return value;

		case 'dateTime':
			if (value.toISOString != null) {
				return value.toISOString().replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).*/, '$3/$2/$1 $4:$5:$6');
			}
			return value;

		case 'filter':
			return '(filtro)';
		case 'picklist':
			if (isArray(value)) {
				return value.join(', ');
			}
			return value;

		default:
			return value;
	}
};

const getObjectPathAgg = function (obj, path, defaultValue) {
	let value;
	if (!path) {
		return obj;
	}

	if (!obj) {
		return defaultValue;
	}

	if (isString(path)) {
		return getObjectPathAgg(obj, path.split('.'), defaultValue);
	}

	const currentPath = path[0];

	if (path.length === 1) {
		if (obj[currentPath] === undefined) {
			return defaultValue;
		}

		return obj[currentPath];
	}

	if (isArray(obj[currentPath]) && !/^\d$/.test(path[1])) {
		value = [];
		path = path.slice(1);
		for (const item of obj[currentPath]) {
			value = value.concat(getObjectPathAgg(item, path, defaultValue));
		}
	} else {
		value = getObjectPathAgg(obj[currentPath], path.slice(1), defaultValue);
	}

	return value;
};

const setObjectByPath = function (obj, keyPath, value) {
	const lastKeyIndex = keyPath.length - 1;
	for (let i = 0, end = lastKeyIndex, asc = end >= 0; asc ? i < end : i > end; asc ? i++ : i--) {
		const key = keyPath[i];
		if (!obj.includes(key)) {
			obj[key] = {};
		}
		obj = obj[key];
	}

	obj[keyPath[lastKeyIndex]] = value;
};

const hexString = digits => {
	const numBytes = Math.ceil(digits / 2);
	let bytes;
	try {
		bytes = crypto.randomBytes(numBytes);
	} catch (e) {
		bytes = crypto.pseudoRandomBytes(numBytes);
	}
	const result = bytes.toString('hex');
	return result.substring(0, digits);
};

const fraction = () => {
	const numerator = Number.parseInt(hexString(8), 16);
	return numerator * 2.3283064365386963e-10; // 2^-3;
};

const choice = arrayOrString => {
	const index = Math.floor(fraction() * arrayOrString.length);
	if (typeof arrayOrString === 'string') {
		return arrayOrString.substr(index, 1);
	}
	return arrayOrString[index];
};

const randomString = (charsCount, alphabet) => {
	let result = '';
	for (let i = 0; i < charsCount; i++) {
		result += choice(alphabet);
	}
	return result;
};

const randomId = () => randomString(17, UNMISTAKABLE_CHARS);

const randomPassword = (charsCount = 6) => randomString(charsCount, UNMISTAKABLE_CHARS);

// Default to 256 bits of entropy, or 43 characters at 6 bits per
// character.
const randomSecret = (charsCount = 43) => randomString(charsCount, BASE64_CHARS);

const accentsTidy = s => {
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

const unicodeSortArrayOfObjectsByParam = (arr, param) =>
	arr.sort((a, b) => {
		if (a[param] != null) {
			return accentsTidy(a[param]).localeCompare(accentsTidy(b[param]));
		}
		return 0;
	});

export {
	deepEqual,
	copyObjectFieldsByPaths,
	copyObjectFieldsByPathsIncludingIds,
	getTermsOfFilter,
	getFirstPartOfArrayOfPaths,
	getObjectIdString,
	convertStringOfFieldsSeparatedByCommaIntoObjectToFind,
	rpad,
	getByLocale,
	getLabel,
	getPlurals,
	convertObjectIdsToFn,
	recursiveObject,
	runScriptBeforeValidation,
	runValidationScript,
	runScriptAfterSave,
	formatValue,
	getObjectPathAgg,
	setObjectByPath,
	randomId,
	randomSecret,
	randomPassword,
	unicodeSortArrayOfObjectsByParam,
};
