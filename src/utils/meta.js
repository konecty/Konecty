import isObject from 'lodash/isObject';
import has from 'lodash/has';
import get from 'lodash/get';

import { Models } from 'metadata';

import validateAndProcessValueFor from './validateAndProcessValueFor';
import { convertObjectIdsToFn } from './index';

const NS_PER_SEC = 1e9;

const getNextUserFromQueue = async function (queueStrId, user) {
	// Mount query, sort, update, and options
	const query = { 'queue._id': queueStrId };

	const sort = {
		count: 1,
		order: 1,
	};

	const update = {
		$inc: {
			count: 1,
		},
		$set: {
			_updatedAt: new Date(),
			_updatedBy: {
				_id: user._id,
				name: user.name,
				group: user.group,
			},
		},
	};

	const options = {
		new: true,
		sort,
	};

	// Execute findOneAndUpdate
	let queueUser = await Models.QueueUser.findOneAndUpdate(query, update, options);

	if (queueUser && queueUser.value) {
		queueUser = queueUser.value;
	} else {
		queueUser = undefined;
	}

	if (!isObject(queueUser)) {
		queueUser = Models.Queue.findOne(queueStrId);
		if (has(queueUser, '_user.0')) {
			return {
				user: queueUser._user[0],
			};
		}
		return undefined;
	}

	// ConvertIds
	convertObjectIdsToFn(queueUser, id => id.valueOf());

	// Return queueUser
	return queueUser;
};

const getNextCode = async function (documentName, fieldName) {
	if (!fieldName) {
		fieldName = 'code';
	}

	// Mount query, sort, update, and options
	const query = { _id: fieldName };

	const update = {
		$inc: {
			next_val: 1,
		},
	};

	const options = {
		upsert: true,
		returnOriginal: false,
	};

	// Try to get next code
	try {
		const startTime = process.hrtime();
		const elapsedTimeInSeconds = time => {
			const [sec, nanosec] = process.hrtime(time);
			return sec + Math.ceil(nanosec / NS_PER_SEC);
		};
		while (elapsedTimeInSeconds(startTime) < 10) {
			const result = await Models[`${documentName}.AutoNumber`].findOneAndUpdate(query, update, options);
			const next_val = get(result, 'value.next_val', 1);

			// Validate the new sequential
			const maxRes = await Models[documentName].findOne(
				{ [fieldName]: next_val },
				{
					fields: {
						_id: false,
						code: true,
					},
				},
			);
			if (maxRes == null) {
				return next_val;
			}
			console.warn(`Duplicated key found on ${documentName}.${fieldName}: ${next_val}`.yellow);
		}
		throw new Error(`Error creating new ${fieldName} value from ${documentName}: Timeout exceed!`);
	} catch (e) {
		throw e;
	}
};

/* Populate passed data with more lookup information
	@param {String} documentName
	@param {Object} data
	@param {Object} fields  An Object with names of fields to populate with witch fields to populate

	@example
		populateLookupsData('Recruitment', record, {job: {code: 1}, contact: {code: 1, name: 1}})
*/
const populateLookupsData = function (documentName, data, fields) {
	if (!isObject(fields)) {
		throw new Error('[populateLookupsData] missing fields param');
	}

	const meta = Meta[documentName];

	for (const fieldName in meta.fields) {
		const field = meta.fields[fieldName];
		if (field.type === 'lookup' && data[fieldName] && fields[fieldName]) {
			const options = {};
			if (isObject(fields[fieldName])) {
				options.fields = fields[fieldName];
			}

			if (field.isList !== true) {
				data[fieldName] = Models[field.document].findOne({ _id: data[fieldName]._id }, options);
			} else {
				const ids = get(data, fieldName, []).map(item => item._id);

				if (ids.length > 0) {
					data[fieldName] = Models[field.document].find({ _id: { $in: ids } }, options).fetch();
				}
			}
		}
	}

	return data;
};

export { validateAndProcessValueFor, getNextUserFromQueue, getNextCode, populateLookupsData };
