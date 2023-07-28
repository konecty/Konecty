import { ObjectId } from 'mongodb';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';

export function convertObjectIds(records) {
	if (isArray(records)) {
		return records.map(convertObjectIds);
	}

	if (isObject(records)) {
		if (records instanceof ObjectId) {
			return records.toString();
		}

		return Object.keys(records).reduce((result, key) => {
			result[key] = convertObjectIds(records[key]);
			return result;
		}, {});
	}

	return records;
}
