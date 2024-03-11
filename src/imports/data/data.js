import BluebirdPromise from 'bluebird';

import fetch from 'isomorphic-fetch';

import { DateTime } from 'luxon';

import compact from 'lodash/compact';
import concat from 'lodash/concat';
import extend from 'lodash/extend';
import _find from 'lodash/find';
import first from 'lodash/first';
import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import _isNaN from 'lodash/isNaN';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import map from 'lodash/map';
import merge from 'lodash/merge';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import set from 'lodash/set';
import size from 'lodash/size';
import tail from 'lodash/tail';
import unset from 'lodash/unset';
import words from 'lodash/words';

import { MetaObject } from '@imports/model/MetaObject';
import { getAccessFor, getFieldConditions, getFieldPermissions, removeUnauthorizedDataForRead } from '../utils/accessUtils';
import { logger } from '../utils/logger';
import { clearProjectionPathCollision, filterConditionToFn, parseFilterObject } from './filterUtils';
import { parseSortArray } from './sortUtils';

import { getUserSafe } from '@imports/auth/getUser';
import { applyIfMongoVersionGreaterThanOrEqual } from '@imports/database/versioning';
import processIncomingChange from '@imports/konsistent/processIncomingChange';
import objectsDiff from "@imports/utils/objectsDiff";
import { DEFAULT_PAGE_SIZE } from '../consts';
import { dateToString, stringToDate } from '../data/dateParser';
import { populateLookupsData } from '../data/populateLookupsData';
import { processCollectionLogin } from '../data/processCollectionLogin';
import { processValidationScript, runScriptAfterSave, runScriptBeforeValidation } from '../data/scripts';
import { getNextUserFromQueue as getNext } from '../meta/getNextUserFromQueue';
import { validateAndProcessValueFor } from '../meta/validateAndProcessValueFor';
import { renderTemplate } from '../template';
import { convertStringOfFieldsSeparatedByCommaIntoObjectToFind } from '../utils/convertStringOfFieldsSeparatedByCommaIntoObjectToFind';
import { randomId } from '../utils/random';
import { errorReturn, successReturn } from '../utils/return';

const WRITE_TIMEOUT = 3e4; // 30 seconds

export async function getNextUserFromQueue({ authTokenId, document, queueId, contextUser }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);
	if (access === false) {
		return errorReturn(`[${document}] You don't have permission`);
	}

	return getNext(queueId, user);
}

/**
 * Get a list of records
 * @param {Object} payload
 * 
 * @param {string} [payload.authTokenId]
 * @param {string} payload.document
 * @param {string | Object} payload.filter
 * 
 * @param {string} [payload.displayName]
 * @param {string} [payload.displayType]
 * @param {string} [payload.fields]
 * @param {string} [payload.sort]
 * @param {number} [payload.limit=50]
 * @param {number} [payload.start=0]
 * @param {boolean} [payload.getTotal=false]
 * @param {'true'} [payload.withDetailFields]
 * @param {import('../model/User').User} [payload.contextUser]
 * @param {boolean} [payload.transformDatesToString=true]
 * @param {import('@opentelemetry/api').Span} [payload.tracingSpan]
 * 
 * @returns {Promise<import('../types/result').KonectyResult<object[]>>} - Konecty result
 */

export async function find({ authTokenId, document, displayName, displayType, fields, filter, sort, limit, start, getTotal, withDetailFields, contextUser, transformDatesToString = true, tracingSpan }) {
	try {
		tracingSpan?.setAttribute('document', document);

		tracingSpan?.addEvent('Get User', { authTokenId, contextUser: contextUser?._id });
		const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
		if (success === false) {
			return errorReturn(errors);
		}

		const access = getAccessFor(document, user);

		if (access === false || access.isReadable !== true) {
			return errorReturn(`[${document}] You don't have permission read records`);
		}

		const collection = MetaObject.Collections[document];
		if (collection == null) {
			return errorReturn(`[${document}] Collection not found`);
		}

		const metaObject = MetaObject.Meta[document];
		if (metaObject == null) {
			return errorReturn(`[${document}] Document not found`);
		}

		const fieldsObject = convertStringOfFieldsSeparatedByCommaIntoObjectToFind(fields);

		if (has(fieldsObject, '$textScore')) {
			fieldsObject.$textScore = { $meta: 'textScore' };
		}

		const queryFilter = {
			match: 'and',
			filters: [],
		};

		// If filter is not given, apply meta default filters
		if (!isObject(filter) && displayName != null && displayType != null) {
			const displayMeta = MetaObject.DisplayMeta[`${document}:${displayType}:${displayName}`];
			if (has(displayMeta, 'filter')) {
				queryFilter.filters.push(displayMeta.filter);
			}
		}

		if (isObject(access.readFilter)) {
			queryFilter.filters.push(access.readFilter);
		}

		if (isObject(filter)) {
			queryFilter.filters.push(filter);
		}

		// Parse filters
		tracingSpan?.addEvent('Parsing filter');
		const readFilter = parseFilterObject(queryFilter, metaObject, { user });

		const query = isObject(readFilter) && Object.keys(readFilter).length > 0 ? readFilter : {};

		if (isObject(filter) && isString(filter.textSearch)) {
			query.$text = { $search: filter.textSearch };
		}

		const emptyFields = Object.keys(fieldsObject).length === 0;

		/**
		 * @type {import('mongodb').FindOptions}
		 */
		const queryOptions = {
			limit: parseInt(limit, 10),
			skip: parseInt(start ?? 0, 10),
			...applyIfMongoVersionGreaterThanOrEqual(6, () => ({ allowDiskUse: true })),
		};

		if (_isNaN(queryOptions.limit) || queryOptions.limit == null) {
			queryOptions.limit = DEFAULT_PAGE_SIZE;
		}

		if (sort != null) {
			const sortArray = isString(sort) ? JSON.parse(sort) : sort;

			const sortResult = parseSortArray(sortArray);
			if (sortResult.success === false) {
				return sortResult;
			}
			queryOptions.sort = Object.keys(sortResult.data).reduce((acc, key) => {
				if (get(metaObject, `fields.${key}.type`) === 'money') {
					acc[`${key}.value`] = sortResult.data[key];
				}

				if (get(metaObject, `fields.${key}.type`) === 'personName') {
					acc[`${key}.full`] = sortResult.data[key];
				}

				if (key === '$textScore') {
					if (fields.$textScore) {
						acc.$textScore = { $meta: 'textScore' };
					}
				}

				acc[key] = sortResult.data[key];
				return acc;
			}, {});
		}

		if (queryOptions.limit > 1000) {
			queryOptions.sort = { _id: 1 };
		}

		tracingSpan?.addEvent('Calculating field permissions');
		const accessConditionsResult = Object.keys(metaObject.fields).map(fieldName => {
			const accessField = getFieldPermissions(access, fieldName);
			if (accessField.isReadable === true) {
				const accessFieldConditions = getFieldConditions(access, fieldName);
				if (accessFieldConditions.READ != null) {
					const condition = filterConditionToFn(accessFieldConditions.READ, metaObject, { user });
					if (condition.success === false) {
						return condition;
					}
					if ((emptyFields === true && fieldsObject[fieldName] === 0) || (emptyFields !== true && fieldsObject[fieldName] === 1)) {
						Object.keys(condition.data).forEach(conditionField => {
							if (emptyFields === true) {
								delete fieldsObject[conditionField];
							} else {
								fieldsObject[conditionField] = 1;
							}
						});
					}
					return successReturn({
						fieldName,
						condition: condition.data,
					});
				}
			} else {
				if (emptyFields === true) {
					fieldsObject[fieldName] = 0;
				} else {
					delete fieldsObject[fieldName];
				}
			}
			return successReturn();
		});

		queryOptions.projection = clearProjectionPathCollision(fieldsObject);

		if (accessConditionsResult.some(result => result.success === false)) {
			return accessConditionsResult.find(result => result.success === false);
		}

		tracingSpan?.addEvent('Applying permissions to projection');
		const accessConditions = accessConditionsResult.reduce((acc, result) => {
			if (result.data == null) {
				return acc;
			}
			acc[result.data.fieldName] = result.data.condition;

			// Add the fields with conditions to the query, so we can compare later
			const fieldUsedInCondition = getFieldConditions(access, result.data.fieldName).READ?.term?.split('.')?.[0];
			if (fieldUsedInCondition != null) {
				if (emptyFields) {
					delete queryOptions.projection[fieldUsedInCondition];
				} else {
					queryOptions.projection[fieldUsedInCondition] = 1;
				}
			}

			return acc;
		}, {});

		const startTime = process.hrtime();

		tracingSpan?.addEvent('Executing find query', { query, queryOptions });
		const records = await collection.find(query, queryOptions).toArray();

		const totalTime = process.hrtime(startTime);
		const log = `${totalTime[0]}s ${totalTime[1] / 1000000}ms => Find ${document}, filter: ${JSON.stringify(query)}, options: ${JSON.stringify(queryOptions)}`.brightCyan;
		logger.trace(log);

		const resultData = records.map(record =>
			Object.keys(record).reduce((acc, key) => {
				if (accessConditions[key] != null) {
					if (accessConditions[key](record) === true) {
						acc[key] = record[key];
					}
				} else {
					acc[key] = record[key];
				}

				return acc;
			}, {}),
		);

		const result = {
			success: true,
			data: resultData,
		};

		if (getTotal === true) {
			tracingSpan?.addEvent('Calculating total');
			result.total = await collection.countDocuments(query);
		}

		if (withDetailFields === 'true') {
			tracingSpan?.addEvent('Populating detail fields');
			result.data = await BluebirdPromise.mapSeries(result.data, async record => {
				const populatedRecord = await populateDetailFieldsInRecord({ record, document, authTokenId });
				return populatedRecord;
			});
		}

		if (transformDatesToString) {
			result.data = result.data.map(dateToString);
		}

		return result;
	} catch (error) {
		tracingSpan?.setAttribute("error", error.message);
		logger.error(error, `Error executing query: ${error.message}`);

		return {
			success: false,
			errors: [
				{
					message: 'Oops something went wrong, please try again later... if this message persisits, please contact our support',
				},
			],
			data: [],
		};
	}
}

/* Get a record by id
	@param authTokenId
	@param document
	@param fields
	@param dataId
*/
export async function findById({ authTokenId, document, fields, dataId, withDetailFields }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);

	if (access === false || access.isReadable !== true) {
		return errorReturn(`[${document}] You don't have permission read records`);
	}

	const collection = MetaObject.Collections[document];
	if (collection == null) {
		return errorReturn(`[${document}] Collection not found`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Document not found`);
	}

	if (isString(dataId) === false) {
		return errorReturn(`[${document}] DataId must be string`);
	}

	const konectyFilter = {
		match: 'and',
		filters: [],
	};

	if (isObject(access.readFilter)) {
		konectyFilter.filters.push(access.readFilter);
	}

	const readFilter = parseFilterObject(konectyFilter, metaObject, { user });

	const query = isObject(readFilter) && Object.keys(readFilter).length > 0 ? readFilter : {};
	query._id = dataId;

	const fieldsObject = convertStringOfFieldsSeparatedByCommaIntoObjectToFind(fields) ?? {};

	// Validate if user have permission to view each field
	const emptyFields = Object.keys(fieldsObject).length === 0;

	const accessConditionsResult = Object.keys(metaObject.fields).map(fieldName => {
		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isReadable === true) {
			const accessFieldConditions = getFieldConditions(access, fieldName);
			if (accessFieldConditions.READ != null) {
				const condition = filterConditionToFn(accessFieldConditions.READ, metaObject, { user });
				if (condition.success === false) {
					return condition;
				}
				if ((emptyFields === true && fieldsObject[fieldName] === 0) || (emptyFields !== true && fieldsObject[fieldName] === 1)) {
					Object.keys(condition.data).forEach(conditionField => {
						if (emptyFields === true) {
							delete fieldsObject[conditionField];
						} else {
							fieldsObject[conditionField] = 1;
						}
					});
				}
				return successReturn({
					fieldName,
					condition: condition.data,
				});
			}
		} else {
			if (emptyFields === true) {
				fieldsObject[fieldName] = 0;
			} else {
				delete fieldsObject[fieldName];
			}
		}
		return successReturn();
	});

	const queryOptions = {
		projection: clearProjectionPathCollision(fieldsObject),
	};

	if (accessConditionsResult.some(result => result.success === false)) {
		return accessConditionsResult.find(result => result.success === false);
	}

	const accessConditions = accessConditionsResult.reduce((acc, result) => {
		if (result.data == null) {
			return acc;
		}
		acc[result.data.fieldName] = result.data.condition;

		// Add the fields with conditions to the query, so we can compare later
		const fieldUsedInCondition = getFieldConditions(access, result.data.fieldName).READ?.term?.split('.')?.[0];
		if (fieldUsedInCondition != null) {
			if (emptyFields) {
				delete queryOptions.projection[fieldUsedInCondition];
			} else {
				queryOptions.projection[fieldUsedInCondition] = 1;
			}
		}

		return acc;
	}, {});

	const startTime = process.hrtime();
	const record = await collection.findOne(query, queryOptions);

	const totalTime = process.hrtime(startTime);

	const log = `${totalTime[0]}s ${totalTime[1] / 1000000}ms => Find ${document}, filter: ${JSON.stringify(query)}, options: ${JSON.stringify(queryOptions)}`.brightCyan;
	logger.trace(log);

	if (record != null) {
		const resultData = Object.keys(record).reduce((acc, key) => {
			if (accessConditions[key] != null) {
				if (accessConditions[key](record) === true) {
					acc[key] = record[key];
				}
			} else {
				acc[key] = record[key];
			}

			return acc;
		}, {});

		if (withDetailFields === 'true') {
			const populatedData = await populateDetailFieldsInRecord({ record: resultData, document, authTokenId });
			return {
				success: true,
				data: [populatedData],
				total: 1,
			};
		}

		return {
			success: true,
			data: [dateToString(resultData)],
			total: 1,
		};
	}

	return { success: true, data: [], total: 0 };
}

/* Get a list of records from a lookup
	@param authTokenId
	@param document
	@param field
	@param search
	@param start
	@param limit
	@param useChangeUserFilter
*/

export async function findByLookup({ authTokenId, document, field, search, extraFilter, start, limit, useChangeUserFilter }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);
	if (access === false || access.isReadable !== true) {
		return errorReturn(`[${document}] You don't have permission read records`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Document not found`);
	}

	const fieldObject = metaObject.fields[field];
	if (fieldObject == null) {
		return errorReturn(`[${document}] Field not found`);
	}

	if (fieldObject.type !== 'lookup') {
		return errorReturn(`[${document}] Field is not a lookup`);
	}

	const lookupMetaObject = MetaObject.Meta[fieldObject.document];
	if (lookupMetaObject == null) {
		return errorReturn(`[${document}] Lookup document not found`);
	}

	const lookupCollection = MetaObject.Collections[fieldObject.document];
	if (lookupCollection == null) {
		return errorReturn(`[${document}] Lookup collection not found`);
	}

	const projection = {
		_updatedAt: 1,
	};

	const lookupSort = {};
	const descriptionFieldsQuery = {};
	if (isArray(fieldObject.descriptionFields)) {
		const descriptionFields = fieldObject.descriptionFields.concat(fieldObject.searchableFields ?? []);

		let sortArrayField = false;

		const conditions = [];

		descriptionFields.forEach(descriptionField => {
			const lookupField = lookupMetaObject.fields[descriptionField.split('.')[0]];

			if (lookupField != null) {
				if (lookupField.type === 'picklist' || lookupField.isList === true) {
					if (sortArrayField === false) {
						lookupSort[descriptionField] = 1;
						sortArrayField = true;
					}
				} else {
					lookupSort[descriptionField] = 1;
				}

				projection[descriptionField] = 1;

				if (isString(search) && search.length > 0) {
					const condition = {};

					const searchAsInt = String(parseInt(search)) === search;

					if (['number', 'autoNumber', 'money'].includes(lookupField.type)) {
						const floatValue = parseFloat(search);
						if (floatValue && !isNaN(floatValue)) {
							condition[descriptionField] = floatValue;
						}
					} else if (lookupField.type === 'address' && descriptionField === lookupField.name) {
						for (let addressField of ['country', 'state', 'city', 'place', 'number', 'postalCode', 'district', 'placeType', 'complement']) {
							const c = {};
							c[`${descriptionField}.${addressField}`] = {
								$regex: search,
								$options: 'i',
							};
							conditions.push(c);
						}
					} else {
						if (searchAsInt === false) {
							if (['date', 'dateTime'].includes(lookupField.type)) {
								condition[descriptionField] = new Date(search);
							} else if (lookupField.type !== 'boolean') {
								condition[descriptionField] = {
									$regex: search,
									$options: 'i',
								};
							}
						}
					}

					if (Object.keys(condition).length > 0) {
						conditions.push(condition);
					}
				}
			} else {
				logger.error(`Inconsistent metadata, field [${lookupField}] does not exists in [${field.document}]`);
			}
		});

		if (conditions.length > 0) {
			descriptionFieldsQuery.$or = conditions;
		}
	}

	if (isArray(field.inheritedFields)) {
		Object.assign(
			projection,
			field.inheritedFields.reduce((acc, inheritedField) => {
				acc[inheritedField.fieldName] = 1;
				return acc;
			}, {}),
		);
	}

	// if field have access
	if (field.access) {
		// set base for access if doesn't exists
		if (user.access == null) {
			user.access = {};
		}

		// If no access for field document, set empty array
		if (user.access[field.document] == null) {
			user.access[field.document] = [];
			// Else, if value isn't array, convert to array
		} else if (!isArray(user.access[field.document])) {
			user.access[field.document] = [user.access[field.document]];
		}

		// And finally add field access as first access value
		user.access[field.document].unshift(field.access);
	}

	// Find access for lookup list data
	const fielddAccess = getAccessFor(field.document, user);

	if (fielddAccess === false || fielddAccess.isReadable !== true) {
		return errorReturn(`[${field.document}] You don't have permission read records`);
	}

	// Define init filter
	const filter = {
		match: 'and',
		filters: [],
	};

	if (useChangeUserFilter === true && isObject(fielddAccess.changeUserFilter)) {
		filter.filters.push(fielddAccess.changeUserFilter);
	} else if (isObject(fielddAccess.readFilter)) {
		filter.filters.push(fielddAccess.readFilter);
	}

	if (isObject(extraFilter) && !isArray(extraFilter)) {
		filter.filters.push(extraFilter);
	}

	// Parse filters
	const readFilter = parseFilterObject(filter, lookupMetaObject, { user });

	// If there are filter then add to query
	const generatedQuery = () => {
		if (isObject(readFilter) && Object.keys(readFilter).length > 0) {
			if (Object.keys(descriptionFieldsQuery).length === 0) {
				return Object.assign({}, descriptionFieldsQuery, readFilter);
			} else {
				return { $and: [descriptionFieldsQuery, readFilter] };
			}
		}
		return descriptionFieldsQuery;
	};

	const query = generatedQuery() ?? {};

	// Validate if user have permission to view each field
	const allowedFields = Object.keys(projection).reduce((acc, fieldName) => {
		const accessField = getFieldPermissions(fielddAccess, fieldName);
		if (accessField.isReadable === true) {
			acc[fieldName] = 1;
		}
		return acc;
	}, {});

	const options = {
		limit: parseInt(limit, 10),
		skip: start != null ? parseInt(start, 10) : 0,
		fields: clearProjectionPathCollision(allowedFields),
		sort: lookupSort,
	};

	if (_isNaN(options.limit) || !options.limit) {
		options.limit = 100;
	}

	const data = await lookupCollection.find(query, options).toArray();
	const total = await lookupCollection.countDocuments(query);

	return {
		success: true,
		data: map(data, dateToString),
		total,
	};
}

/* Receive a record and populate with detail fields
	@param authTokenId
	@param document
	@param record
*/
export async function populateDetailFieldsInRecord({ record, document, authTokenId }) {
	if (record == null) {
		return;
	}

	const getDetailFieldsValue = async function (field, value) {
		if (!has(value, '_id')) {
			logger.error({ field, document }, 'populateDetailFields: value without _id');
		}

		const record = await findById({
			authTokenId,
			document: field.document,
			fields: field.detailFields.join(','),
			dataId: value._id,
		});

		if (record.success && record.data != null && record.data.length > 0) {
			return { ...value, ...record.data[0] };
		}

		return value;
	};

	const metaObject = MetaObject.Meta[document];

	const result = await BluebirdPromise.reduce(
		Object.keys(record),
		async (acc, fieldName) => {
			const value = record[fieldName];
			const field = metaObject.fields[fieldName];
			if (value && field && field.type === 'lookup' && size(field.detailFields) > 0) {
				if (field.isList === true) {
					const values = isArray(value) ? value : [value];
					const detailValues = await BluebirdPromise.mapSeries(values, async item => {
						const detailValue = await getDetailFieldsValue(field, item);
						return detailValue;
					});
					acc[fieldName] = detailValues;
				} else {
					const detailValue = await getDetailFieldsValue(field, value);
					acc[fieldName] = detailValue;
				}
			} else {
				acc[fieldName] = value;
			}
			return acc;
		},
		{},
	);

	return result;
}

/**
 * @param {Object} payload
 * @param {string} payload.authTokenId
 * @param {string} payload.document
 * @param {Object} payload.data
 * @param {import('../model/User').User} [payload.contextUser]
 * @param {boolean} [payload.upsert]
 * @param {boolean} [payload.updateOnUpsert]
 * @param {boolean} [payload.ignoreAutoNumber]
 * @param {import('@opentelemetry/api').Span} [payload.tracingSpan]
 * @returns {Promise<import('../types/result').KonectyResult<object>>} - Konecty result
 */
export async function create({ authTokenId, document, data, contextUser, upsert, updateOnUpsert, ignoreAutoNumber = false, tracingSpan }) {
	tracingSpan?.setAttribute({ document, upsert, updateOnUpsert, ignoreAutoNumber });

	tracingSpan.addEvent('Get User', { authTokenId, contextUser: contextUser?._id });
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);
	if (access === false || access.isCreatable !== true) {
		return errorReturn(`[${document}] You don't have permission to create records`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Document not found`);
	}

	const collection = MetaObject.Collections[document];
	if (collection == null) {
		return errorReturn(`[${document}] Collection not found`);
	}

	if (isObject(data) === false) {
		return errorReturn(`[${document}] Data must be object`);
	}

	if (Object.keys(data).length === 0) {
		return errorReturn(`[${document}] Data must have at least one field`);
	}

	tracingSpan?.addEvent("Calculating create permissions");
	const fieldPermissionResult = Object.keys(data).map(fieldName => {
		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isCreatable !== true) {
			return errorReturn(`[${document}] You don't have permission to create field ${fieldName}`);
		}

		const accessFieldConditions = getFieldConditions(access, fieldName);
		if (accessFieldConditions.CREATE != null) {
			const getConditionFilterResult = filterConditionToFn(accessFieldConditions.CREATE, metaObject, { user });

			if (getConditionFilterResult.success === false) {
				return getConditionFilterResult;
			}

			const isAllowToCreateField = getConditionFilterResult.data(data);

			if (isAllowToCreateField === false) {
				return errorReturn(`[${document}] You don't have permission to create field ${fieldName}`);
			}
		}

		return successReturn();
	});

	if (fieldPermissionResult.some(result => result.success === false)) {
		return errorReturn(
			fieldPermissionResult
				.filter(result => result.success === false)
				.map(result => result.errors)
				.flat(),
		);
	}

	if (data._user != null) {
		if (isArray(data._user) === false) {
			return errorReturn(`[${document}] _user must be array`);
		}
		if (data._user.some(newUser => newUser._id !== user._id) === true && access.changeUser !== true) {
			unset(data, '_user');
		}
	}

	tracingSpan?.addEvent("Processing login");
	const processLoginResult = await processCollectionLogin({ meta: metaObject, data });
	if (processLoginResult.success === false) {
		return processLoginResult;
	}

	const cleanedData = Object.keys(data).reduce((acc, key) => {
		if (data[key] == null || data[key] === '') {
			return acc;
		}
		acc[key] = data[key];
		return acc;
	}, {});

	if (cleanedData._user == null) {
		cleanedData._user = { _id: user._id };

		if (metaObject.name !== 'QueueUser' && isString(data?.queue?._id)) {
			tracingSpan?.addEvent("Deriving _user from passed queue", { queueId: data.queue._id });

			const userQueueResult = await getNextUserFromQueue({ document, queueId: data.queue._id, contextUser: user });
			if (userQueueResult.success == false) {
				return userQueueResult;
			}
			cleanedData._user = { _id: userQueueResult.data.user };
		}

		if (metaObject.fields._user?.isList === true) {
			cleanedData._user = [cleanedData._user];
		}
	}

	tracingSpan.addEvent("Validating _user");
	const validateUserResult = await validateAndProcessValueFor({
		meta: metaObject,
		fieldName: '_user',
		value: cleanedData._user,
		actionType: 'insert',
		objectOriginalValues: data,
		objectNewValues: cleanedData,
	});

	if (validateUserResult.success === false) {
		return validateUserResult;
	}

	if (validateUserResult.data != null) {
		cleanedData._user = validateUserResult.data;
	}

	const emailsToSend = [];

	tracingSpan.addEvent("Validate&ProcessValueFor lookups");
	const validationResults = await BluebirdPromise.mapSeries(
		Object.keys(metaObject.fields).filter(k => metaObject.fields[k]?.type === 'lookup'),
		async key => {
			const fieldToValidate = metaObject.fields[key];

			const value = data[fieldToValidate.name];
			const result = await validateAndProcessValueFor({
				meta: metaObject,
				fieldName: key,
				value,
				actionType: 'insert',
				objectOriginalValues: data,
				objectNewValues: cleanedData,
			});
			if (result.success === false) {
				return result;
			}
			if (result.data != null) {
				cleanedData[key] = result.data;
			}

			return successReturn();
		},
	);

	if (validationResults.some(result => result.success === false)) {
		return errorReturn(
			validationResults
				.filter(result => result.success === false)
				.map(result => result.errors)
				.flat(),
		);
	}

	if (metaObject.scriptBeforeValidation != null) {
		tracingSpan.addEvent("Running scriptBeforeValidation");
		const scriptResult = await runScriptBeforeValidation({
			script: metaObject.scriptBeforeValidation,
			data: cleanedData,
			user,
			meta: metaObject,
			extraData: { original: {}, request: data, validated: cleanedData },
		});

		if (scriptResult.success === false) {
			return scriptResult;
		}

		if (scriptResult.data?.result != null && isObject(scriptResult.data.result)) {
			Object.assign(cleanedData, scriptResult.data.result);
		}

		if (scriptResult.data?.emailsToSend != null && isArray(scriptResult.data.emailsToSend)) {
			emailsToSend.push(...scriptResult.data.emailsToSend);
		}
	}

	// Pega os valores padrão dos campos que não foram informados
	Object.entries(metaObject.fields).forEach(([key, field]) => {
		if (field.type !== 'autoNumber' && cleanedData[key] == null) {
			if (field.defaultValue != null || (field.defaultValues != null && field.defaultValues.length > 0)) {
				const getDefaultValue = () => {
					if (field.defaultValue != null) {
						return field.defaultValue;
					}

					if (field.defaultValues != null && field.defaultValues.length > 0) {
						// Work around to fix picklist behavior
						if (field.type === 'picklist') {
							const value = get(field, 'defaultValues.0.pt_BR');
							if (value == null) {
								const lang = first(Object.keys(first(field.defaultValues)));
								return get(first(field.defaultValues), lang);
							}
							return value;
						} else {
							return field.defaultValues;
						}
					}
				};

				cleanedData[key] = getDefaultValue();
			}
		}
	});

	tracingSpan?.addEvent("Validate&processValueFor all fields");
	const validateAllFieldsResult = await BluebirdPromise.mapSeries(Object.keys(metaObject.fields), async (key) => {
		const value = cleanedData[key];
		const result = await validateAndProcessValueFor({
			meta: metaObject,
			fieldName: key,
			value,
			actionType: 'insert',
			objectOriginalValues: data,
			objectNewValues: cleanedData,
		});
		if (result.success === false) {
			return result;
		}
		if (result.data != null) {
			cleanedData[key] = result.data;
		}
		return successReturn();
	});

	if (validateAllFieldsResult.some(result => result.success === false)) {
		return errorReturn(
			validateAllFieldsResult
				.filter(result => result.success === false)
				.map(result => result.errors)
				.flat(),
		);
	}

	if (metaObject.validationScript != null) {
		tracingSpan?.addEvent("Running validation script");

		const validation = await processValidationScript({ script: metaObject.validationScript, data, fullData: extend({}, data, cleanedData), user });
		if (validation.success === false) {
			logger.error(validation, `Create - Script Validation Error - ${validation.reason}`);
			return errorReturn(`[${document}] ${validation.reason}`);
		}
	}

	tracingSpan?.addEvent("Processing autoNumber");
	const autoNumberResult = await BluebirdPromise.mapSeries(Object.keys(metaObject.fields), async key => {
		const field = metaObject.fields[key];
		if (field.type === 'autoNumber') {
			const value = get(data, key);

			if (ignoreAutoNumber !== true || value == null) {
				const autoNumberResult = await validateAndProcessValueFor({
					meta: metaObject,
					fieldName: key,
					value,
					actionType: 'insert',
					objectOriginalValues: data,
					objectNewValues: cleanedData,
				});

				if (autoNumberResult.success === false) {
					return autoNumberResult;
				}
				if (autoNumberResult.data != null) {
					cleanedData[key] = autoNumberResult.data;
				}
			} else {
				cleanedData[key] = value;
			}
		}
		return successReturn();
	});

	if (autoNumberResult.some(result => result.success === false)) {
		return errorReturn(
			autoNumberResult
				.filter(result => result.success === false)
				.map(result => result.errors)
				.flat(),
		);
	}

	if (Object.keys(cleanedData).length > 0) {
		const insertedQuery = {};

		const now = DateTime.local().toJSDate();

		const newRecord = Object.assign({}, cleanedData, {
			_id: get(data, '_id', randomId()),
			_createdAt: get(data, '_createdAt', now),
			_createdBy: get(data, '_createdBy', pick(user, ['_id', 'name', 'group'])),
			_updatedAt: get(data, '_updatedAt', now),
			_updatedBy: get(data, '_updatedBy', pick(user, ['_id', 'name', 'group'])),
		});

		try {
			if (processLoginResult.data != null) {
				await MetaObject.Collections['User'].insertOne({
					_id: newRecord._id,
					...processLoginResult.data,
				});

				const loginFieldResult = await validateAndProcessValueFor({
					meta: metaObject,
					fieldName: get(metaObject, 'login.field', 'login'),
					value: processLoginResult.data,
					actionType: 'insert',
					objectOriginalValues: data,
					objectNewValues: cleanedData,
				});

				if (loginFieldResult.success === false) {
					return loginFieldResult;
				}

				set(newRecord, get(metaObject, 'login.field', 'login'), loginFieldResult.data);
			}
			if (upsert != null && isObject(upsert)) {
				const updateOperation = {
					$setOnInsert: {},
					$set: {},
				};
				if (updateOnUpsert != null && isObject(updateOnUpsert)) {
					Object.keys(newRecord).forEach(key => {
						if (updateOnUpsert[key] != null) {
							set(updateOperation, `$set.${key}`, newRecord[key]);
						} else {
							set(updateOperation, `$setOnInsert.${key}`, newRecord[key]);
						}
					});
				} else {
					set(updateOperation, '$setOnInsert', newRecord);
				}

				if (isEmpty(updateOperation.$set)) {
					unset(updateOperation, '$set');
				}

				if (isEmpty(updateOperation.$setOnInsert)) {
					unset(updateOperation, '$setOnInsert');
				}

				tracingSpan?.addEvent("Upserting record");
				const upsertResult = await collection.updateOne(stringToDate(upsert), stringToDate(updateOperation), {
					upsert: true,
					writeConcern: { w: 'majority', wtimeoutMS: WRITE_TIMEOUT },
				});
				if (upsertResult.upsertedId != null) {
					set(insertedQuery, '_id', upsertResult.upsertedId);
					tracingSpan?.addEvent("Record upserted", { upsertedId: upsertResult.upsertedId });
				} else if (upsertResult.modifiedCount > 0) {
					const upsertedRecord = await collection.findOne(stringToDate(upsert));
					if (upsertedRecord != null) {
						set(insertedQuery, '_id', upsertedRecord._id);
						tracingSpan?.addEvent("Record updated", { upsertedId: upsertedRecord._id });
					}
				}
			} else {
				const insertResult = await collection.insertOne(stringToDate(newRecord));
				set(insertedQuery, '_id', insertResult.insertedId);
				tracingSpan?.addEvent("Record inserted", { insertedId: insertResult.insertedId });
			}
		} catch (e) {
			logger.error(e, `Error on insert ${MetaObject.Namespace.ns}.${document}: ${e.message}`);
			tracingSpan?.addEvent("Error on insert", { error: e.message });
			tracingSpan?.setAttribute({ error: e.message });

			if (e.code === 11000) {
				return errorReturn(`[${document}] Duplicate key error`);
			}
			return errorReturn(`[${document}] ${e.message}`);
		}

		if (insertedQuery._id == null) {
			tracingSpan?.setAttribute({ error: "InsertedQuery id is null" });
			return errorReturn(`[${document}] Error on insert, there is no affected record`);
		}

		const affectedRecord = await collection.findOne(insertedQuery, { readConcern: { level: 'majority' } });

		if (isEmpty(MetaObject.Namespace.onCreate) === false) {
			const hookData = {
				action: 'create',
				ns: MetaObject.Namespace.ns,
				documentName: document,
				user: pick(user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale']),
				data: [affectedRecord], // Find records before apply access filter to query
			};

			const urls = [].concat(MetaObject.Namespace.onCreate);
			tracingSpan?.addEvent("Running onCreate hooks", { urls });

			await BluebirdPromise.mapSeries(urls, async url => {
				try {
					const hookUrl = url.replace('${dataId}', insertedQuery._id).replace('${documentId}', `${MetaObject.Namespace.ns}:${document}`);
					const hookResponse = await fetch(hookUrl, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(hookData),
					});
					if (hookResponse.status === 200) {
						logger.info(`Hook ${hookUrl} executed successfully`);
					} else {
						logger.error(`Error on hook ${url}: ${hookResponse.statusText}`);
					}
				} catch (e) {
					logger.error(e, `Error on hook ${url}: ${e.message}`);
				}
			});
		}

		if (isObject(access.readFilter)) {
			const readFilter = parseFilterObject(access.readFilter, metaObject, { user });
			merge(insertedQuery, readFilter);
		}

		const resultRecord = await collection.findOne(insertedQuery, { readConcern: { level: 'majority' } });

		if (metaObject.scriptAfterSave != null) {
			tracingSpan?.addEvent("Running scriptAfterSave");
			await runScriptAfterSave({ script: metaObject.scriptAfterSave, data: [resultRecord], user });
		}

		if (emailsToSend.length > 0) {
			const messagesCollection = MetaObject.Collections['Message'];
			const now = DateTime.local().toJSDate();
			await messagesCollection.insertMany(
				emailsToSend.map(email =>
					Object.assign(
						{},
						{
							_id: randomId(),
							_createdAt: now,
							_createdBy: pick(user, ['_id', 'name', 'group']),
							_updatedAt: now,
							_updatedBy: { ...pick(user, ['_id', 'name', 'group']), ts: now },
						},
						email,
					),
				),
			);
		}

		if (resultRecord != null) {
			if (MetaObject.Namespace.plan?.useExternalKonsistent !== true) {
				try {
					tracingSpan?.addEvent("Processing sync Konsistent");
					await processIncomingChange(document, resultRecord, 'create', user, resultRecord);
				} catch (e) {
					tracingSpan?.addEvent("Error on Konsistent", { error: e.message });
					logger.error(e, `Error on processIncomingChange ${document}: ${e.message}`);
				}
			}
			return successReturn([dateToString(resultRecord)]);
		}
	}

	return errorReturn(`[${document}] Error on insert, there is no affected record`);
}

/**
 * @param {Object} payload
 * @param {string} payload.authTokenId
 * @param {string} payload.document
 * @param {Object} payload.data
 * @param {import('../model/User').User} [payload.contextUser]
 * @param {import('@opentelemetry/api').Span} [payload.tracingSpan]
 * @returns {Promise<import('../types/result').KonectyResult<object>>} - Konecty result
 */
export async function update({ authTokenId, document, data, contextUser, tracingSpan }) {
	tracingSpan?.setAttribute({ document });

	tracingSpan?.addEvent('Get User', { authTokenId, contextUser: contextUser?._id });
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);
	if (access === false || access.isUpdatable !== true) {
		return errorReturn(`[${document}] You don't have permission to update records`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Document not found`);
	}

	const collection = MetaObject.Collections[document];
	if (collection == null) {
		return errorReturn(`[${document}] Collection not found`);
	}

	if (isObject(data) === false) {
		return errorReturn(`[${document}] Invalid payload`);
	}

	if (data.ids == null || data.ids.length === 0) {
		return errorReturn(`[${document}] Payload must contain an array of ids with at least one item`);
	}

	if (data.data == null || Object.keys(data.data).length === 0) {
		return errorReturn(`[${document}] Data must have at least one field`);
	}

	const validateIdsResult = data.ids.map(id => {
		if (isObject(id) === false) {
			return false;
		}
		if (isString(id._id) === false) {
			return false;
		}
		if (metaObject.ignoreUpdatedAt !== true) {
			if (isObject(id._updatedAt) === false) {
				return false;
			}
			if (isString(id._updatedAt.$date) === false) {
				return false;
			}
		}
		return true;
	});

	if (validateIdsResult.some(result => result === false)) {
		return errorReturn(`[${document}] Each id must contain an string field named _id an date field named _updatedAt`);
	}

	tracingSpan?.addEvent("Calculating update permissions");
	const fieldPermissionResult = Object.keys(data.data).map(fieldName => {
		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isUpdatable !== true) {
			return errorReturn(`[${document}] You don't have permission to update field ${fieldName}`);
		}
		return successReturn();
	});

	if (fieldPermissionResult.some(result => result.success === false)) {
		return errorReturn(
			fieldPermissionResult
				.filter(result => result.success === false)
				.map(result => result.errors)
				.flat(),
		);
	}

	if (data._user != null) {
		if (isArray(data._user) === false) {
			return errorReturn(`[${document}] _user must be array`);
		}
		if (data._user.some(newUser => newUser._id !== user._id) === true && access.changeUser !== true) {
			unset(data, '_user');
		}
	}

	tracingSpan?.addEvent("Processing login");
	const processLoginResult = await processCollectionLogin({ meta: metaObject, data });
	if (processLoginResult.success === false) {
		return processLoginResult;
	}

	const fieldFilterConditions = Object.keys(data.data).reduce((acc, fieldName) => {
		const accessFieldConditions = getFieldConditions(access, fieldName);
		if (accessFieldConditions.UPDATE) {
			acc.push(accessFieldConditions.UPDATE);
		}
		return acc;
	}, []);

	const filter = {
		match: 'and',
		filters: [],
	};

	if (isObject(access.updateFilter)) {
		filter.filters.push(access.updateFilter);
	}

	if (fieldFilterConditions.length > 0) {
		set(filter, 'conditions', fieldFilterConditions);
	}

	tracingSpan?.addEvent("Parsing filter");
	const updateFilterResult = parseFilterObject(filter, metaObject, { user });

	const query = Object.assign({ _id: { $in: [] } }, updateFilterResult);

	if (isArray(query._id.$in)) {
		data.ids.forEach(id => {
			query._id.$in.push(id._id);
		});
	}

	const options = {};

	if (metaObject.scriptBeforeValidation == null && metaObject.validationScript == null && metaObject.scriptAfterSave == null) {
		set(options, 'fields', {
			_updatedAt: 1,
		});
	}

	tracingSpan?.addEvent("Finding records to update", { query, options });
	const existsRecords = await collection.find(query, options).toArray();

	// Validate if user have permission to update each record that he are trying
	const forbiddenRecords = data.ids.filter(id => {
		const record = existsRecords.find(record => record._id === id._id);
		if (record == null) {
			return true;
		}
		return false;
	});

	if (forbiddenRecords.length > 0) {
		return errorReturn(`[${document}] You don't have permission to update records ${forbiddenRecords.map(record => record._id).join(', ')} or they don't exists`);
	}

	// outdateRecords are records that user are trying to update but they are out of date
	if (metaObject.ignoreUpdatedAt !== true) {
		const outdateRecords = data.ids.filter(id => {
			const record = existsRecords.find(record => record._id === id._id);
			if (record == null) {
				return true;
			}
			if (DateTime.fromJSDate(record._updatedAt).diff(DateTime.fromISO(id._updatedAt.$date)).milliseconds !== 0) {
				return true;
			}
			return false;
		});

		if (outdateRecords.length > 0) {
			const mapOfFieldsToUpdateForHistoryQuery = Object.keys(data.data).reduce((acc, fieldName) => {
				acc.push({ [`diffs.${fieldName}`]: { $exists: 1 } });
				return acc;
			}, []);
			const outOfDateQuery = {
				$or: outdateRecords.map(record => ({
					dataId: record._id,
					createdAt: {
						$gt: DateTime.fromISO(record._updatedAt.$date).toJSDate(),
					},
					$or: mapOfFieldsToUpdateForHistoryQuery,
				})),
			};

			const historyCollection = MetaObject.Collections[`${document}.History`];

			tracingSpan?.addEvent("Finding out of date records", { outOfDateQuery });
			const outOfDateRecords = await historyCollection.find(outOfDateQuery).toArray();

			if (outOfDateRecords.length > 0) {
				const errorMessage = outOfDateRecords.reduce((acc, record) => {
					Object.keys(data.data).forEach(fieldName => {
						if (record.diffs[fieldName] != null) {
							acc.push(
								`[${document}] Record ${record.dataId} is out of date, field ${fieldName} was updated at ${DateTime.fromJSDate(record.createdAt).toISO()} by ${record.createdBy.name
								}`,
							);
						}
					});
					return acc;
				}, []);

				if (errorMessage.length > 0) {
					return errorReturn(errorMessage.join('\n'));
				}
			}
		}
	}

	const emailsToSend = [];

	const updateResults = await BluebirdPromise.mapSeries(existsRecords, async record => {
		const bodyData = {};

		if (metaObject.scriptBeforeValidation != null) {
			tracingSpan?.addEvent("Validate&ProcessValueFor lookups");

			const lookupValues = {};
			const validateLookupsResults = await BluebirdPromise.mapSeries(
				Object.keys(data.data).filter(key => metaObject.fields[key]?.type === 'lookup'),
				async key => {
					const lookupValidateResult = validateAndProcessValueFor({
						meta: metaObject,
						fieldName: key,
						value: data.data[key],
						actionType: 'update',
						objectOriginalValues: record,
						objectNewValues: data.data,
						idsToUpdate: query._id.$in,
					});
					if (lookupValidateResult.success === false) {
						return lookupValidateResult;
					}
					if (lookupValidateResult.data != null) {
						set(lookupValues, key, lookupValidateResult.data);
					}
					return successReturn();
				},
			);

			if (validateLookupsResults.some(result => result.success === false)) {
				return errorReturn(
					validateLookupsResults
						.filter(result => result.success === false)
						.map(result => result.errors)
						.flat(),
				);
			}

			tracingSpan?.addEvent("Running scriptBeforeValidation");
			const extraData = {
				original: first(existsRecords),
				request: data.data,
				validated: lookupValues,
			};
			const scriptResult = await runScriptBeforeValidation({
				script: metaObject.scriptBeforeValidation,
				data: extend({}, first(existsRecords), data.data, lookupValues),
				user,
				meta: metaObject,
				extraData,
			});

			if (scriptResult.success === false) {
				return scriptResult;
			}

			if (scriptResult.data?.result != null && isObject(scriptResult.data.result)) {
				Object.assign(bodyData, scriptResult.data.result);
			}
			if (scriptResult.data?.emailsToSend != null && isArray(scriptResult.data.emailsToSend)) {
				emailsToSend.push(...scriptResult.data.emailsToSend);
			}
		}

		tracingSpan?.addEvent("Validate&ProcessValueFor all fields");
		const validateResult = await BluebirdPromise.mapSeries(Object.keys(data.data), async fieldName => {
			if (bodyData[fieldName] == null) {
				const result = await validateAndProcessValueFor({
					meta: metaObject,
					fieldName,
					value: data.data[fieldName],
					actionType: 'update',
					objectOriginalValues: record,
					objectNewValues: data.data,
					idsToUpdate: query._id.$in,
				});
				if (result.success === false) {
					return result;
				}
				if (result.data !== undefined) {
					set(bodyData, fieldName, result.data);
				}
			}
			return successReturn();
		});

		if (validateResult.some(result => result.success === false)) {
			return errorReturn(
				validateResult
					.filter(result => result.success === false)
					.map(result => result.errors)
					.flat(),
			);
		}

		if (metaObject.validationScript != null) {
			tracingSpan?.addEvent("Running validation script");
			const validationScriptResult = await processValidationScript({ script: metaObject.validationScript, data: bodyData, fullData: extend({}, record, data.data), user });
			if (validationScriptResult.success === false) {
				logger.error(validationScriptResult, `Update - Script Validation Error - ${validationScriptResult.reason}`);
				return errorReturn(validationScriptResult.reason);
			}
		}

		const updateOperation = Object.keys(bodyData).reduce((acc, key) => {
			if (bodyData[key] !== undefined) {
				if (bodyData[key] === null) {
					set(acc, `$unset.${key}`, 1);
				} else {
					set(acc, `$set.${key}`, bodyData[key]);
				}
			}
			return acc;
		}, {});

		const ignoreUpdate = Object.keys(bodyData).every(key => metaObject.fields[key].ignoreHistory === true);

		if (ignoreUpdate === false) {
			set(updateOperation, '$set._updatedAt', DateTime.local().toJSDate());
			set(
				updateOperation,
				'$set._updatedBy',
				Object.assign({}, pick(user, ['_id', 'name', 'group']), {
					ts: get(updateOperation, '$set._updatedAt'),
				}),
			);
		}

		const filter = {
			_id: record._id,
		};

		try {
			tracingSpan?.addEvent("Updating record", { filter, updateOperation });
			await collection.updateOne(filter, updateOperation, { writeConcern: { w: 'majority', wtimeoutMS: WRITE_TIMEOUT } });
			return successReturn(record._id);
		} catch (e) {
			logger.error(e, `Error on update ${MetaObject.Namespace.ns}.${document}: ${e.message}`);
			tracingSpan?.addEvent("Error on update", { error: e.message });
			tracingSpan?.setAttribute({ error: e.message });

			if (e.code === 11000) {
				return errorReturn(`[${document}] Duplicate key error`);
			}
			return errorReturn(`[${document}] ${e.message}`);
		}
	});

	if (updateResults.some(result => result.success === false)) {
		return errorReturn(
			updateResults
				.filter(result => result.success === false)
				.map(result => result.errors)
				.flat(),
		);
	}

	const updatedIs = updateResults.map(result => result.data);

	if (updatedIs.length > 0) {
		if (MetaObject.Namespace.onUpdate != null) {
			const hookRecords = await collection.find({ _id: { $in: updatedIs } }).toArray();

			const hookData = {
				action: 'update',
				ns: MetaObject.Namespace.ns,
				documentName: document,
				user: pick(user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale']),
				data: hookRecords,
			};

			const urls = [].concat(MetaObject.Namespace.onUpdate);
			tracingSpan?.addEvent("Running onUpdate hooks", { urls });

			await BluebirdPromise.mapSeries(urls, async url => {
				try {
					const hookUrl = url.replace('${dataId}', updatedIs.join(',')).replace('${documentId}', `${MetaObject.Namespace.ns}:${document}`);
					const hookResponse = await fetch(hookUrl, {
						method: 'POST',
						body: JSON.stringify(hookData),
					});
					if (hookResponse.status === 200) {
						logger.info(`Hook ${hookUrl} executed successfully`);
					} else {
						logger.error(`Error on hook ${url}: ${hookResponse.statusText}`);
					}
				} catch (e) {
					logger.error(e, `Error on hook ${url}: ${e.message}`);
				}
			});
		}

		const updatedQuery = {
			_id: {
				$in: updatedIs,
			},
		};

		if (isObject(access.readFilter)) {
			const readFilter = parseFilterObject(access.readFilter, metaObject, { user });

			merge(updatedQuery, readFilter);
		}

		const updatedRecords = await collection.find(updatedQuery).toArray();

		if (metaObject.scriptAfterSave != null) {
			tracingSpan?.addEvent("Running scriptAfterSave");
			await runScriptAfterSave({ script: metaObject.scriptAfterSave, data: updatedRecords, user, extraData: { original: existsRecords } });
		}

		if (MetaObject.Namespace.plan?.useExternalKonsistent !== true) {
			try {
				logger.debug("Processing Konsistent");
				tracingSpan?.addEvent("Processing sync Konsistent");
				for await (const record of updatedRecords) {
					const original = existsRecords.find(r => r._id === record._id);
					const newRecord = omit(record, ['_id', '_createdAt', '_createdBy', '_updatedAt', '_updatedBy']);

					const changedProps = objectsDiff(original, newRecord);
					await processIncomingChange(document, record, 'update', user, changedProps);
				}
			} catch (e) {
				logger.error(e, `Error on processIncomingChange ${document}: ${e.message}`);
				tracingSpan?.addEvent("Error on Konsistent", { error: e.message });
			}
		}

		const responseData = updatedRecords.map(record => removeUnauthorizedDataForRead(access, record)).map(record => dateToString(record));

		if (emailsToSend.length > 0) {
			tracingSpan?.addEvent("Sending emails");

			const messagesCollection = MetaObject.Collections['Message'];
			const now = DateTime.local().toJSDate();
			await messagesCollection.insertMany(
				emailsToSend.map(email =>
					Object.assign(
						{},
						{
							_id: randomId(),
							_createdAt: now,
							_createdBy: pick(user, ['_id', 'name', 'group']),
							_updatedAt: now,
							_updatedBy: { ...pick(user, ['_id', 'name', 'group']), ts: now },
						},
						email,
					),
				),
			);
		}

		return successReturn(responseData);
	}

	return errorReturn(`[${document}] Error on update, there is no affected record`);
}

/* Delete records
	@param authTokenId
	@param document
	@param data
*/

export async function deleteData({ authTokenId, document, data, contextUser }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);
	if (access === false || access.isDeletable !== true) {
		return errorReturn(`[${document}] You don't have permission to delete records`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Document not found`);
	}

	const collection = MetaObject.Collections[document];
	if (collection == null) {
		return errorReturn(`[${document}] Collection not found`);
	}

	const trashCollection = MetaObject.Collections[`${document}.Trash`];
	if (trashCollection == null) {
		return errorReturn(`[${document}] Trash collection not found`);
	}

	if (isObject(data) === false) {
		return errorReturn(`[${document}] Invalid payload`);
	}

	if (isArray(data?.ids) === false || data.ids.length === 0) {
		return errorReturn(`[${document}] Payload must contain an array of ids with at least one item`);
	}

	const validateIdsResult = data.ids.map(id => {
		if (id?._id == null || isString(id._id) === false) {
			return false;
		}
		if (metaObject.ignoreUpdatedAt !== true) {
			if (id?._updatedAt == null || isObject(id._updatedAt) === false || isString(id._updatedAt.$date) === false) {
				return false;
			}
		}
		return true;
	});

	if (validateIdsResult.some(result => result === false)) {
		return errorReturn(`[${document}] Each id must contain an string field named _id an date field named _updatedAt`);
	}

	const recordsToDeleteFilter = {};

	if (isObject(access.deleteFilter)) {
		const deleteFilter = parseFilterObject(access.deleteFilter, metaObject, { user });
		extend(recordsToDeleteFilter, deleteFilter);
	}

	set(
		recordsToDeleteFilter,
		'_id.$in',
		concat(
			get(recordsToDeleteFilter, '_id.$in', []),
			data.ids.map(id => id._id),
		),
	);

	const recordsToDelete = await collection.find(recordsToDeleteFilter).toArray();

	const notFoundRecords = data.ids.filter(id => recordsToDelete.some(record => record._id === id._id) === false);

	if (notFoundRecords.length > 0) {
		return errorReturn(`[${document}] You don't have permission to delete records ${notFoundRecords.map(record => record._id).join(', ')} or they don't exists`);
	}

	if (metaObject.ignoreUpdatedAt !== true) {
		const outdateRecords = data.ids.filter(id => {
			const record = recordsToDelete.find(record => record._id === id._id);
			if (record == null) {
				return true;
			}
			if (DateTime.fromJSDate(record._updatedAt).diff(DateTime.fromISO(id._updatedAt.$date)).milliseconds !== 0) {
				return true;
			}
			return false;
		});

		if (outdateRecords.length > 0) {
			return errorReturn(`[${document}] There are new version for records: ${outdateRecords.map(record => record._id).join(', ')}`);
		}
	}

	const idsToDelete = recordsToDelete.map(record => record._id);
	const references = MetaObject.References[document];

	if (references?.from != null && isObject(references.from)) {
		const referencesResult = await BluebirdPromise.mapSeries(Object.keys(references.from), async referenceName => {
			const referenceMeta = references.from[referenceName];
			const referenceCollection = MetaObject.Collections[referenceName];
			if (referenceCollection == null) {
				return errorReturn(`[${document}] Reference collection ${referenceMeta.document} not found`);
			}

			const foreignFoundIds = await BluebirdPromise.mapSeries(idsToDelete, async deletedId => {
				const referenceConditions = Object.keys(referenceMeta).map(fieldName => ({
					[`${fieldName}._id`]: { $in: [deletedId] },
				}));

				if (referenceConditions.length === 0) {
					return;
				}

				const referenceQuery = {
					$or: referenceConditions,
				};

				const foreignCount = await referenceCollection.countDocuments(referenceQuery);

				if (foreignCount > 0) {
					return deletedId;
				}
			});

			if (foreignFoundIds.some(id => id != null)) {
				return errorReturn(
					`[${document}] Cannot delete records ${foreignFoundIds.filter(id => id != null).join(', ')} because they are referenced by ${referenceMeta.document}`,
				);
			}

			return successReturn();
		});

		if (referencesResult.some(result => result.success === false)) {
			return errorReturn(
				referencesResult
					.filter(result => result.success === false)
					.map(result => result.errors)
					.flat(),
			);
		}
	}

	try {
		await trashCollection.insertMany(
			recordsToDelete.map(record =>
				Object.assign({}, record, {
					_deletedAt: DateTime.local().toJSDate(),
					_deletedBy: pick(user, ['_id', 'name', 'group']),
				}),
			),
		);

		await collection.deleteMany({ _id: { $in: idsToDelete } });
	} catch (e) {
		logger.error(e, `Error on delete ${MetaObject.Namespace.ns}.${document}: ${e.message}`);
		return errorReturn(`[${document}] Error on delete ${MetaObject.Namespace.ns}.${document}: ${e.message}`);
	}

	if (MetaObject.Namespace.onDelete != null) {
		const hookData = {
			action: 'delete',
			ns: MetaObject.Namespace.ns,
			documentName: document,
			user: pick(user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale']),
			data: recordsToDelete,
		};

		const urls = [].concat(MetaObject.Namespace.onDelete);

		await BluebirdPromise.mapSeries(urls, async url => {
			try {
				const hookUrl = url.replace('${dataId}', idsToDelete.join(',')).replace('${documentId}', `${MetaObject.Namespace.ns}:${document}`);
				const hookResponse = await fetch(hookUrl, {
					method: 'POST',
					body: JSON.stringify(hookData),
				});

				if (hookResponse.status === 200) {
					logger.info(`Hook ${hookUrl} executed successfully`);
				} else {
					logger.error(`Error on hook ${url}: ${hookResponse.statusText}`);
				}
			} catch (e) {
				logger.error(e, `Error on hook ${url}: ${e.message}`);
			}
		});
	}

	return successReturn(idsToDelete);
}

/* Create relation
	@param authTokenId
	@param document
	@param fieldName
	@param data
*/
export async function relationCreate({ authTokenId, document, fieldName, data, preview = false, contextUser }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);
	if (access === false || access.isDeletable !== true) {
		return errorReturn(`[${document}] You don't have permission to delete records`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Document not found`);
	}

	const collection = MetaObject.Collections[document];
	if (collection == null) {
		return errorReturn(`[${document}] Collection not found`);
	}

	const field = metaObject.fields[fieldName];
	if (field == null) {
		return errorReturn(`[${document}] Field ${fieldName} not found`);
	}

	if (field.type !== 'filter') {
		return errorReturn(`[${document}] Field ${fieldName} must be of type filter`);
	}

	if (field.relations == null || field.relations.length === 0) {
		return errorReturn(`[${document}] Field ${fieldName} must have at least one relation`);
	}

	if (isObject(data) === false) {
		return errorReturn(`[${document}] Invalid payload`);
	}

	if (data.lookups == null || isArray(data.lookups) === false || data.lookups.length === 0) {
		return errorReturn(`[${document}] Payload must contain an array of lookups with at least one item`);
	}

	const emailRelation = field.relations.find(relation => relation.email === true);

	const relation = emailRelation ?? first(field.relations);

	const sendEmail = get(data, 'email', false) === true;
	const emailData = {};

	const reverseLookupCollection = MetaObject.Collections[MetaObject.Meta[relation.document].fields[relation.reverseLookup].document];

	const relationsIds = data.lookups.reduce(
		(acc, lookup) =>
			concat(
				acc,
				data.reverseLookups.map(reverseLookup => ({
					lookup,
					reverseLookup,
				})),
			),
		[],
	);

	const createResults = await BluebirdPromise.mapSeries(relationsIds, async ({ lookup, reverseLookup }) => {
		const getLookupId = async () => {
			if (relation.lookupField != null) {
				const lookupData = await MetaObject.Collections[field.document].findOne(lookup);
				return get(lookupData, relation.lookupField);
			}
			return lookup;
		};
		const lookupId = await getLookupId();

		const relationData = Object.assign({}, data.data, { [relation.lookup]: { _id: lookupId } }, { [relation.reverseLookup]: { _id: reverseLookup } });

		if (sendEmail === true) {
			if (emailData[MetaObject.Meta[relation.document].fields[relation.reverseLookup].document] == null) {
				emailData[MetaObject.Meta[relation.document].fields[relation.reverseLookup].document] = [];
			}
			if (reverseLookupCollection && _find(emailData[MetaObject.Meta[relation.document].fields[relation.reverseLookup].document], { _id: reverseLookup }) == null) {
				const reverseLookupData = await reverseLookupCollection.findOne({ _id: reverseLookup });
				const populatedData = await populateLookupsData({
					documentName: MetaObject.Meta[relation.document].fields[relation.reverseLookup].document,
					data: reverseLookupData,
					fields: {
						_user: 1,
						contact: 1,
					},
				});
				emailData[MetaObject.Meta[relation.document].fields[relation.reverseLookup].document].push(populatedData);
			}
		}

		const upsert = {
			$and: [
				{
					[`${relation.lookup}._id`]: lookupId,
				},
				{ [`${relation.reverseLookup}._id`]: reverseLookup },
			],
		};

		if (sendEmail === true && preview === true) {
			if (emailData[relation.document] == null) {
				emailData[relation.document] = [];
			}
			const populatedData = await populateLookupsData({
				documentName: relation.document,
				data: Object.assign({}, relationData, { _id: randomId() }),
				fields: {
					[relation.lookup]: 1,
				},
			});
			emailData[relation.document].push(populatedData);
			return successReturn();
		} else {
			const insertResult = await create({
				contextUser: user,
				document: relation.document,
				data: relationData,
				upsert,
			});
			if (insertResult.success === false) {
				return insertResult;
			}

			if (sendEmail === true && insertResult.data?.length > 0) {
				if (emailData[relation.document] == null) {
					emailData[relation.document] = [];
				}

				const populatedData = BluebirdPromise.mapSeries(insertResult.data, async resultData => {
					const populatedData = await populateLookupsData({
						documentName: relation.document,
						data: resultData,
						fields: {
							[relation.lookup]: 1,
						},
					});
					return populatedData;
				});
				emailData[relation.document].push(...populatedData);
			}

			return insertResult;
		}
	});

	if (createResults.some(result => result.success === false)) {
		return errorReturn(
			createResults
				.filter(result => result.success === false)
				.map(result => result.errors)
				.flat(),
		);
	}

	const resultData = createResults
		.map(result => result.data)
		.filter(r => r)
		.flat();

	if (sendEmail === true && size(get(emailData, relation.document)) > 0) {
		if (relation.emailConf?.extraData != null) {
			await BluebirdPromise.mapSeries(Object.entries(relation.emailConf.extraData), async ([fieldEmail, findEmailData]) => {
				const dataResult = await find({
					contextUser: user,
					...findEmailData,
				});

				if (dataResult.success === true) {
					set(emailData, fieldEmail, dataResult.data);
				} else {
					logger.error(dataResult, `Error on find data for email ${fieldEmail}`);
				}
			});
		}

		set(emailData, 'request', data.data);

		const pathsWithIds = paths => Array.from(new Set(['_id'].concat(paths.map(path => path.split('.')[0]))));

		const messageMeta = MetaObject.Meta['Message'];

		const createdByUser = pick(user, pathsWithIds(messageMeta.fields._createdBy?.descriptionFields ?? ['_id', 'name', 'group', 'active']));
		const updatedByUser = pick(user, pathsWithIds(messageMeta.fields._updatedBy?.descriptionFields ?? ['_id', 'name', 'group', 'active']));
		const userOwner = pick(user, pathsWithIds(messageMeta.fields._user?.descriptionFields ?? ['_id', 'name', 'group', 'active']));
		const now = DateTime.local().toJSDate();

		const messageData = {
			_id: randomId(),
			data: emailData,
			type: 'Email',
			status: 'Send',
			_createdAt: now,
			_createdBy: createdByUser,
			_updatedAt: now,
			_updatedBy: updatedByUser,
			_user: [userOwner],
		};

		if (relation.emailConf?.template != null) {
			set(messageData, 'template', relation.emailConf.template);
		}

		if (relation.emailConf?.server != null) {
			set(messageData, 'server', relation.emailConf.server);
		}

		if (messageMeta.fields?.contact?.descriptionFields != null && relation.contact != null) {
			const contactData = get(emailData, relation.emailConf.contact);

			if (contactData != null) {
				if (size(get(contactData, 'email')) > 0 && (messageData.to == null || isEmpty(messageData.to))) {
					set(messageData, 'to', get(contactData, 'email[0].address'));
				}
				const emailContactData = pick(contactData, pathsWithIds(messageMeta.fields.contact.descriptionFields));
				set(messageData, 'contact', emailContactData);
			}
		}

		if (messageMeta.fields?.opportunity?.descriptionFields != null && relation.emailConf?.opportunity != null) {
			const emailOpportunityData = pick(get(emailData, relation.emailConf.opportunity), pathsWithIds(messageMeta.fields.opportunity.descriptionFields));

			set(messageData, 'opportunity', emailOpportunityData);
		}

		if (preview === true) {
			return renderTemplate(messageData.template, extend({ message: messageData }, emailData));
		}

		const messageCollection = MetaObject.Collections['Message'];

		await messageCollection.insertOne(messageData);
	}

	return successReturn(resultData);
}

/* Save lead
	@param authTokenId
	@param data
	@param lead


KONDATA.call 'data:lead:save',
	lead:
		name: 'john doe'
		email: 'john.doe@konecty.com' (optional, but required if not phone)
		phone: '5130303030' ou [ '5130303030', '5133303030' ] (optional, but required if not email)
		broker: 'username' (optional)
		campaign: '_id' (optional)
		queue: '_id' (optional)
		extraFields: object (optional) -> other fields to be inserted, updated
	save: [
		document: 'Activity'
		data:
			subject: 'okokok'
	]

- Para salvar a lead eu recebo os seguintes dados:
	- Nome
	- Email
	- Telefone
	- Roleta
	- Campanha
	- Usuário responsável pelo contato (corretor)
- Com os dados informados, verifica se já existe um contato:
	- Primeiro busca um contato com o e-mail informado;
	- Se não achou com e-mail, busca um contato que possua o primeiro nome informado + telefone;
- Se achou um contato:
	- Atualiza o nome se o nome informado é maior que o existente;
	- Adiciona um possível novo e-mail;
	- Adiciona um possível novo telefone;
	- Atualiza a roleta;
	- Atualiza a campanha;
	- Se foi informado usuário responsável:
		- Adiciona o usuário informado como responsável do contato;
	- Se não informado usuário responsável:
		- Verifica se o contato possui uma oportunidade ativa:
			- Adiciona como responsável do contato o responsável ativo pela oportunidade atualizada mais recentemente.
		- Se não, se o contato possui uma atividade criada nos últimos 10 dias:
			- Adiciona como responsável do contato o responsável ativo pela atividade criada mais recentemente.
		- Se não, se foi informada uma roleta:
			- Adiciona como responsável do contato o próximo usuário da roleta informada.
		- Se não, verifica se a campanha informada possui uma roleta alvo:
			- Adiciona como responsável do contato o próximo usuário da roleta alvo da campanha.
*/

export async function saveLead({ authTokenId, lead, save, contextUser }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	if (lead == null) {
		return errorReturn('Invalid payload');
	}

	const phoneSent = [].concat(lead.phone).filter(phone => phone != null && phone !== '');

	if (lead.email == null && phoneSent.length === 0) {
		return errorReturn('Please fill out at least one of the following fields: email or phone number. It is mandatory.');
	}

	const getContact = async () => {
		if (lead.email != null) {
			const contact = await find({
				contextUser: user,
				document: 'Contact',
				filter: {
					conditions: [
						{
							term: 'email.address',
							operator: 'equals',
							value: lead.email,
						},
					],
				},
				limit: 1,
			});
			if (contact.success === true && contact.data.length > 0) {
				return contact.data[0];
			}
		}

		if (lead.name != null && phoneSent.length > 0) {
			const contact = await find({
				contextUser: user,
				document: 'Contact',
				filter: {
					conditions: [
						{
							term: 'phone.phoneNumber',
							operator: 'equals',
							value: phoneSent[0],
						},
						{
							term: 'name.full',
							operator: 'contains',
							value: first(words(lead.name)),
						},
					],
				},
				limit: 1,
			});
			if (contact.success === true && contact.data.length > 0) {
				return contact.data[0];
			}
		}
	};

	const contact = await getContact();

	const contactData = {};

	if (lead.name != null) {
		if (contact?.name?.full == null || lead.name.length > contact.name.full.length) {
			const nameParts = words(lead.name);
			set(contactData, 'name', {
				first: first(nameParts),
				last: tail(nameParts).join(' '),
			});
		}
	}

	if (lead.email != null) {
		if (size(get(contact, 'email')) > 0) {
			if (_find(compact(contact.email), { address: lead.email }) === false) {
				set(contactData, 'email', (contact.email ?? []).concat({ address: lead.email }));
			}
		} else {
			set(contactData, 'email', [{ address: lead.email }]);
		}
	}

	if (phoneSent.length > 0) {
		if (size(get(contact, 'phone.length')) > 0) {
			phoneSent.forEach(function (leadPhone) {
				if (_find(compact(contact.phone), { phoneNumber: leadPhone }) === false) {
					set(
						contactData,
						'phone',
						(contact.phone ?? []).concat({
							countryCode: '55',
							phoneNumber: leadPhone,
						}),
					);
				}
			});
		} else {
			set(
				contactData,
				'phone',
				phoneSent.map(phone => ({
					countryCode: '55',
					phoneNumber: phone,
				})),
			);
		}
	}

	if (lead.queue != null) {
		set(contactData, 'queue', { _id: lead.queue });
	}

	if (lead.campaign != null) {
		set(contactData, 'campaign', { _id: lead.campaign });
	}

	if (lead.extraFields != null) {
		extend(contactData, lead.extraFields);
	}

	let addedUser = false;

	if (lead.broker != null) {
		addedUser = true;

		const brokerResult = await find({
			contextUser: user,
			document: 'User',
			filter: {
				conditions: [
					{
						term: 'username',
						operator: 'equals',
						value: lead.broker,
					},
				],
			},
			fields: '_id',
			limit: 1,
		});

		if (brokerResult.success === true && brokerResult.data.length > 0) {
			if (contact?._user != null) {
				if (_find(compact(contact._user), { _id: brokerResult.data[0]._id }) == null) {
					set(contactData, '_user', (contact._user ?? []).concat(brokerResult.data[0]));
				}
			} else {
				set(contactData, '_user', [brokerResult.data[0]]);
			}
		}
	} else {
		if (contact != null) {
			if ((contact.activeOpportunities ?? 0) > 0) {
				const opportunitiesResult = await find({
					contextUser: user,
					document: 'Opportunity',
					filter: {
						conditions: [
							{
								term: 'contact._id',
								operator: 'equals',
								value: contact._id,
							},
							{
								term: 'status',
								operator: 'in',
								value: ['Nova', 'Ofertando Imóveis', 'Em Visitação', 'Proposta', 'Contrato', 'Pré-Reserva de Lançamentos'],
							},
							{
								term: '_user.active',
								operator: 'equals',
								value: true,
							},
						],
					},
					limit: 1,
					sort: [
						{
							property: '_updatedAt',
							direction: 'DESC',
						},
					],
					fields: '_id,_user',
				});

				if (opportunitiesResult.success === true && opportunitiesResult.data.length > 0) {
					addedUser = true;

					if (_find(compact(contact._user), { _id: opportunitiesResult.data[0]._user._id }) == null) {
						set(contactData, '_user', (contact._user ?? []).concat(opportunitiesResult.data[0]._user));
					}
				}

				// get recent activities from contact to find an _user
				if (addedUser === false) {
					const activitiesResult = await find({
						contextUser: user,
						document: 'Activity',
						filter: {
							conditions: [
								{
									term: 'contact._id',
									operator: 'equals',
									value: contact._id,
								},
								{
									term: '_createdAt',
									operator: 'greater_or_equals',
									value: DateTime.local().minus({ days: 10 }).toJSDate(),
								},
								{
									term: '_user.active',
									operator: 'equals',
									value: true,
								},
							],
						},
						limit: 1,
						sort: [
							{
								property: '_createdAt',
								direction: 'DESC',
							},
						],
						fields: '_id,_user',
					});

					if (activitiesResult.success === true && activitiesResult.data.length > 0) {
						if (_find(compact(contact._user), { _id: activitiesResult.data[0]._user._id }) == null) {
							set(contactData, '_user', (contact._user ?? []).concat(activitiesResult.data[0]._user));
						}
					}
				}

				if (addedUser === false && lead.queue != null) {
					if (isString(lead.queue) === true) {
						const userQueueResult = await getNextUserFromQueue({
							contextUser: user,
							queue: lead.queue,
						});

						if (userQueueResult.success === true && userQueueResult.data != null) {
							if (_find(compact(contact._user), { _id: userQueueResult.data._id }) == null) {
								set(contactData, '_user', (contact._user ?? []).concat(userQueueResult.data));
							}
						}
					}
				}

				if (addedUser === false && lead.campaign != null) {
					const campaignResult = await find({
						contextUser: user,
						document: 'Campaign',
						filter: {
							conditions: [
								{
									term: '_id',
									operator: 'equals',
									value: lead.campaign,
								},
							],
						},
						fields: '_id,targetQueue',
						limit: 1,
					});

					if (campaignResult.success === true && campaignResult.data.length > 0) {
						const targetQueue = campaignResult.data[0].targetQueue;
						if (targetQueue != null) {
							const userQueueResult = await getNextUserFromQueue({
								contextUser: user,
								queue: targetQueue,
							});

							if (userQueueResult.success === true && userQueueResult.data != null) {
								if (_find(compact(contact._user), { _id: userQueueResult.data._id }) == null) {
									set(contactData, '_user', (contact._user ?? []).concat(userQueueResult.data));
								}
							}
						}
					}
				}
			}
		}
	}

	if (contactData?._user == null && contact != null) {
		if (get(contact, '_user.0._id') == null) {
			set(contactData, '_user', [{ _id: user._id }]);
		} else if (contact.queue != null) {
			set(contactData, '_user', contact._user);
		}
	}

	const result = {};

	if (contact == null) {
		if (contactData.status == null) {
			set(contactData, 'status', 'Lead');
		}

		if (contactData.type == null) {
			set(contactData, 'type', 'Cliente');
		}

		const createResult = await create({
			contextUser: user,
			document: 'Contact',
			data: contactData,
		});

		if (createResult.success === false) {
			return createResult;
		}

		extend(result, createResult);
	} else if (isEmpty(contactData) === false) {
		const updateResult = await update({
			contextUser: user,
			document: 'Contact',
			data: {
				ids: [
					{
						_id: contact._id,
						_updatedAt: {
							$date: contact._updatedAt,
						},
					},
				],
				data: contactData,
			},
		});

		if (updateResult.success === false) {
			return updateResult;
		}

		extend(result, updateResult);
	} else {
		extend(result, { success: true, data: [contact] });
	}

	if (save != null && isArray(save) === true && size(save) > 0) {
		const contactUser = first(get(result, 'data.0._user'));
		const contactId = get(result, 'data.0._id');

		const saveRelations = async (relations, contactId, parentObj) =>
			BluebirdPromise.mapSeries(relations, async saveObj => {
				const createRequest = {
					contextUser: user,
					document: saveObj.document,
					data: saveObj.data,
				};

				if (MetaObject.Meta[saveObj]?.fields?.contact?.isList === true) {
					set(createRequest, 'data.contact', [{ _id: contactId }]);
				} else {
					set(createRequest, 'data.contact', { _id: contactId });
				}

				if (parentObj != null) {
					extend(createRequest.data, parentObj);
				}

				set(createRequest, 'data._user', contactUser);

				const saveResult = await create(createRequest);

				if (saveResult.success === true) {
					set(result, 'data', concat(get(result, 'data', []), saveResult.data));

					if (saveObj.relations != null) {
						const relationMap = {
							[saveObj.name]: { _id: saveResult.data[0]._id },
						};
						await saveRelations(saveObj.relations, contactId, relationMap);
					}
				} else {
					logger.error(saveResult, `Error on save relation ${saveObj.document}: ${saveResult.errors}`);
					set(result, 'errors', concat(get(result, 'errors', []), saveResult.errors));
				}
			});

		await saveRelations(save, contactId);
	}

	return result;
}

export async function historyFind({ authTokenId, document, dataId, fields, contextUser }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);
	if (success === false) {
		return errorReturn(errors);
	}

	const access = getAccessFor(document, user);
	if (access === false || access.isReadable !== true) {
		return errorReturn(`[${document}] You don't have permission to read records`);
	}

	const metaObject = MetaObject.Meta[document];
	if (metaObject == null) {
		return errorReturn(`[${document}] Document not found`);
	}

	const historyCollection = MetaObject.Collections[`${document}.History`];
	if (historyCollection == null) {
		return errorReturn(`[${document}] Collection not found`);
	}

	const fieldsObject = convertStringOfFieldsSeparatedByCommaIntoObjectToFind(fields) ?? {};

	const unreadableFields = Object.keys(metaObject.fields).reduce((acc, fieldName) => {
		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isReadable !== true) {
			acc[fieldName] = 0;
		}
		return acc;
	}, {});

	Object.assign(fieldsObject, unreadableFields);

	const projection = Object.entries(fieldsObject).reduce((acc, [fieldName, value]) => {
		acc[`data.${fieldName}`] = value;
		acc[`diffs.${fieldName}`] = value;
		return acc;
	}, {});

	const options = {
		projection,
		sort: {
			createdAt: 1,
		},
	};

	const records = await historyCollection.find({ dataId }, options).toArray();

	const resultData = records.map(record => {
		if (record.diffs == null && record.data != null) {
			return {
				...omit(record, ['data']),
				diffs: Object.entries(record.data).reduce(
					(acc, [fieldName, value]) => Object.assign(acc, { [fieldName]: record.type === 'delete' ? { from: value } : { to: value } }),
					{},
				),
			};
		}
		return record;
	});

	return successReturn(resultData);
}
