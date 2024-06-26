import isArray from 'lodash/isArray';

export function removeInheritedFields(lookupField, objectNewValues) {
	if (isArray(lookupField.inheritedFields)) {
		return lookupField.inheritedFields.reduce((acc, inheritedField) => {
			if (['always', 'hierarchy_always'].includes(inheritedField.inherit) && objectNewValues[inheritedField.fieldName] === undefined) {
				acc[inheritedField.fieldName] = null;
			}
			return acc;
		}, {});
	}
	return {};
}
