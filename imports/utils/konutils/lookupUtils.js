import { metaUtils } from '/imports/utils/konutils/metaUtils';
import { utils } from '/imports/utils/konutils/utils';

import isArray from 'lodash/isArray';

export const lookupUtils = {
	copyDescriptionAndInheritedFields(lookupField, lookupValue, lookupRecord, meta, actionType, model, objectOriginalValues, objectNewValues, idsToUpdate) {
		// Remove all values from object to prevent unwanted values
		for (let key in lookupValue) {
			if (key !== '_id') {
				delete lookupValue[key];
			}
		}

		lookupValue._id = lookupRecord._id;

		if (isArray(lookupField.descriptionFields)) {
			utils.copyObjectFieldsByPathsIncludingIds(lookupRecord, lookupValue, lookupField.descriptionFields);
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

					validation = metaUtils.validateAndProcessValueFor(
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
						validation = metaUtils.validateAndProcessValueFor(
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
	},
	removeInheritedFields(lookupField, objectNewValues) {
		if (isArray(lookupField.inheritedFields)) {
			for (let inheritedField of lookupField.inheritedFields) {
				if (['always', 'hierarchy_always'].includes(inheritedField.inherit)) {
					objectNewValues[inheritedField.fieldName] = null;
				}
			}
		}
	},
};
