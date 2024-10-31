import findIndex from 'lodash/findIndex';
import first from 'lodash/first';
import get from 'lodash/get';
import size from 'lodash/size';

import { MetaObject } from '@imports/model/MetaObject';
import { getUserSafe } from '../auth/getUser';
import { update } from '../data/data';
import { logger } from '../utils/logger';

/**
 * 
 * @param {object} payload
 * @param {string} payload.document
 * @param {string} payload.fieldName
 * @param {string} payload.recordCode
 * @param {object} payload.body
 * @param {string} [payload.authTokenId]
 * @param {import('@imports/model/User').User} [payload.contextUser]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function fileUpload({ authTokenId = null, document, fieldName, recordCode, body, contextUser = null }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);

	if (success === false) {
		return {
			success: false,
			errors,
		};
	}
	// Get meta of document
	const meta = MetaObject.Meta[document];

	if (meta == null) {
		return {
			success: false,
			error: `MetaObject.Meta [${document}] does not exists`,
		};
	}

	// Try to get passed field
	const field = meta.fields[fieldName];
	if (field == null) {
		return {
			success: false,
			error: `Field [${fieldName}] does not exists on metadata [${document}]`,
		};
	}

	// Verify if field is of type file
	if (field.type !== 'file') {
		return {
			success: false,
			error: `Field [${fieldName}] must be of type file`,
		};
	}

	if (recordCode == null) {
		return {
			success: false,
			error: `Record code is required`,
		};
	}

	// Get model of document
	const collection = MetaObject.Collections[document];

	// Find record by code or id
	const record = await collection.findOne({
		$or: [{ code: parseInt(recordCode) }, { _id: recordCode }],
	});

	// If no record found then return error
	if (record === null) {
		return {
			success: false,
			error: `Record with code or id [${recordCode}] was not found`,
		};
	}

	// Add file if is isList or change file if is single
	if (field.isList === true) {
		if (!record[field.name]) {
			record[field.name] = [];
		}
		const f = record[field.name].filter(item => item.etag === body.etag && item.key === body.key);

		if (f.length === 0) {
			record[field.name].push(body);
		}
	} else {
		record[field.name] = body;
	}

	// Define data to update to send to updateRecords Api
	const dataToUpdate = {
		ids: [
			{
				_id: record._id,
				_updatedAt: {
					$date: (record._updatedAt || new Date()).toISOString(),
				},
			},
		],
		data: {},
	};

	// Add field of file
	dataToUpdate.data[field.name] = record[field.name];

	// Execute update
	const result = await update({
		contextUser: user,
		document: document,
		data: dataToUpdate,
	});

	// If resuls is success: false or data don't have records, return
	if (result.success === false || result.data.length !== 1) {
		return result;
	}

	// Else send result
	return first(result.data);
}

export async function fileRemove({ authTokenId = null, document, recordCode, fieldName, fileName, contextUser = null }) {
	const { success, data: user, errors } = await getUserSafe(authTokenId, contextUser);

	if (success === false) {
		return {
			success: false,
			errors,
		};
	}

	const meta = MetaObject.Meta[document];
	if (meta == null) {
		return {
			success: false,
			error: `MetaObject.Meta [${document}] does not exists`,
		};
	}

	// Try to get passed field
	const field = meta.fields[fieldName];
	if (field == null) {
		return {
			success: false,
			error: `Field [${fieldName}] does not exists on metadata [${document}]`,
		};
	}

	// Verify if field is of type file
	if (field.type !== 'file') {
		return {
			success: false,
			error: `Field [${fieldName}] must be of type file`,
		};
	}

	// Get model of document
	const collection = MetaObject.Collections[document];

	// Find record by code or id
	const record = await collection.findOne({
		$or: [{ code: parseInt(recordCode) }, { _id: recordCode }],
	});

	// If no record found then return error
	if (record == null) {
		return {
			success: false,
			error: `Record with code or id [${recordCode}] was not found`,
		};
	}

	// Add file if is isList or change file if is single
	logger.trace(
		{
			params: {
				document,
				recordCode,
				fieldName,
				fileName,
			},
		},
		'fileRemove params',
	);

	const key = `${document}/${recordCode}/${fieldName}/${fileName}`;

	if (field.isList === true) {
		if (!record[field.name]) {
			record[field.name] = [];
		}
		const index = findIndex(record[field.name], i => [fileName, decodeURIComponent(fileName)].includes(i.name) || i.key === key);

		if (index === -1) {
			return {
				success: false,
				error: `File with name [${fileName}] was not found`,
			};
		}

		record[field.name].splice(index, 1);
	} else {
		record[field.name] = null;
	}

	// Define data to update to send to updateRecords Api
	const dataToUpdate = {
		ids: [
			{
				_id: record._id,
				_updatedAt: {
					$date: (record._updatedAt || new Date()).toISOString(),
				},
			},
		],
		data: {},
	};

	// Add field of file
	dataToUpdate.data[field.name] = record[field.name];

	// Define body with data to preocess update
	const body = dataToUpdate;

	// Execute update
	const result = await update({
		authTokenId,
		document: document,
		data: body,
		contextUser: user,
	});

	// If resuls is success: false or data don't have records, return
	if (result.success === false || size(get(result, 'data')) !== 1) {
		return result;
	}

	// Else send result
	return first(result.data);
}
