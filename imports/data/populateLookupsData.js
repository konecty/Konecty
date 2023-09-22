import BluebirdPromise  from 'bluebird';

import isObject from 'lodash/isObject';

import { Meta, Collections } from '/imports/model/MetaObject';
import { errorReturn } from '/imports/utils/return';

export async function populateLookupsData({ documentName, data, fields }) {
	if (isObject(fields) === false) {
		return errorReturn('fields must be an object');
	}

	const meta = Meta[documentName];

	const result = await BluebirdPromise.reduce(
		Object.keys(meta.fields),
		async (acc, fieldName) => {
			const field = meta.fields[fieldName];
			if (field.type === 'lookup' && data[fieldName] && fields[fieldName]) {
				const options = {};
				if (isObject(fields[fieldName])) {
					options.projection = fields[fieldName];
				}
				if (field.isList === true) {
					const ids = data[fieldName].map(item => item._id);
					if (ids.length > 0) {
						acc[fieldName] = await Collections[field.document].find({ _id: { $in: ids } }, options).toArray();
					}
				} else {
					acc[fieldName] = await Collections[field.document].findOne({ _id: data[fieldName]._id }, options);
				}
			}
			return acc;
		},
		data,
	);

	return result;
}
