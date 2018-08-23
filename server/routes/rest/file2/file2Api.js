/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

/* @Add_File */
app.post('/rest/file2/:document/:recordCode/:fieldName', (req, res, next) =>
	middlewares.sessionUserAndGetAccessFor('document')(req, res, function() {
		// Get meta of document
		const meta = Meta[req.params.document];

		if ((meta == null)) {
			return res.send(new Meteor.Error('internal-error', `Meta [${req.params.document}] does not exists`));
		}

		// Try to get passed field
		const field = meta.fields[req.params.fieldName];
		if ((field == null)) {
			return res.send(new Meteor.Error('internal-error', `Field [${req.params.fieldName}] does not exists on metadata [${req.params.document}]`));
		}

		// Verify if field is of type file
		if (field.type !== 'file') {
			return res.send(new Meteor.Error('internal-error', `Field [${req.params.fieldName}] must be of type file`));
		}

		// Get model of document
		const model = Models[req.params.document];

		// Find record by code or id
		const record = model.findOne({$or: [
			{code: parseInt(req.params.recordCode)},
			{_id: req.params.recordCode}
		]});

		// If no record found then return error
		if ((record == null)) {
			return res.send(new Meteor.Error('internal-error', `Record with code or id [${req.params.recordCode}] was not found`));
		}

		// Add file if is isList or change file if is single
		if (field.isList === true) {
			if (record[field.name] == null) { record[field.name] = []; }
			const f = record[field.name].filter(item => (item.etag === req.body.etag) && (item.key === req.body.key));

			if (f.length === 0) {
				record[field.name].push(req.body);
			}
		} else {
			record[field.name] = req.body;
		}

		// Define data to update to send to updateRecords Api
		const dataToUpdate = {
			ids: [{
				_id: record._id,
				_updatedAt: {
					$date: record._updatedAt.toISOString()
				}
			}],
			data: {}
		};

		// Add field of file
		dataToUpdate.data[field.name] = record[field.name];

		// Define body with data to preocess update
		const body = dataToUpdate;

		// Execute update
		const result = Meteor.call('data:update', {
			authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: body
		}
		);

		// If resuls is an error, return
		if (result instanceof Error) {
			return res.send(result);
		}

		// If resuls is success: false or data don't have records, return
		if ((result.success === false) || (result.data.length !== 1)) {
			return res.send(result);
		}

		// Else send result
		return res.send(result.data[0]);
})
);

/* @Remove_File */
app.del('/rest/file2/:document/:recordCode/:fieldName/:fileName', (req, res, next) =>
	middlewares.sessionUserAndGetAccessFor('document')(req, res, function() {
		// Get meta of document
		const meta = Meta[req.params.document];

		if ((meta == null)) {
			return res.send(new Meteor.Error('internal-error', `Meta [${req.params.document}] does not exists`));
		}

		// Try to get passed field
		const field = meta.fields[req.params.fieldName];
		if ((field == null)) {
			return res.send(new Meteor.Error('internal-error', `Field [${req.params.fieldName}] does not exists on metadata [${req.params.document}]`));
		}

		// Verify if field is of type file
		if (field.type !== 'file') {
			return res.send(new Meteor.Error('internal-error', `Field [${req.params.fieldName}] must be of type file`));
		}

		// Get model of document
		const model = Models[req.params.document];

		// Find record by code or id
		const record = model.findOne({$or: [
			{code: parseInt(req.params.recordCode)},
			{_id: req.params.recordCode}
		]});

		// If no record found then return error
		if ((record == null)) {
			return res.send(new Meteor.Error('internal-error', `Record with code or id [${req.params.recordCode}] was not found`));
		}

		// Add file if is isList or change file if is single
		if (field.isList === true) {
			if (record[field.name] == null) { record[field.name] = []; }
			const index = _.indexBy(record[field.name], i => i.name === req.params.fileName);

			if (index === -1) {
				return res.send(new Meteor.Error('internal-error', `File with name [${req.params.fileName}] was not found`));
			}

			record[field.name].splice(index, 1);
		} else {
			record[field.name] = null;
		}

		// Define data to update to send to updateRecords Api
		const dataToUpdate = {
			ids: [{
				_id: record._id,
				_updatedAt: {
					$date: record._updatedAt.toISOString()
				}
			}],
			data: {}
		};

		// Add field of file
		dataToUpdate.data[field.name] = record[field.name];

		// Define body with data to preocess update
		const body = dataToUpdate;

		// Execute update
		const result = Meteor.call('data:update', {
			authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
			document: req.params.document,
			data: body
		}
		);

		// If resuls is an error, return
		if (result instanceof Error) {
			return res.send(result);
		}

		// If resuls is success: false or data don't have records, return
		if ((result.success === false) || (result.data == null) || ((result.data != null ? result.data.length : undefined) !== 1)) {
			return res.send(result);
		}

		// Else send result
		return res.send(result.data[0]);
})
);
