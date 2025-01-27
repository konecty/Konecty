import isString from 'lodash/isString';
import pick from 'lodash/pick';

import { getUserSafe } from '@imports/auth/getUser';
import eventManager from '@imports/lib/EventManager';
import { MetaObject } from '@imports/model/MetaObject';
import { errorReturn, successReturn } from '@imports/utils/return';
import { getAccessFor } from '../utils/accessUtils';
import { logger } from '../utils/logger';
import { randomId } from '../utils/random';

type FindCommentsParams = {
	authTokenId?: string;
	document: string;
	dataId: string;
};

export async function findComments({ authTokenId, document, dataId }: FindCommentsParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const access = getAccessFor(document, user);

	if (access === false) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];

	if (commentCollection == null) {
		return errorReturn(`[${document}] Comment collection not found`);
	}

	if (isString(dataId) === false) {
		return errorReturn(`[${document}] Param dataId must be a valid string id`);
	}

	const data = await commentCollection.find({ dataId }, { sort: { _createdAt: 1 } }).toArray();
	return successReturn(data);
}

type CreateCommentParams = FindCommentsParams & { text: string };

export async function createComment({ authTokenId, document, dataId, text }: CreateCommentParams) {
	const getUserResponse = await getUserSafe(authTokenId);

	if (getUserResponse.success === false) {
		return { success: false, errors: getUserResponse.errors };
	}

	const user = getUserResponse.data;
	const access = getAccessFor(document, user);

	if (access === false) {
		return errorReturn(`[${document}] You don't have permission for this document`);
	}

	const commentCollection = MetaObject.Collections[`${document}.Comment`];
	if (commentCollection == null) {
		return errorReturn(`[${document}] Comment collection not found`);
	}

	const documentCollection = MetaObject.Collections[document];
	if (documentCollection == null) {
		return errorReturn(`[${document}] Document collection not found`);
	}

	if (isString(text) === false || text.length === 0) {
		return errorReturn(`[${document}] Comment must be a string with one or more characters`);
	}

	if (isString(dataId) === false) {
		return errorReturn(`[${document}] Param dataId must be a valid string id`);
	}

	const record = await documentCollection.findOne({ _id: dataId });
	if (record == null) {
		return errorReturn(`[${document}] Record not found using id ${dataId}`);
	}

	const data = {
		_id: randomId(),
		dataId,
		_createdAt: new Date(),
		_createdBy: pick(user, ['_id', 'group', 'name']),
		text,
	};

	try {
		await commentCollection.insertOne(data);
		await eventManager.sendEvent(document, 'comment', data);

		return successReturn([data]);
	} catch (e) {
		const error = e as Error;
		logger.error(e, `Comment - Insert Error ${error.message}`);

		return errorReturn(`[${document}] Error inserting comment - ${error.message}`);
	}
}
