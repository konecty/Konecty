import isObject from 'lodash/isObject';

import { Filter } from '@imports/model/Filter';
import { MetaAccess } from '@imports/model/MetaAccess';
import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';

export function getFieldConditions(metaAccess: MetaAccess, fieldName: string) {
	const accessField = metaAccess.fields?.[fieldName];
	const conditions: Filter = {};

	if (accessField?.UPDATE?.condition != null) {
		conditions.UPDATE = accessField.UPDATE.condition;
	}

	if (accessField?.CREATE?.condition != null) {
		conditions.CREATE = accessField.CREATE.condition;
	}

	if (accessField?.READ?.condition != null) {
		conditions.READ = accessField.READ.condition;
	}

	return conditions;
}

export function getFieldPermissions(metaAccess: MetaAccess, fieldName: string) {
	const accessField = metaAccess.fields?.[fieldName];
	const access = {
		isUpdatable: true,
		isCreatable: true,
		isDeletable: true,
		isReadable: true,
	};

	if (accessField?.UPDATE?.allow != null) {
		access.isUpdatable = accessField.UPDATE.allow === true;
	} else {
		access.isUpdatable = metaAccess.fieldDefaults.isUpdatable === true;
	}

	if (accessField?.CREATE?.allow != null) {
		access.isCreatable = accessField.CREATE.allow === true;
	} else {
		access.isCreatable = metaAccess.fieldDefaults.isCreatable === true;
	}

	if (accessField?.READ?.allow != null) {
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
}

export function getAccessFor(documentName: string, user: User): MetaAccess | false {
	// If user has no access defined, set access as defaults: 'Default'
	if (!user.access) {
		user.access = { defaults: 'Default' };
	}

	// If user has no default access, set it as 'Default'
	if (user.access.defaults == null) {
		user.access.defaults = 'Default';
	}

	// If user has no access for Document Name, set it as defaults
	if (user.access[documentName] == null) {
		user.access[documentName] = user.access.defaults;
	}

	let accessName: false | string | Array<string> = user.access[documentName];

	// Return false to Deny if access is false
	if (accessName === false) {
		return false;
	}

	// If accessName is String or Array, try to use it
	if (Array.isArray(accessName) || typeof accessName === 'string') {
		let access;
		accessName = ([] as Array<string>).concat(accessName);

		// Try to get named access of module
		for (const name of accessName) {
			access = MetaObject.Access[`${documentName}:access:${name}`];
			if (access) {
				return access;
			}
		}

		// Try to get named access of Default
		for (const name of accessName) {
			access = MetaObject.Access[`Default:access:${name}`];
			if (access) {
				return access;
			}
		}

		// Return false to Deny
		return false;
	}

	// Return false if no access was found
	return false;
}

export function removeUnauthorizedDataForRead(metaAccess: MetaAccess, data: Record<string, unknown>) {
	if (!isObject(data)) {
		return data;
	}

	for (const fieldName in data) {
		const access = getFieldPermissions(metaAccess, fieldName);
		if (access.isReadable !== true) {
			delete data[fieldName];
		}
	}

	return data;
}
