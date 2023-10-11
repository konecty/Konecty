import isArray from 'lodash/isArray';

export function removeInheritedFields(lookupField) {
	if (isArray(lookupField.inheritedFields)) {
		return lookupField.inheritedFields.reduce((acc, inheritedField) => {
			if (['always', 'hierarchy_always'].includes(inheritedField.inherit)) {
				acc[inheritedField.fieldName] = null;
			}
			return acc;
		}, {});
	}
	return {};
}
