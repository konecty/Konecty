/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const accessUtils = {};

accessUtils.getFieldConditions = function(metaAccess, fieldName) {
	const accessField = metaAccess.fields && metaAccess.fields[fieldName];

	const conditions = {};

	if (__guard__(accessField != null ? accessField.UPDATE : undefined, x => x.condition) != null) {
		conditions.UPDATE = accessField.UPDATE.condition;
	}

	if (__guard__(accessField != null ? accessField.CREATE : undefined, x1 => x1.condition) != null) {
		conditions.CREATE = accessField.CREATE.condition;
	}

	if (__guard__(accessField != null ? accessField.READ : undefined, x2 => x2.condition) != null) {
		conditions.READ = accessField.READ.condition;
	}

	return conditions;
};

accessUtils.getFieldPermissions = function(metaAccess, fieldName) {
	const accessField = metaAccess.fields && metaAccess.fields[fieldName];

	const access = {
		isUpdatable: true,
		isCreatable: true,
		isDeletable: true,
		isReadable: true
	};

	if (__guard__(accessField != null ? accessField.UPDATE : undefined, x => x.allow) != null) {
		access.isUpdatable = accessField.UPDATE.allow === true;
	} else {
		access.isUpdatable = metaAccess.fieldDefaults.isUpdatable === true;
	}

	if (__guard__(accessField != null ? accessField.CREATE : undefined, x1 => x1.allow) != null) {
		access.isCreatable = accessField.CREATE.allow === true;
	} else {
		access.isCreatable = metaAccess.fieldDefaults.isCreatable === true;
	}

	if (__guard__(accessField != null ? accessField.READ : undefined, x2 => x2.allow) != null) {
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

accessUtils.getAccessFor = function(documentName, user) {
	// If user has no access defined set access as defaults: 'Default'
	if ((user.access == null) || (user.access === null)) {
		user.access =
			{defaults: 'Default'};
	}

	// If user has no default access set as 'Default'
	if ((user.access.defaults == null) || (user.access.defaults === null)) {
		user.access.defaults = 'Default';
	}

	// If user has not access for Document Name set as defaults
	if ((user.access[documentName] == null) || (user.access[documentName] === null)) {
		user.access[documentName] = user.access.defaults;
	}

	let accessName = user.access[documentName];

	// Return false to Deny if access is false
	if (accessName === false) {
		return false;
	}

	// If accessName is String or Array try to use it
	if (_.isArray(accessName) || _.isString(accessName)) {
		let access;
		accessName = [].concat(accessName);

		// Try to get named access of module
		for (var name of Array.from(accessName)) {
			access = global.Access[`${documentName}:access:${name}`];
			if (access != null) {
				return access;
			}
		}

		// Try to get named access of Default
		for (name of Array.from(accessName)) {
			access = global.Access[`Default:access:${name}`];
			if (access != null) {
				return access;
			}
		}

		// Return false to Deny
		return false;
	}

	// Return false if no access was found
	return false;
};

accessUtils.removeUnauthorizedDataForRead = function(metaAccess, data) {
	if (!_.isObject(data)) {
		return data;
	}

	for (let fieldName in data) {
		const value = data[fieldName];
		const access = accessUtils.getFieldPermissions(metaAccess, fieldName);
		if (access.isReadable !== true) {
			delete data[fieldName];
		}
	}

	return data;
};
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}