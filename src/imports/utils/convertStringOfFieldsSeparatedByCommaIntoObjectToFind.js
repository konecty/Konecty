import isString from 'lodash/isString';

export function convertStringOfFieldsSeparatedByCommaIntoObjectToFind(fieldsString) {
	if (isString(fieldsString)) {
		return fieldsString
			.replace(/\s/g, '')
			.split(',')
			.reduce((acc, field) => Object.assign(acc, { [field]: 1 }), {});
	}

	return {};
}
