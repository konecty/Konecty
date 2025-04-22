import { hash as bcryptHash } from 'bcryptjs';

import { createHash } from 'crypto';

import deburr from 'lodash/deburr';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isBoolean from 'lodash/isBoolean';
import isDate from 'lodash/isDate';
import isEqual from 'lodash/isEqual';
import isFunction from 'lodash/isFunction';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import kebabCase from 'lodash/kebabCase';
import omit from 'lodash/omit';
import size from 'lodash/size';

import { DateTime } from 'luxon';

import { camelCase, capitalCase, constantCase, dotCase, headerCase, noCase, paramCase, pascalCase, pathCase, sentenceCase, snakeCase } from 'change-case';
import { lowerCase } from 'lower-case';
import { titleCase } from 'title-case';
import { upperCase } from 'upper-case';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '../utils/logger';

import { stringToDate } from '../data/dateParser';
import { copyDescriptionAndInheritedFields } from '../meta/copyDescriptionAndInheritedFields';
import { removeInheritedFields } from '../meta/removeInheritedFields';
import { getNextCode } from './getNextCode';

import { errorReturn, successReturn } from '@imports/utils/return';
import Bluebird from 'bluebird';
import { BCRYPT_SALT_ROUNDS } from '../consts';

const regexUtils = {
	email: /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/,
	url: /^http(?:s)?:\/\/(www\.)?[a-z0-9]+(?:[-.]{1}[a-z0-9]+)*(?::[0-9]{1,5})?(\/.*)?$/,
};

const slugify = (text) => {
	if (text == null) return '';
	return deburr(String(text).toLowerCase())
		.replace(/[^a-z0-9]/g, '')
		.trim();
};

const CaseFunctions = {
	camelCase,
	capitalCase,
	constantCase,
	dotCase,
	headerCase,
	noCase,
	paramCase,
	pascalCase,
	pathCase,
	sentenceCase,
	snakeCase,
	kebabCase,
	titleCase,
	upperCase,
	lowerCase,
	slugCase: slugify,
};

const VALID_OPERATORS = [
	'exists',
	'equals',
	'not_equals',
	'in',
	'not_in',
	'contains',
	'not_contains',
	'starts_with',
	'end_with',
	'less_than',
	'greater_than',
	'less_or_equals',
	'greater_or_equals',
	'between',
];

const ALLOWED_CURRENCIES = ['BRL'];

export async function validateAndProcessValueFor({ meta, fieldName, value, actionType, objectOriginalValues, objectNewValues, idsToUpdate }, dbSession) {
	if (meta == null) {
		return errorReturn(`MetaObject.Meta does not exists`);
	}

	const field = meta.fields[fieldName];

	if (!field) {
		return errorReturn(`Field ${fieldName} does not exists on ${meta._id}`);
	}

	// Validate required fields

	if (field.isRequired === true && (value == null || (typeof value === 'string' && size(value) === 0))) {
		return errorReturn(`Field ${fieldName} is required`);
	}

	// Validate List fields
	if (field.isList === true) {
		if (field.maxElements && field.maxElements > 0) {
			if (!isArray(value) || value.length > field.maxElements) {
				return errorReturn(`Value for field ${fieldName} must be array with the maximum of ${field.maxElements} item(s)`);
			}
		}

		if (field.minElements && field.minElements > 0) {
			if (!isArray(value) || value.length < field.minElements) {
				return errorReturn(`Value for field ${fieldName} must be array with the minimum of ${field.minElements} item(s)`);
			}
		}

		if (field.isAllowDuplicates === false && isArray(value)) {
			if (value.some((itemA, indexA) => value.some((itemB, indexB) => indexA !== indexB && isEqual(itemA, itemB)))) {
				return errorReturn(`Value for field ${fieldName} must be a list with no duplicated values`);
			}
		}
	}

	if (actionType === 'update' && value == null && field.type === 'lookup') {
		Object.assign(objectNewValues, removeInheritedFields(field, objectNewValues));
	}

	if (value == null && field.type !== 'autoNumber') {
		return {
			success: true,
			data: value,
		};
	}

	// If field is Unique verify if exists another record on db with same value
	if (value && field.isUnique === true && field.type !== 'autoNumber') {
		const query = {
			[fieldName]: value,
		};

		const multiUpdate = (idsToUpdate != null ? idsToUpdate.length : undefined) > 1;

		// If is a single update exclude self record in verification
		if (actionType === 'update' && multiUpdate !== true) {
			query._id = { $ne: idsToUpdate[0] };
		}

		const collection = MetaObject.Collections[meta.name];

		if (collection == null) {
			return errorReturn(`Collection for ${meta.name} does not exists`);
		}

		const count = await collection.countDocuments(query);
		if (count > 0) {
			return errorReturn(`Value for field ${fieldName} must be unique`);
		}
	}

	const removeUnauthorizedKeys = (obj, keys) => {
		const objKeys = Object.keys(obj);

		const unauthorizedKeys = objKeys.filter(key => keys.indexOf(key) === -1);
		return omit(obj, unauthorizedKeys);
	};

	const mustBeValidFilter = v => {
		if (['and', 'or'].includes(v.match) === false) {
			return {
				success: false,
				errors: [
					{
						message: `Value for field ${fieldName} must contains a property named 'match' with one of values ['and', 'or']`,
					},
				],
			};
		}

		if (isArray(v.conditions)) {
			v.conditions = v.conditions.reduce((acc, condition) => {
				acc[condition.term.replace(/\./g, ':') + ':' + condition.operator] = condition;
				return acc;
			}, {});
		}

		if (!isObject(v.conditions)) {
			return {
				success: false,
				errors: [
					{
						message: `Value for field ${fieldName} must contains a property named 'conditions' of type Object with at least 1 item`,
					},
				],
			};
		}

		if (Object.values(v.conditions).some(condition => mustBeString(condition.term).success === false || mustBeString(condition.operator).success === false)) {
			return {
				success: false,
				errors: [
					{
						message: `Value for field ${fieldName} must contains conditions with properties 'term' and 'operator' of type String`,
					},
				],
			};
		}

		if (Object.values(v.conditions).some(condition => !VALID_OPERATORS.includes(condition.operator))) {
			return {
				success: false,
				errors: [
					{
						message: `Value for field ${fieldName} must contains conditions with valid operators such as [${VALID_OPERATORS.join(', ')}]`,
					},
				],
			};
		}

		if (Object.values(v.conditions).some(condition => !has(condition, 'value'))) {
			return {
				success: false,
				errors: [
					{
						message: `Value for field ${fieldName} must contains conditions property named 'value'`,
					},
				],
			};
		}

		if (isArray(v.filters)) {
			if (v.filters.some(filter => mustBeValidFilter(filter) === false)) {
				return {
					success: false,
					errors: [
						{
							message: `Value for field ${fieldName} must contains filters with valid structure`,
						},
					],
				};
			}
		}

		return {
			success: true,
		};
	};

	const mustBeString = (v, path) => {
		if (isString(v)) {
			return { success: true };
		}

		return {
			success: false,
			errors: [
				{
					message: `Value for field ${path ?? fieldName} must be a valid String`,
				},
			],
		};
	};

	const mustBeStringOrNull = (v, path) => {
		if (v == null) {
			return { success: true };
		}
		return mustBeString(v, path);
	};

	const mustBeNumber = (v, path) => {
		if (isNumber(v)) {
			return { success: true };
		}
		return {
			success: false,
			errors: [
				{
					message: `Value for field ${path ?? fieldName} must be a valid Number`,
				},
			],
		};
	};

	const mustBeBoolean = (v, path) => {
		if (isBoolean(v)) {
			return { success: true };
		}
		return {
			success: false,
			errors: [
				{
					message: `Value for field ${path ?? fieldName} must be a valid Boolean`,
				},
			],
		};
	};

	const mustBeObject = (v, path) => {
		if (isObject(v)) {
			return { success: true };
		}
		return {
			success: false,
			errors: [
				{
					message: `Value for field ${path ?? fieldName} must be a valid Object`,
				},
			],
		};
	};

	const mustBeArray = (v, path) => {
		if (isArray(v)) {
			return { success: true };
		}
		return {
			success: false,
			errors: [
				{
					message: `Value for field ${path ?? fieldName} must be a valid Array`,
				},
			],
		};
	};

	const mustBeArrayOrNull = (v, path) => {
		if (v == null) {
			return { success: true };
		}
		return mustBeArray(v, path);
	};

	const mustBeDate = (v, path) => {
		const date = new Date(v);

		if (isNaN(date)) {
			return {
				success: false,
				errors: [
					{
						message: `Value for field ${path ?? fieldName} must be a valid Date`,
					},
				],
			};
		}
		return { success: true };
	};

	const validate = async value => {
		// let optionalKeys, requiredKeys;
		switch (field.type) {
			case 'boolean':
				const booleanResult = mustBeBoolean(value);
				return booleanResult.success ? successReturn(value) : booleanResult;

			case 'number':
			case 'percentage':
				const numberResult = mustBeNumber(value);
				if (numberResult.success === false) {
					return numberResult;
				}

				if (isNumber(field.maxValue) && value > field.maxValue) {
					return errorReturn(`Value for field ${fieldName} must be less than ${field.maxValue}`)
				}

				if (isNumber(field.minValue) && value < field.minValue) {
					return errorReturn(`Value for field ${fieldName} must be greater than ${field.minValue}`)
				}

				return successReturn(value);

			case 'picklist':
				if (isNumber(field.maxSelected) && field.maxSelected > 1) {
					const pickListResult = mustBeArray(value);
					if (pickListResult.success === false) {
						return pickListResult;
					}
					if (value.length > field.maxSelected) {
						return errorReturn(`Value for field ${fieldName} must be an array with max of ${field.maxSelected} item(s)`);
					}
				}

				if (isNumber(field.minSelected) && field.minSelected > 0) {
					if (field.minSelected === 1 && (!value || (isArray(value) && value.length === 0))) {
						return errorReturn(`Value for field ${fieldName} must be an array with min of ${field.minSelected} item(s)`);
					}
					if (value.length < field.minSelected) {
						return errorReturn(`Value for field ${fieldName} must be an array with min of ${field.minSelected} item(s)`);
					}
				}

				if ([].concat(value).some(v => !Object.keys(field.options).includes(v))) {
					return errorReturn(`Value ${value} for field ${fieldName} is invalid`)
				}

				return successReturn(value);

			case 'text':
			case 'richText':
				if (isNumber(value)) {
					value = String(value);
				}

				const stringResult = mustBeString(value);

				if (stringResult.success === false) {
					return stringResult;
				}

				if (field.normalization != null && isFunction(CaseFunctions[`${field.normalization}Case`])) {
					value = CaseFunctions[`${field.normalization}Case`](value);
				}

				if (isNumber(field.size) && field.size > 0) {
					if (value.length > field.size) {
						return errorReturn(`Value for field ${fieldName} must be less than ${field.size} characters`);
					}
				}

				return {
					success: true,
					data: value,
				};

			case 'dateTime':
			case 'date':
				const dateResult = mustBeDate(value.$date ?? value, `${fieldName}.$date`);

				if (dateResult.success === false) {
					return dateResult;
				}

				value = new Date(value.$date ?? value);

				const getDateValue = dateValue => {
					const result = dateValue === '$now' ? new Date() : dateValue;

					if (isDate(result) && field.type === 'date') {
						return DateTime.fromJSDate(result).startOf('day').toJSDate();
					}
					return result;
				};

				if (field.maxValue != null || field.minValue != null) {
					const minValue = getDateValue(field.minValue);
					const maxValue = getDateValue(field.maxValue);

					if (field.type === 'date') {
						value = DateTime.fromJSDate(value).startOf('day').toJSDate();
					}

					const dateFormat = field.type === 'date' ? 'dd/MM/yyyy' : 'dd/MM/yyyy HH:mm:ss';

					if (isDate(maxValue) !== false && value > maxValue) {
						return {
							success: false,
							errors: [
								{
									message: `Value for field ${fieldName} must be less than or equals to ${DateTime.fromJSDate(maxValue).toFormat(dateFormat)}`,
								},
							],
						};
					}

					if (mustBeDate(minValue) !== false && value < minValue) {
						return {
							success: false,
							errors: [
								{
									message: `Value for field ${fieldName} must be greater than or equals to ${DateTime.fromJSDate(minValue).toFormat(dateFormat)}`,
								},
							],
						};
					}
				}

				return {
					success: true,
					data: value,
				};

			case 'time':
				const timeResult = mustBeNumber(value);
				if (timeResult.success === false) {
					return timeResult;
				}

				if (value < 0 || value > 86400000) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName} must be agreater then 0 and less then 86400000`,
							},
						],
					};
				}

				return {
					success: true,
					data: value,
				};

			case 'email':
				const emailObjectResult = mustBeObject(value);
				if (emailObjectResult.success === false) {
					return emailObjectResult;
				}
				const addressResult = mustBeString(value.address, `${fieldName}.address`);
				if (addressResult.success === false) {
					return addressResult;
				}

				const typeResult = mustBeStringOrNull(value.type, `${fieldName}.type`);

				if (typeResult.success === false) {
					return typeResult;
				}

				if (regexUtils.email.test(value.address) === false) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName}.address must be a valid email`,
							},
						],
					};
				}

				value.address = value.address.toLowerCase();

				return {
					success: true,
					data: value,
				};

			case 'url':
				const urlStringResult = mustBeString(value);
				if (urlStringResult.success === false) {
					return urlStringResult;
				}

				if (regexUtils.url.test(value) === false) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName} must be a valid url`,
							},
						],
					};
				}

				return {
					success: true,
					data: value,
				};

			case 'personName':
				const personObjectResult = mustBeObject(value);
				if (personObjectResult.success === false) {
					return personObjectResult;
				}

				const keys = ['prefix', 'first', 'middle', 'last', 'sufix', 'full'];

				value = removeUnauthorizedKeys(value, keys);

				const personValuesResult = keys.map(key => mustBeStringOrNull(value[key], `${fieldName}.${key}`)).find(v => v.success === false);
				if (personValuesResult != null) {
					return personValuesResult;
				}

				value = keys.reduce((acc, key) => {
					if (isString(value[key])) {
						acc[key] = titleCase(value[key]);
					}
					return acc;
				}, {});

				value.full = value.full ?? keys
					.map(key => value[key] ?? '')
					.filter(v => v.length > 0)
					.join(' ');

				return {
					success: true,
					data: value,
				};

			case 'phone':
				const phoneObjectResult = mustBeObject(value);
				if (phoneObjectResult.success === false) {
					return phoneObjectResult;
				}

				const validKeys = ['countryCode', 'phoneNumber', 'extention', 'type'];

				value = removeUnauthorizedKeys(value, validKeys);

				value = validKeys.reduce((acc, key) => {
					if (value[key] == null) {
						return acc;
					}
					if (isNumber(value[key])) {
						acc[key] = String(value[key]);
					} else {
						acc[key] = value[key];
					}
					return acc;
				}, {});

				if (isString(value.countryCode)) {
					value.countryCode = parseInt(value.countryCode);
				}

				const countryCodeResult = mustBeNumber(value.countryCode, `${fieldName}.countryCode`);
				if (countryCodeResult.success === false) {
					return countryCodeResult;
				}

				const phoneNumberResult = mustBeString(value.phoneNumber, `${fieldName}.phoneNumber`);
				if (phoneNumberResult.success === false) {
					return phoneNumberResult;
				}

				const extentionResult = mustBeStringOrNull(value.extention, `${fieldName}.extention`);
				if (extentionResult.success === false) {
					return extentionResult;
				}

				const phoneTypeResult = mustBeStringOrNull(value.type, `${fieldName}.type`);
				if (phoneTypeResult.success === false) {
					return phoneTypeResult;
				}

				if (value.countryCode < 0 || value.countryCode > 999) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName}.countryCode must contains 1, 2 or 3 digits`,
							},
						],
					};
				}

				if (value.countryCode === 55 && !/^[0-9]{10,12}$/.test(value.phoneNumber)) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName}.phoneNumber with countryCode '55' must contains from 10 to 12 digits`,
							},
						],
					};
				}

				return {
					success: true,
					data: value,
				};

			case 'geoloc':
				const geoArrayResult = mustBeArray(value);
				if (geoArrayResult.success === false) {
					return geoArrayResult;
				}

				if (value.length !== 2 || !isNumber(value[0]) || !isNumber(value[1])) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName} must be an array with longitude and latitude`,
							},
						],
					};
				}

				return {
					success: true,
					data: value,
				};

			case 'money':
				const moneyObjectResult = mustBeObject(value);

				if (moneyObjectResult.success === false) {
					return moneyObjectResult;
				}

				value = removeUnauthorizedKeys(value, ['currency', 'value']);

				if (!isString(value.currency) || ALLOWED_CURRENCIES.includes(!value.currency)) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName}.currency must be one of [${ALLOWED_CURRENCIES.join(', ')}]`,
							},
						],
					};
				}

				if (!isNumber(value.value)) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName}.value must be a valid Number`,
							},
						],
					};
				}

				return {
					success: true,
					data: value,
				};

			case 'json':
				if (!isObject(value) && !isArray(value)) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName} must be a valid Object or Array`,
							},
						],
					};
				}

				return successReturn(value);

			case 'password':
				const passwordStringResult = mustBeString(value);
				if (passwordStringResult.success === false) {
					return passwordStringResult;
				}

				const hashedPassword = createHash('sha256').update(value).digest('hex');

				const hashPassword = await bcryptHash(hashedPassword, BCRYPT_SALT_ROUNDS);

				return successReturn(hashPassword);

			case 'encrypted':
				const encryptedStringResult = mustBeString(value);
				if (encryptedStringResult.success === false) {
					return encryptedStringResult;
				}

				value = createHash('md5').update(value).digest('hex');

				return successReturn(value);

			case 'autoNumber':
				if (actionType === 'update') {
					value = undefined;
				} else {
					const nextCodeResult = await getNextCode(meta.name, fieldName, dbSession);
					if (nextCodeResult.success === false) {
						return nextCodeResult;
					}
					value = nextCodeResult.data;
				}

				return successReturn(value);

			case 'address':
				const addressObjectResult = mustBeObject(value);

				if (addressObjectResult.success === false) {
					return addressObjectResult;
				}

				const requiredKeys = field.isRequired === true ? ['country', 'state', 'city', 'place', 'number'] : [];
				const optionalKeys =
					field.isRequired === true
						? ['postalCode', 'district', 'placeType', 'complement', 'type']
						: ['country', 'state', 'city', 'place', 'number', 'postalCode', 'district', 'placeType', 'complement', 'type'];
				const extraKeys = ['geolocation'];

				value = removeUnauthorizedKeys(value, requiredKeys.concat(optionalKeys).concat(extraKeys));

				value = requiredKeys
					.concat(optionalKeys)
					.concat(extraKeys)
					.reduce((acc, key) => {
						if (value[key] == null) {
							return acc;
						}
						if (isNumber(value[key])) {
							acc[key] = String(value[key]);
						} else {
							acc[key] = value[key];
						}
						return acc;
					}, {});

				const requiredResult = requiredKeys.map(key => mustBeString(value[key], `${fieldName}.${key}`)).find(v => v.success === false);

				if (requiredResult != null) {
					return requiredResult;
				}

				const optionalResult = optionalKeys.map(key => mustBeStringOrNull(value[key], `${fieldName}.${key}`)).find(v => v.success === false);

				if (optionalResult != null) {
					return optionalResult;
				}

				const geoResult = mustBeArrayOrNull(value.geolocation, `${fieldName}.geolocation`);
				if (geoResult.success === false) {
					return geoResult;
				}

				if (isArray(value.geolocation) && (value.geolocation.length !== 2 || !isNumber(value.geolocation[0]) || !isNumber(value.geolocation[1]))) {
					return {
						success: false,
						errors: [
							{
								message: `Value for field ${fieldName}.geolocation must be an array with longitude and latitude`,
							},
						],
					};
				}

				return successReturn(value);

			case 'filter':
				const objectFilterResult = mustBeObject(value);
				if (objectFilterResult.success === false) {
					return objectFilterResult;
				}

				const filterResult = mustBeValidFilter(value);
				if (filterResult.success === false) {
					return filterResult;
				}

				value = stringToDate(value);

				return successReturn(value);

			case 'composite':
				const compositeObjectResult = mustBeObject(value);
				if (compositeObjectResult.success === false) {
					return compositeObjectResult;
				}

				if (field.compositeType === 'reference') {
					const referenceMeta = MetaObject.Meta[field.objectRefId];

					if (referenceMeta == null) {
						return errorReturn(`Document ${field.objectRefId} not found`);
					}

					const referenceDataValidationResults = await Promise.all(
						Object.keys(value).map(async key => {
							const subValue = value[key];
							const params = {
								meta: referenceMeta,
								fieldName: key,
								value: subValue,
								actionType,
								objectOriginalValues: value,
								objectNewValues: value,
								idsToUpdate
							};

							const validationResult = await validateAndProcessValueFor(params, dbSession);
							if (validationResult.success === false) {
								return validationResult;
							}
							return successReturn({ key, value: validationResult.data });
						}),
					);

					if (referenceDataValidationResults.some(v => v.success === false)) {
						return referenceDataValidationResults.find(v => v.success === false);
					}

					value = referenceDataValidationResults.reduce((acc, v) => {
						acc[v.data.key] = v.data.value;
						return acc;
					}, {});
				}

				return successReturn(value);

			case 'lookup':
			case 'inheritLookup':
				const inheritLookupObjectResult = mustBeObject(value);
				if (inheritLookupObjectResult.success === false) {
					return inheritLookupObjectResult;
				}

				if (Object.keys(value).length === 0) {
					return successReturn(null);
				}

				const idResult = mustBeString(value._id, `${fieldName}._id`);
				if (idResult.success === false) {
					return idResult;
				}

				const lookupCollection = MetaObject.Collections[field.document];
				if (lookupCollection == null) {
					return errorReturn(`Collection ${field.document} not found`);
				}

				const record = await lookupCollection.findOne({ _id: value._id }, { session: dbSession });

				if (record == null) {
					return errorReturn(`Record not found for field ${fieldName} with _id [${value._id}] on document [${field.document}]`);
				}

				const inheritedFieldsResult = await copyDescriptionAndInheritedFields({
					field,
					record,
					meta,
					actionType,
					objectOriginalValues,
					objectNewValues,
					idsToUpdate,
				}, dbSession);

				return inheritedFieldsResult;

			// when 'masked'
			// when 'calculated'
			case 'file':
				const fileObjectResult = mustBeObject(value);
				if (fileObjectResult.success === false) {
					return fileObjectResult;
				}

				const unauthorizedKeys = ['key', 'name', 'size', 'created', 'etag', 'headers', 'kind', 'last_modified', 'description', 'label', 'wildcard'];
				return successReturn(removeUnauthorizedKeys(value, unauthorizedKeys));

			default:
				logger.error(`Field ${fieldName} of type ${field.type} can not be validated`);

				return errorReturn(`Field ${fieldName} of type ${field.type} can not be validated`);
		}
	};

	if (field.isList !== true) {
		return validate(value);
	}

	if (value == null) {
		return errorReturn(`Value for field ${fieldName} must be array`);
	}

	const arrayResult = await Bluebird.map([].concat(value), validate, { concurrency: 10 });

	if (arrayResult.some(v => v.success === false)) {
		return arrayResult.find(v => v.success === false);
	}

	return successReturn(arrayResult.map(v => v.data));
}
