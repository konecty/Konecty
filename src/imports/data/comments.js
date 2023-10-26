import isString from 'lodash/isString';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '../utils/logger';
import { getAccessFor } from '../utils/accessUtils';
import { getUserSafe } from '@imports/auth/getUser';
import { randomId } from '../utils/random';

/* Get a list of comments of one record
	@param authTokenId
	@param document
	@param dataId
*/

export async function findComments({ authTokenId, document, dataId }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);

	if (success === false) {
		return { success, errors };
	}

	const access = getAccessFor(document, user);

	if (access === false) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission for this document` }],
		};
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];

	if (commentCollection == null) {
		return {
			success: false,
			errors: [{ message: `[${document}] Comment collection not found` }],
		};
	}

	if (isString(dataId) === false) {
		return {
			success: false,
			errors: [{ message: `[${document}] Param dataId must be a valid string id` }],
		};
	}

	const data = await commentCollection.find({ dataId: dataId }, { sort: { _createdAt: 1 } }).toArray();

	return { success: true, data };
}

/* Create a new commento for given record
	@param authTokenId
	@param document
	@param dataId
	@param text
*/

export async function createComment({ authTokenId, document, dataId, text }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId);
	if (success === false) {
		return { success, errors };
	}

	const access = getAccessFor(document, user);
	if (access === false) {
		return {
			success: false,
			errors: [{ message: `[${document}] You don't have permission for this document` }],
		};
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];
	if (commentCollection == null) {
		return {
			success: false,
			errors: [{ message: `[${document}] Comment collection not found` }],
		};
	}

	const documentCollection = MetaObject.Collections[document];
	if (documentCollection == null) {
		return {
			success: false,
			errors: [{ message: `[${document}] Document collection not found` }],
		};
	}

	if (isString(text) === false || text.length === 0) {
		return {
			success: false,
			errors: [{ message: `[${document}] Comment must be a string with one or more characters` }],
		};
	}

	if (isString(dataId) === false) {
		return {
			success: false,
			errors: [{ message: `[${document}] Param dataId must be a valid string id` }],
		};
	}

	const record = await documentCollection.findOne({ _id: dataId });

	if (record == null) {
		return {
			success: false,
			errors: [{ message: `[${document}] Record not found using id ${dataId}` }],
		};
	}

	const data = {
		_id: randomId(),
		dataId,
		_createdAt: new Date(),
		_createdBy: {
			_id: user._id,
			group: user.group,
			name: user.name,
		},
		text,
	};

	try {
		await commentCollection.insertOne(data);
		return { success: true, data: [data] };
	} catch (e) {
		logger.error(e, `Comment - Insert Error ${e.message}`);

		return {
			success: false,
			errors: [{ message: `[${document}] Comment insert error ${e.message}` }],
		};
	}
}
