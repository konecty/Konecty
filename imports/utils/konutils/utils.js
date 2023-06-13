import { Meteor } from 'meteor/meteor';
import { Mongo, MongoInternals } from 'meteor/mongo';
import { createContext, runInContext } from 'vm';
import momentzone from 'moment-timezone';
import moment from 'moment';
import request from 'request';

import isArray from 'lodash/isArray';
import isDate from 'lodash/isDate';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import each from 'lodash/each';
import has from 'lodash/has';
import get from 'lodash/get';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import isFunction from 'lodash/isFunction';

import numberFormat from 'underscore.string/numberFormat';

import { metaUtils } from '/imports/utils/konutils/metaUtils';
import { mapObjIndexed } from 'ramda';
import { Meta, Models } from '/imports/model/MetaObject';
import { logger } from '../logger';

export const utils = {
	deepEqual(a, b) {
		if (!b && !a) {
			return true;
		}

		if (!b || !a) {
			return false;
		}

		const compareObject = function () {
			if (a instanceof Meteor.Collection.ObjectID && b instanceof Meteor.Collection.ObjectID) {
				return a._str === b._str;
			}

			if (a instanceof Meteor.Collection.ObjectID || b instanceof Meteor.Collection.ObjectID) {
				return false;
			}

			if (Object.keys(a).length !== Object.keys(b).length) {
				return false;
			}

			for (let key in a) {
				const value = a[key];
				if (utils.deepEqual(value, b[key]) !== true) {
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
				if (utils.deepEqual(item, b[index]) !== true) {
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
	},

	copyObjectFieldsByPaths(fromObject, toObject, paths) {
		for (let path of paths) {
			const sections = path.split('.');
			const leaf = sections.pop();

			let walkFrom = fromObject;
			let walkTo = toObject;

			for (let section of sections) {
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
	},

	copyObjectFieldsByPathsIncludingIds(fromObject, toObject, paths) {
		const pathsToAdd = [];

		if (paths.indexOf('_id') === -1) {
			pathsToAdd.push('_id');
		}

		for (let path of paths) {
			const sections = path.split('.');
			if (sections.length > 1) {
				pathsToAdd.push(`${sections[0]}._id`);
			}
		}

		paths = pathsToAdd.concat(paths);

		utils.copyObjectFieldsByPaths(fromObject, toObject, paths);
	},

	getTermsOfFilter(filter) {
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
			for (let key in filter.conditions) {
				condition = filter.conditions[key];
				terms.push(condition.term);
			}
		}

		if (isArray(filter.filters)) {
			for (let i of filter.filters) {
				terms = terms.concat(utils.getTermsOfFilter(i));
			}
		}

		return terms;
	},

	getFirstPartOfArrayOfPaths(paths) {
		if (!isArray(paths)) {
			return paths;
		}

		return paths.map(i => i.split('.')[0]);
	},

	getObjectIdString(objectId) {
		if (objectId instanceof Meteor.Collection.ObjectID) {
			return objectId._str;
		}

		if (objectId instanceof MongoInternals.NpmModule.ObjectID) {
			return objectId.toString();
		}

		if (isObject(objectId) && isString(objectId.$oid)) {
			return objectId.$oid;
		}

		return objectId;
	},

	convertStringOfFieldsSeparatedByCommaIntoObjectToFind(fieldsString) {
		const fields = {};

		if (isString(fieldsString)) {
			const fieldsArray = fieldsString.replace(/\s/g, '').split(',');
			for (let key of fieldsArray) {
				fields[key] = 1;
			}
		}

		return fields;
	},

	rpad(str, length) {
		while (str.length < length) {
			str += ' ';
		}
		return str;
	},

	getByLocale(obj, user) {
		if (!has(user, 'locale') || !has(obj, user.locale)) {
			return;
		}

		return obj[user.locale];
	},

	getLabel(obj, user) {
		if (!has(obj, 'label')) {
			return;
		}

		return utils.getByLocale(obj.label, user);
	},

	getPlurals(obj, user) {
		if (!has(obj, 'plurals')) {
			return;
		}

		return utils.getByLocale(obj.plurals, user);
	},

	convertObjectIdsToFn(values, fn) {
		if (isArray(values)) {
			values.forEach((item, index) => (values[index] = utils.convertObjectIdsToFn(item, fn)));
			return values;
		}

		if (isObject(values)) {
			if (values instanceof Mongo.ObjectID) {
				return fn(values._str);
			}

			each(values, (value, key) => (values[key] = utils.convertObjectIdsToFn(value, fn)));
			return values;
		}

		return values;
	},

	recursiveObject(obj, fn) {
		if (!isObject(obj)) {
			return obj;
		}

		each(obj, function (value, key) {
			if (isObject(value)) {
				utils.recursiveObject(value, fn);
			}

			if (isArray(value)) {
				each(value, function (item) {
					if (isObject(item)) {
						utils.recursiveObject(item, fn);
					}
				});
			}

			fn(key, value, obj);
		});
	},

	// Runs script in a sandboxed environment and returns resulting object
	runScriptBeforeValidation(script, data, req, extraData) {
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
				for (let email of sandbox.emails) {
					if (email.relations != null) {
						email.data = metaUtils.populateLookupsData(req.meta._id, data, email.relations);
					}
					if (email.toPath != null) {
						email.to = utils.getObjectPathAgg(email.data, email.toPath);
					}

					// HACK for dealing with modified date fields and inserting emails
					for (let key in email.data) {
						const value = email.data[key];
						if (isString(get(value, '$date'))) {
							email.data[key] = new Date(value['$date']);
						}
					}

					email.type = 'Email';
					email.status = 'Send';

					Models['Message'].insert(email);
				}
			}

			if (sandbox.result && isObject(sandbox.result)) {
				return sandbox.result;
			} else {
				return {};
			}
		} catch (e) {
			logger.error(e, `Error running script before validation ${e.message}`);
			return {};
		}
	},

	// Runs script in a sandboxed environment and returns resulting object
	runValidationScript(script, data, req, extraData) {
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
			} else {
				return {};
			}
		} catch (e) {
			logger.error(e, `Error running validation script ${e.message}`);
			return {};
		}
	},

	runScriptAfterSave(script, data, context, extraData) {
		try {
			// exposed Meteor.call for sandboxed script
			let user;
			const konectyCall = function (method) {
				if (method.match(/^auth:/)) {
					throw new Meteor.Error('invalid-method', 'Trying to call an invalid method');
				}

				return Meteor.call.apply(context, arguments);
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
				request,
			};

			const sandbox = createContext(contextData);
			script = `result = (function(data, user, console, Models, konectyCall, extraData) { ${script} })(data, user, console, Models, konectyCall, extraData);`;
			runInContext(script, sandbox);

			if (sandbox.result && isObject(sandbox.result)) {
				return sandbox.result;
			} else {
				return {};
			}
		} catch (e) {
			logger.error(e, `runScriptAfterSave error: ${e.message}`);
			return {};
		}
	},

	formatValue(value, field, ignoreIsList) {
		if (!value) {
			return '';
		}

		if (field.isList === true && ignoreIsList !== true) {
			const values = [];
			for (let item of value) {
				values.push(utils.formatValue(item, field, true));
			}
			return values.join(', ');
		}

		switch (field.type) {
			// TODO time

			case 'boolean':
				if (value === true) {
					return 'Sim';
				} else {
					return 'Não';
				}
			case 'personName':
				return value.full;
			case 'lookup':
				var result = [];

				var recursive = function (field, value) {
					if (field.type === 'lookup') {
						const meta = Meta[field.document];
						const recursiveValues = [];

						each(field.descriptionFields, function (descriptionField) {
							descriptionField = descriptionField.split('.');

							descriptionField = meta.fields[descriptionField[0]];

							if (descriptionField && isObject(value)) {
								return recursiveValues.push(recursive(descriptionField, value[descriptionField.name]));
							}
						});

						return recursiveValues;
					}

					value = utils.formatValue(value, field);
					return value;
				};

				result = recursive(field, value);

				var sort = items => items.sort((a) => isArray(a));

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
				value.phoneNumber &&
					value.phoneNumber.length > 6 &&
					result.push(` (${value.phoneNumber.substr(0, 2)}) ${value.phoneNumber.substr(2, 4)}-${value.phoneNumber.substr(6)}`);
				return result.join('');
			case 'money':
				result = [];
				if (get(value, 'currency') === 'BRL') {
					return `R$ ${numberFormat(value.value, 2, ',', '.')}`;
				} else {
					return `$ ${numberFormat(value.value, 2)}`;
				}
			case 'date':
				if (value.toISOString != null) {
					return value.toISOString().replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$3/$2/$1');
				} else {
					return value;
				}
			case 'dateTime':
				if (value.toISOString != null) {
					return value.toISOString().replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).*/, '$3/$2/$1 $4:$5:$6');
				} else {
					return value;
				}
			case 'filter':
				return '(filtro)';
			case 'picklist':
				if (isArray(value)) {
					return value.join(', ');
				} else {
					return value;
				}
			default:
				return value;
		}
	},

	getObjectPathAgg(obj, path, defaultValue) {
		let value;
		if (!path) {
			return obj;
		}

		if (!obj) {
			return defaultValue;
		}

		if (isString(path)) {
			return utils.getObjectPathAgg(obj, path.split('.'), defaultValue);
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
			for (let item of obj[currentPath]) {
				value = value.concat(utils.getObjectPathAgg(item, path, defaultValue));
			}
		} else {
			value = utils.getObjectPathAgg(obj[currentPath], path.slice(1), defaultValue);
		}

		return value;
	},

	setObjectByPath(obj, keyPath, value) {
		const lastKeyIndex = keyPath.length - 1;
		for (let i = 0, end = lastKeyIndex, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
			const key = keyPath[i];
			if (!obj.includes(key)) {
				obj[key] = {};
			}
			obj = obj[key];
		}

		obj[keyPath[lastKeyIndex]] = value;
	},

	accentsTidy(s) {
		if (!isString(s)) {
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
	},

	unicodeSortArrayOfObjectsByParam(arr, param) {
		return arr.sort(function (a, b) {
			if (a[param] != null) {
				return utils.accentsTidy(a[param]).localeCompare(utils.accentsTidy(b[param]));
			}
			return 0;
		});
	},

	sortArrayOfObjectsByParam(arr, param) {
		return arr.sort(function (a, b) {
			if (a[param]) {
				return a[param].localeCompare(b[param]);
			}
			return 0;
		});
	},

	processDate: mapObjIndexed(value => {
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
	}),

	mapDateValue(record) {
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
							[key]: moment(value).toISOString(),
						};
					}
					if (isArray(value)) {
						return {
							...acc,
							[key]: map(value, utils.mapDateValue),
						};
					}
					if (isObject(value)) {
						return {
							...acc,
							[key]: utils.mapDateValue(value),
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
	},
};
