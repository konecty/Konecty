import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import has from 'lodash/has';

import { Access } from 'metadata';

import { parseFilterConditionToArrayFilter } from './filter';

const getFieldConditions = function (metaAccess, fieldName) {
	const accessField = metaAccess.fields && metaAccess.fields[fieldName];

	const conditions = {};

	if (has(accessField, 'UPDATE.condition')) {
		conditions.UPDATE = accessField.UPDATE.condition;
	}

	if (has(accessField, 'CREATE.condition')) {
		conditions.CREATE = accessField.CREATE.condition;
	}

	if (has(accessField, 'READ.condition')) {
		conditions.READ = accessField.READ.condition;
	}

	return conditions;
};

const getFieldPermissions = function (metaAccess, fieldName) {
	const accessField = metaAccess.fields && metaAccess.fields[fieldName];

	const access = {
		isUpdatable: true,
		isCreatable: true,
		isDeletable: true,
		isReadable: true,
	};

	if (has(accessField, 'UPDATE.allow')) {
		access.isUpdatable = accessField.UPDATE.allow === true;
	} else {
		access.isUpdatable = metaAccess.fieldDefaults.isUpdatable === true;
	}

	if (has(accessField, 'CREATE.allow')) {
		access.isCreatable = accessField.CREATE.allow === true;
	} else {
		access.isCreatable = metaAccess.fieldDefaults.isCreatable === true;
	}

	if (has(accessField, 'READ.allow')) {
		access.isReadable = accessField.READ.allow === true;
	} else {
		access.isReadable = metaAccess.fieldDefaults.isReadable === true;
	}

	access.isDeletable = metaAccess.fieldDefaults.isDeletable === true;

	if (metaAccess.isUpdatable !== true) {
		access.isUpdatable = false;
	}

	if (metaAccess.isCreatable !== true) {
		access.isCreatable = false;
	}

	if (metaAccess.isDeletable !== true) {
		access.isDeletable = false;
	}

	if (metaAccess.isReadable !== true) {
		access.isReadable = false;
	}

	return access;
};

const getAccessFor = function (documentName, user) {
	// If user has no access defined set access as defaults: 'Default'
	if (user.access == null) {
		user.access = { defaults: 'Default' };
	}

	// If user has no default access set as 'Default'
	if (user.access.defaults == null) {
		user.access.defaults = 'Default';
	}

	// If user has not access for Document Name set as defaults
	if (user.access[documentName] == null) {
		user.access[documentName] = user.access.defaults;
	}

	let accessName = user.access[documentName];

	// Return false to Deny if access is false
	if (accessName === false) {
		return false;
	}

	// If accessName is String or Array try to use it
	if (isArray(accessName) || isString(accessName)) {
		let access;
		accessName = [].concat(accessName);

		// Try to get named access of module
		for (const name of accessName) {
			access = Access[`${documentName}:access:${name}`];
			if (access) {
				return access;
			}
		}

		// Try to get named access of Default
		for (const name of accessName) {
			access = Access[`Default:access:${name}`];
			if (access) {
				return access;
			}
		}

		// Return false to Deny
		return false;
	}

	// Return false if no access was found
	return false;
};

const removeUnauthorizedDataForRead = function (metaAccess, data) {
	if (!isObject(data)) {
		return data;
	}

	for (let fieldName in data) {
		const value = data[fieldName];
		const access = getFieldPermissions(metaAccess, fieldName);
		if (access.isReadable !== true) {
			delete data[fieldName];
		}
	}

	return data;
};

const applyReadConditions = (data, metaObject, access, context) => {
	const accessConditions = [];

	for (const fieldName in metaObject.fields) {
		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isReadable === true) {
			const accessFieldConditions = getFieldConditions(access, fieldName);
			if (accessFieldConditions.READ) {
				const conditionFn = parseFilterConditionToArrayFilter(accessFieldConditions.READ, metaObject, context, true);
				if (conditionFn instanceof Error) {
					if (typeof context?.notifyError === 'function') {
						context.notifyError('FindOne - Access Filter Error', conditionFn, {
							accessFilter: accessFieldConditions.READ,
						});
					}
					return conditionFn;
				}

				accessConditions.push({
					fieldName,
					conditionFn,
				});
			}
		}
	}

	return data.map(doc => {
		const resultDoc = Object.assign({}, doc);
		for (const { fieldName, conditionFn } of accessConditions) {
			if (conditionFn(resultDoc) === false) {
				delete resultDoc[fieldName];
			}
		}
		return resultDoc;
	});
};

const ensureReadConditionsFields = (fields, metaObject, access, emptyFields) => {
	const resultFields = Object.assign({}, fields);

	for (const fieldName in metaObject.fields) {
		const accessField = getFieldPermissions(access, fieldName);
		if (accessField.isReadable === true) {
			const accessFieldConditions = getFieldConditions(access, fieldName);
			if (accessFieldConditions.READ) {
				if ((emptyFields === true && !resultFields[fieldName]) || (emptyFields !== true && resultFields[fieldName] === 1)) {
					if (emptyFields === true) {
						delete resultFields[accessFieldConditions.READ.term];
					} else {
						resultFields[accessFieldConditions.READ.term] = 1;
					}
				}
			}
		}
	}

	return resultFields;
};

export { getFieldConditions, getFieldPermissions, getAccessFor, removeUnauthorizedDataForRead, ensureReadConditionsFields, applyReadConditions };
