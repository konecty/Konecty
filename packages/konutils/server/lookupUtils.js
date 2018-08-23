/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const lookupUtils = {};

lookupUtils.copyDescriptionAndInheritedFields = function(lookupField, lookupValue, lookupRecord, meta, actionType, model, objectOriginalValues, objectNewValues, idsToUpdate) {
	// Remove all values from object to prevent unwanted values
	for (let key in lookupValue) {
		if (key !== '_id') {
			delete lookupValue[key];
		}
	}

	lookupValue._id = lookupRecord._id;

	if (_.isArray(lookupField.descriptionFields)) {
		utils.copyObjectFieldsByPathsIncludingIds(lookupRecord, lookupValue, lookupField.descriptionFields);
	}

	if (_.isArray(lookupField.inheritedFields)) {
		for (let inheritedField of Array.from(lookupField.inheritedFields)) {
			var validation;
			if (['always', 'hierarchy_always', 'once_readonly'].includes(inheritedField.inherit)) {
				if (inheritedField.inherit === 'hierarchy_always') {
					if (lookupRecord[inheritedField.fieldName] == null) { lookupRecord[inheritedField.fieldName] = []; }
					lookupRecord[inheritedField.fieldName].push({
						_id: lookupRecord._id});
				}

				validation = metaUtils.validateAndProcessValueFor(meta, inheritedField.fieldName, lookupRecord[inheritedField.fieldName], actionType, model, objectOriginalValues, objectNewValues, idsToUpdate);
				if (validation === undefined) {
					validation = null;
				}
				if (validation instanceof Error) {
					return validation;
				}
				objectNewValues[inheritedField.fieldName] = validation;

			} else { //until_edited, once_editable

				if ((objectOriginalValues[inheritedField.fieldName] == null)) {
					validation = metaUtils.validateAndProcessValueFor(meta, inheritedField.fieldName, lookupRecord[inheritedField.fieldName], actionType, model, objectOriginalValues, objectNewValues, idsToUpdate);
					if (validation instanceof Error) {
						return validation;
					}
					objectNewValues[inheritedField.fieldName] = validation;
				}
			}
		}
	}
};


lookupUtils.removeInheritedFields = function(lookupField, objectNewValues) {
	if (_.isArray(lookupField.inheritedFields)) {
		return (() => {
			const result = [];
			for (let inheritedField of Array.from(lookupField.inheritedFields)) {
				if (['always', 'hierarchy_always'].includes(inheritedField.inherit)) {
					result.push(objectNewValues[inheritedField.fieldName] = null);
				} else {
					result.push(undefined);
				}
			}
			return result;
		})();
	}
};
