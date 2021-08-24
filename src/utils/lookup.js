import isArray from 'lodash/isArray';

import { copyObjectFieldsByPathsIncludingIds } from './index';
import validateAndProcessValueFor from './validateAndProcessValueFor';

const copyDescriptionAndInheritedFields = function (lookupField, lookupValue, lookupRecord, meta, actionType, model, objectOriginalValues, objectNewValues, idsToUpdate) {
	// Remove all values from object to prevent unwanted values
	for (let key in lookupValue) {
		if (key !== '_id') {
			delete lookupValue[key];
		}
	}

	lookupValue._id = lookupRecord._id;

	if (isArray(lookupField.descriptionFields)) {
		copyObjectFieldsByPathsIncludingIds(lookupRecord, lookupValue, lookupField.descriptionFields);
	}

	if (isArray(lookupField.inheritedFields)) {
		for (let inheritedField of lookupField.inheritedFields) {
			var validation;
			if (['always', 'hierarchy_always', 'once_readonly'].includes(inheritedField.inherit)) {
				if (inheritedField.inherit === 'hierarchy_always') {
					lookupRecord[inheritedField.fieldName] = [
						...(lookupRecord[inheritedField.fieldName] || []),
						{
							_id: lookupRecord._id,
						},
					];
				}

				validation = validateAndProcessValueFor(
					meta,
					inheritedField.fieldName,
					lookupRecord[inheritedField.fieldName],
					actionType,
					model,
					objectOriginalValues,
					objectNewValues,
					idsToUpdate,
				);
				if (validation === undefined) {
					validation = null;
				}
				if (validation instanceof Error) {
					return validation;
				}
				objectNewValues[inheritedField.fieldName] = validation;
			} else {
				//until_edited, once_editable

				if (!objectOriginalValues[inheritedField.fieldName]) {
					validation = validateAndProcessValueFor(
						meta,
						inheritedField.fieldName,
						lookupRecord[inheritedField.fieldName],
						actionType,
						model,
						objectOriginalValues,
						objectNewValues,
						idsToUpdate,
					);
					if (validation instanceof Error) {
						return validation;
					}
					objectNewValues[inheritedField.fieldName] = validation;
				}
			}
		}
	}
};

const removeInheritedFields = function (lookupField, objectNewValues) {
	if (isArray(lookupField.inheritedFields)) {
		for (let inheritedField of lookupField.inheritedFields) {
			if (['always', 'hierarchy_always'].includes(inheritedField.inherit)) {
				objectNewValues[inheritedField.fieldName] = null;
			}
		}
	}
};

export { copyDescriptionAndInheritedFields, removeInheritedFields };
