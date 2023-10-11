import findIndex from 'lodash/findIndex';
import set from 'lodash/set';
import get from 'lodash/get';
import size from 'lodash/size';
import first from 'lodash/first';

import { getAuthTokenIdFromReq } from '../utils/sessionUtils';
import { MetaObject } from '@imports/model/MetaObject';
import { update } from '../data/data';

export async function fileUpload(req) {
	// Get meta of document
	const meta = MetaObject.Meta[req.params.document];

	if (meta == null) {
		return {
			success: false,
			error: `MetaObject.Meta [${req.params.document}] does not exists`,
		};
	}

	// Try to get passed field
	const field = meta.fields[req.params.fieldName];
	if (field == null) {
		return {
			success: false,
			error: `Field [${req.params.fieldName}] does not exists on metadata [${req.params.document}]`,
		};
	}

	// Verify if field is of type file
	if (field.type !== 'file') {
		return {
			success: false,
			error: `Field [${req.params.fieldName}] must be of type file`,
		};
	}

	if (req.params.recordCode == null) {
		return {
			success: false,
			error: `Record code is required`,
		};
	}

	// Get model of document
	const collection = MetaObject.Collections[req.params.document];

	// Find record by code or id
	const record = await collection.findOne({
		$or: [{ code: parseInt(req.params.recordCode) }, { _id: req.params.recordCode }],
	});

	// If no record found then return error
	if (record === null) {
		return {
			success: false,
			error: `Record with code or id [${req.params.recordCode}] was not found`,
		};
	}

	// Add file if is isList or change file if is single
	if (field.isList === true) {
		if (!record[field.name]) {
			record[field.name] = [];
		}
		const f = record[field.name].filter(item => item.etag === req.body.etag && item.key === req.body.key);

		if (f.length === 0) {
			record[field.name].push(req.body);
		}
	} else {
		record[field.name] = req.body;
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
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: body,
	});

	// If resuls is success: false or data don't have records, return
	if (result.success === false || result.data.length !== 1) {
		return result;
	}

	// Else send result
	return first(result.data);
}

export async function fileRemove(req) {
	// Get meta of document
	const meta = MetaObject.Meta[req.params.document];

	if (meta == null) {
		return {
			success: false,
			error: `MetaObject.Meta [${req.params.document}] does not exists`,
		};
	}

	// Try to get passed field
	const field = meta.fields[req.params.fieldName];
	if (field == null) {
		return {
			success: false,
			error: `Field [${req.params.fieldName}] does not exists on metadata [${req.params.document}]`,
		};
	}

	// Verify if field is of type file
	if (field.type !== 'file') {
		return {
			success: false,
			error: `Field [${req.params.fieldName}] must be of type file`,
		};
	}

	// Get model of document
	const collection = MetaObject.Collections[req.params.document];

	// Find record by code or id
	const record = await collection.findOne({
		$or: [{ code: parseInt(req.params.recordCode) }, { _id: req.params.recordCode }],
	});

	// If no record found then return error
	if (record == null) {
		return {
			success: false,
			error: `Record with code or id [${req.params.recordCode}] was not found`,
		};
	}

	// Add file if is isList or change file if is single

	set(req, 'params.fileName', decodeURIComponent(req.params.fileName));

	if (field.isList === true) {
		if (!record[field.name]) {
			record[field.name] = [];
		}
		const index = findIndex(record[field.name], i => i.name === req.params.fileName);

		if (index === -1) {
			return {
				success: false,
				error: `File with name [${req.params.fileName}] was not found`,
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
		authTokenId: getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: body,
	});

	// If resuls is success: false or data don't have records, return
	if (result.success === false || size(get(result, 'data')) !== 1) {
		return result;
	}

	// Else send result
	return first(result.data);
}
