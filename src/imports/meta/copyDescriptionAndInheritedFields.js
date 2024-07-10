import isArray from 'lodash/isArray';
import pick from 'lodash/pick';

import { validateAndProcessValueFor } from '../meta/validateAndProcessValueFor';
export async function copyDescriptionAndInheritedFields({ field, record, meta, actionType, objectOriginalValues, objectNewValues, idsToUpdate }, dbSession) {
	const value = {
		_id: record._id,
	};

	if (isArray(field.descriptionFields)) {
		// Add _id for each part of subfields to guarantee internals lookup _id
		const subfieldsWithId = Array.from(
			new Set(field.descriptionFields
				.filter(fieldName => /\./.test(fieldName))
				.reduce((acc, fieldName) => {
					const parts = fieldName.split('.');
					return acc.concat(...parts.map(part => `${part}._id`));
				}, [])),
		);
		const fieldsToCopy = Array.from(new Set([].concat('_id').concat(subfieldsWithId).concat(field.descriptionFields)));
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
					}, dbSession);
					if (validateResult.success === true) {
						Object.assign(objectNewValues, { [inheritedField.fieldName]: validateResult.data });
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
						}, dbSession);
						if (validateResult.success === true) {
							Object.assign(objectNewValues, { [inheritedField.fieldName]: validateResult.data });
						}
						return validateResult;
					}
				}
			}),
		);
		if (inheritedFieldResults.some(result => result != null && result.success === false)) {
			return inheritedFieldResults.find(result => result != null && result.success === false);
		}
	}
	return {
		success: true,
		data: value,
	};
}
