import isArray from 'lodash/isArray';
import pick from 'lodash/pick';

import { validateAndProcessValueFor } from '../meta/validateAndProcessValueFor';
export async function copyDescriptionAndInheritedFields({ field, record, meta, actionType, objectOriginalValues, objectNewValues, idsToUpdate }) {
	const value = {
		_id: record._id,
	};

	if (isArray(field.descriptionFields)) {
		const subFieldsIdKeys = Array.from(
			new Set(field.descriptionFields.filter(fieldName => /\./.test(fieldName)).map(fieldName => `${fieldName.split('.').slice(0, -1).join('.')}._id`)),
		);
		const fieldsToCopy = Array.from(new Set([].concat('_id').concat(subFieldsIdKeys).concat(field.descriptionFields)));
		Object.assign(value, pick(record, fieldsToCopy));
	}

	if (isArray(field.inheritedFields)) {
		const inheritedFieldResults = await Promise.all(
			field.inheritedFields.map(async inheritedField => {
				if (['always', 'hierarchy_always', 'once_readonly'].includes(inheritedField.inherit)) {
					if (inheritedField.inherit === 'hierarchy_always') {
						record[inheritedField.fieldName] = [
							...(record[inheritedField.fieldName] || []),
							{
								_id: record._id,
							},
						];
					}

					const validateResult = await validateAndProcessValueFor({
						meta,
						fieldName: inheritedField.fieldName,
						value: record[inheritedField.fieldName],
						actionType,
						objectOriginalValues,
						objectNewValues,
						idsToUpdate,
					});
					if (validateResult.success === true) {
						Object.assign(value, { [inheritedField.fieldName]: validateResult.data });
					}
					return validateResult;
				} else {
					//until_edited, once_editable

					if (objectOriginalValues[inheritedField.fieldName] == null) {
						const validateResult = await validateAndProcessValueFor({
							meta,
							fieldName: inheritedField.fieldName,
							value: record[inheritedField.fieldName],
							actionType,
							objectOriginalValues,
							objectNewValues,
							idsToUpdate,
						});
						if (validateResult.success === true) {
							Object.assign(value, { [inheritedField.fieldName]: validateResult.data });
						}
						return validateResult;
					}
				}
			}),
		);
		if (inheritedFieldResults.some(result => result.success === false)) {
			return inheritedFieldResults.find(result => result.success === false);
		}
	}
	return {
		success: true,
		data: value,
	};
}
