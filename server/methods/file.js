import { Meteor } from 'meteor/meteor';
import { findIndex, get, size } from 'lodash';

Meteor.registerMethod('file:upload', function (req) {
	// Get meta of document
	const meta = Meta[req.params.document];

	if (!meta) {
		return new Meteor.Error('internal-error', `Meta [${req.params.document}] does not exists`);
	}

	// Try to get passed field
	const field = meta.fields[req.params.fieldName];
	if (!field) {
		return new Meteor.Error('internal-error', `Field [${req.params.fieldName}] does not exists on metadata [${req.params.document}]`);
	}

	// Verify if field is of type file
	if (field.type !== 'file') {
		return new Meteor.Error('internal-error', `Field [${req.params.fieldName}] must be of type file`);
	}

	if (req.params.recordCode == null) {
		return new Meteor.Error('internal-error', `Record not found`);
	}

	// Get model of document
	const model = Models[req.params.document];

	// Find record by code or id
	const record = model.findOne({
		$or: [{ code: parseInt(req.params.recordCode) }, { _id: req.params.recordCode }],
	});

	// If no record found then return error
	if (!record) {
		return new Meteor.Error('internal-error', `Record with code or id [${req.params.recordCode}] was not found`);
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
	const result = Meteor.call('data:update', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: body,
	});

	// If resuls is an error, return
	if (result instanceof Error) {
		return result;
	}

	// If resuls is success: false or data don't have records, return
	if (result.success === false || result.data.length !== 1) {
		return result;
	}

	// Else send result
	return result.data[0];
});

Meteor.registerMethod('file:remove', function (req) {
	// Get meta of document
	const meta = Meta[req.params.document];

	if (!meta) {
		return new Meteor.Error('internal-error', `Meta [${req.params.document}] does not exists`);
	}

	// Try to get passed field
	const field = meta.fields[req.params.fieldName];
	if (!field) {
		return new Meteor.Error('internal-error', `Field [${req.params.fieldName}] does not exists on metadata [${req.params.document}]`);
	}

	// Verify if field is of type file
	if (field.type !== 'file') {
		return new Meteor.Error('internal-error', `Field [${req.params.fieldName}] must be of type file`);
	}

	// Get model of document
	const model = Models[req.params.document];

	// Find record by code or id
	const record = model.findOne({
		$or: [{ code: parseInt(req.params.recordCode) }, { _id: req.params.recordCode }],
	});

	// If no record found then return error
	if (!record) {
		return new Meteor.Error('internal-error', `Record with code or id [${req.params.recordCode}] was not found`);
	}

	// Add file if is isList or change file if is single
	if (field.isList === true) {
		if (!record[field.name]) {
			record[field.name] = [];
		}
		const index = findIndex(record[field.name], i => i.name === req.params.fileName);

		if (index === -1) {
			return new Meteor.Error('internal-error', `File with name [${req.params.fileName}] was not found`);
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
	const result = Meteor.call('data:update', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		document: req.params.document,
		data: body,
	});

	// If resuls is an error, return
	if (result instanceof Error) {
		return result;
	}

	// If resuls is success: false or data don't have records, return
	if (result.success === false || size(get(result, 'data')) !== 1) {
		return result;
	}

	// Else send result
	return result.data[0];
});
