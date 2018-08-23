/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import moment from 'moment';

const httpRequest = require('request');

/* Get next user of queue
	@param authTokenId
	@param document
	@param queueId
*/
Meteor.registerMethod('data:queue:next', 'withUser', 'withAccessForDocument', function(request) {
	const user = metaUtils.getNextUserFromQueue(request.queueId, this.user);

	if ((user == null)) {
		return {success: false};
	}

	return {success: true, user};
});


/* Get a list of records
	@param authTokenId
	@param document
	@param displayName
	@param displayType
	@param fields
	@param filter
	@param sort
	@param limit
	@param start
	@param getTotal
*/
Meteor.registerMethod('data:find:all', 'withUser', 'withAccessForDocument', function(request) {
	let accessField, condition;
	const context = this;

	// Verify if user have permission to read records
	if (context.access.isReadable !== true) {
		return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to read records`);
	}

	const model = Models[request.document];
	if ((model == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Document does not exists`);
	}

	const fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind(request.fields);

	if ((fields != null ? fields.$textScore : undefined) != null) {
		fields.$textScore = {$meta: 'textScore'};
	}

	const metaObject = Meta[request.document];

	let query = {};

	// Define init filter
	const filter = {
		match: 'and',
		filters: []
	};

	// If filter is not given, apply meta default filters
	if (!_.isObject(request.filter) && (request.displayName != null) && (request.displayType != null)) {
		const displayMeta = DisplayMeta[`${request.document}:${request.displayType}:${request.displayName}`];
		if ((displayMeta != null ? displayMeta.filter : undefined) != null) {
			filter.filters.push(displayMeta.filter);
		}
	}

	if (_.isObject(context.access.readFilter)) {
		filter.filters.push(context.access.readFilter);
	}

	if (_.isObject(request.filter)) {
		filter.filters.push(request.filter);
	}

	// Parse filters
	const readFilter = filterUtils.parseFilterObject(filter, metaObject, context);
	if (readFilter instanceof Error) {
		context.notifyError('Find - Filter Error', readFilter, request);
		return readFilter;
	}

	// If there are filter then init query with this filter
	if (_.isObject(readFilter) && (Object.keys(readFilter).length > 0)) {
		query = readFilter;
	}

	if (_.isObject(request.filter) && _.isString(request.filter.textSearch)) {
		query.$text =
			{$search: request.filter.textSearch};
	}

	// Validate if user have permission to view each field
	const emptyFields = Object.keys(fields).length === 0;
	for (var fieldName in metaObject.fields) {
		accessField = accessUtils.getFieldPermissions(context.access, fieldName);
		if (accessField.isReadable !== true) {
			if (emptyFields === true) {
				fields[fieldName] = 0;
			} else {
				delete fields[fieldName];
			}
		}
	}

	let sort = {};
	if (request.sort) {
		if (_.isString(request.sort)) { request.sort = JSON.parse(request.sort); }

		sort = sortUtils.parseSortArray(request.sort);
		if (sort instanceof Error) {
			context.notifyError('Find - Sort Error', sort, request);
			return sort;
		}
	}

	// Force money to filter with .value
	for (let key in sort) {
		const value = sort[key];
		if ((metaObject.fields[key] != null ? metaObject.fields[key].type : undefined) === 'money') {
			sort[`${key}.value`] = sort[key];
			delete sort[key];
		}

		if ((metaObject.fields[key] != null ? metaObject.fields[key].type : undefined) === 'personName') {
			sort[`${key}.full`] = sort[key];
			delete sort[key];
		}

		if (key === '$textScore') {
			if (fields.$textScore != null) {
				sort.$textScore = {$meta: 'textScore'};
			} else {
				delete sort.$textScore;
			}
		}
	}

	const accessConditions = [];

	for (fieldName in metaObject.fields) {
		accessField = accessUtils.getFieldPermissions(this.access, fieldName);
		if (accessField.isReadable === true) {
			const accessFieldConditions = accessUtils.getFieldConditions(this.access, fieldName);
			if (accessFieldConditions.READ != null) {
				condition = filterUtils.parseFilterCondition(accessFieldConditions.READ, metaObject, context, true);
				if (condition instanceof Error) {
					this.notifyError('FindOne - Access Filter Error', condition, {accessFilter: accessFieldConditions.READ});
					return condition;
				}

				accessConditions.push({
					fieldName,
					condition
				});

				if (((emptyFields === true) && (fields[fieldName] == null)) || ((emptyFields !== true) && (fields[fieldName] === 1))) {
					const conditionFields = Object.keys(condition);
					for (let conditionField of Array.from(conditionFields)) {
						if (emptyFields === true) {
							delete fields[conditionField];
						} else {
							fields[conditionField] = 1;
						}
					}
				}
			}
		}
	}

	const options = {
		limit: parseInt(request.limit),
		skip: parseInt(request.start),
		fields,
		sort
	};

	if (_.isNaN(options.limit) || (options.limit == null)) {
		options.limit = 50;
	}

	let records = model.find(query, options).fetch();

	const local = {collection: new Meteor.Collection(null)};

	for (var record of Array.from(records)) {
		local.collection.insert(record);
	}

	for (let accessCondition of Array.from(accessConditions)) {
		const update = {$unset: {}};
		update.$unset[accessCondition.fieldName] = 1;

		const affected = local.collection.updateMany(accessCondition.condition, update);
	}

	records = local.collection.find().fetch();

	delete local.collection;

	const data = {
		success: true,
		data: records
	};

	if (request.getTotal === true) {
		data.total = model.find(query).count();
	}

	if (request.withDetailFields === 'true') {
		for (let index = 0; index < records.length; index++) {
			record = records[index];
			const populatedRecord = Meteor.call('data:populate:detailFieldsInRecord', {
				record,
				document: request.document,
				__scope__: {
					user: this.user,
					access: this.access
				}
			}
			);

			if (populatedRecord != null) {
				records[index] = populatedRecord;
			}
		}
	}

	return data;
});

/* Get distinct field values from records
	@param authTokenId
	@param document
	@param field
*/
Meteor.registerMethod('data:find:distinct', 'withUser', 'withAccessForDocument', function(request) {
	const context = this;

	// Verify if user have permission to read records
	if (context.access.isReadable !== true) {
		return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to read records`);
	}

	const model = Models[request.document];
	if ((model == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Document does not exists`);
	}

	if (!_.isString(request.field)) {
		return new Meteor.Error('internal-error', `[${request.document}] field must be string`);
	}

	const metaObject = Meta[request.document];

	let query = {};

	// Define init filter
	const filter = {
		match: 'and',
		filters: []
	};

	if (_.isObject(context.access.readFilter)) {
		filter.filters.push(context.access.readFilter);
	}

	// Parse filters
	const readFilter = filterUtils.parseFilterObject(filter, metaObject, context);
	if (readFilter instanceof Error) {
		context.notifyError('Find - Filter Error', readFilter, request);
		return readFilter;
	}

	// If there are filter then init query with this filter
	if (_.isObject(readFilter) && (Object.keys(readFilter).length > 0)) {
		query = readFilter;
	}

	// Validate if user have permission to view field

	const accessField = accessUtils.getFieldPermissions(context.access, request.field);
	if (accessField.isReadable !== true) {
		return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to read field`);
	}

	const options =
		{fields: utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind(request.field)};

	const records = model.find(query, options).fetch();

	const values = [];
	_.each(records, function(item) {
		const value = utils.getObjectPathAgg(item, request.field);
		if (_.isArray(value)) {
			return _.each(value, _value => values.push(_value));
		} else {
			return values.push(value);
		}
	});

	const uniques = _.uniq(_.compact(values));

	const data = {
		success: true,
		data: uniques
	};

	return data;
});


/* Get a record by id
	@param authTokenId
	@param document
	@param fields
	@param dataId
*/
Meteor.registerMethod('data:find:byId', 'withUser', 'withAccessForDocument', function(request) {
	let accessField, condition;
	const context = this;

	// Verify if user have permission to read records
	if (this.access.isReadable !== true) {
		return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to read records`);
	}

	const model = Models[request.document];
	if ((model == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Document does not exists`);
	}

	if (!_.isString(request.dataId)) {
		return new Meteor.Error('internal-error', `[${request.document}] DataId must be string`);
	}

	const metaObject = Meta[request.document];

	let query = {};

	// Define init filter
	const filter = {
		match: 'and',
		filters: []
	};

	if (_.isObject(this.access.readFilter)) {
		filter.filters.push(this.access.readFilter);
	}

	// Parse filters
	const readFilter = filterUtils.parseFilterObject(filter, metaObject, context);
	if (readFilter instanceof Error) {
		this.notifyError('Find - Filter Error', readFilter, request);
		return readFilter;
	}

	// If there are filter then init query with this filter
	if (_.isObject(readFilter) && (Object.keys(readFilter).length > 0)) {
		query = readFilter;
	}

	const fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind(request.fields);

	// Validate if user have permission to view each field
	const emptyFields = Object.keys(fields).length === 0;
	for (var fieldName in metaObject.fields) {
		accessField = accessUtils.getFieldPermissions(this.access, fieldName);
		if (accessField.isReadable !== true) {
			if (emptyFields === true) {
				fields[fieldName] = 0;
			} else {
				delete fields[fieldName];
			}
		}
	}

	query._id = request.dataId;

	const accessConditions = [];

	for (fieldName in metaObject.fields) {
		accessField = accessUtils.getFieldPermissions(this.access, fieldName);
		if (accessField.isReadable === true) {
			const accessFieldConditions = accessUtils.getFieldConditions(this.access, fieldName);
			if (accessFieldConditions.READ != null) {
				condition = filterUtils.parseFilterCondition(accessFieldConditions.READ, metaObject, context, true);
				if (condition instanceof Error) {
					this.notifyError('FindOne - Access Filter Error', condition, {accessFilter: accessFieldConditions.READ});
					return condition;
				}

				accessConditions.push({
					fieldName,
					condition
				});

				if (((emptyFields === true) && (fields[fieldName] == null)) || ((emptyFields !== true) && (fields[fieldName] === 1))) {
					const conditionFields = Object.keys(condition);
					for (let conditionField of Array.from(conditionFields)) {
						if (emptyFields === true) {
							delete fields[conditionField];
						} else {
							fields[conditionField] = 1;
						}
					}
				}
			}
		}
	}

	const options =
		{fields};

	let data = model.findOne(query, options);

	if (data != null) {
		const local = {collection: new Meteor.Collection(null)};

		local.collection.insert(data);

		for (let accessCondition of Array.from(accessConditions)) {
			const update = {$unset: {}};
			update.$unset[accessCondition.fieldName] = 1;

			const affected = local.collection.updateMany(accessCondition.condition, update);
		}

		data = local.collection.find({}).fetch();

		delete local.collection;

		if ((data != null) && (request.withDetailFields === 'true')) {
			for (let index = 0; index < data.length; index++) {
				const record = data[index];
				const populatedRecord = Meteor.call('data:populate:detailFieldsInRecord', {
					record,
					document: request.document,
					__scope__: {
						user: this.user,
						access: this.access
					}
				}
				);

				if (populatedRecord != null) {
					data[index] = populatedRecord;
				}
			}
		}

	} else {
		data = [];
	}

	return {success: true, data, total: data.length};
});


/* Get a list of records from a lookup
	@param authTokenId
	@param document
	@param field
	@param search
	@param start
	@param limit
	@param useChangeUserFilter
*/
Meteor.registerMethod('data:find:byLookup', 'withUser', 'withAccessForDocument', function(request) {
	const context = this;

	const meta = Meta[request.document];

	if ((meta == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Document does not exists`);
	}

	const field = meta.fields[request.field];
	if ((field == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Field ${request.field} does not exists`);
	}

	const model = Models[field.document];

	const lookupMeta = Meta[field.document];

	if ((model == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Document ${field.document} does not exists`);
	}

	let query = {};
	const fields =
		{_updatedAt: 1};

	const sort = {};

	if (_.isArray(field.descriptionFields)) {
		const conditions = [];
		let { descriptionFields } = field;

		if (_.isArray(field.searchableFields)) {
			descriptionFields = descriptionFields.concat(field.searchableFields);
		}

		let sortArrayField = false;

		for (let descriptionField of Array.from(descriptionFields)) {
			const lookupField = lookupMeta.fields[descriptionField.split('.')[0]];

			if ((lookupField.type === 'picklist') || (lookupField.isList === true)) {
				if (!sortArrayField) {
					sort[descriptionField] = 1;
					sortArrayField = true;
				}
			} else {
				sort[descriptionField] = 1;
			}

			fields[descriptionField] = 1;

			if (_.isString(request.search) && (request.search.length > 0)) {
				const condition = {};

				const searchAsInt = String(parseInt(request.search)) === request.search;

				if (['number', 'autoNumber', 'money'].includes(lookupField.type)) {
					const floatValue = parseFloat(request.search);
					if ((floatValue != null) && !isNaN(floatValue)) {
						condition[descriptionField] = floatValue;
					}
				} else if ((lookupField.type === 'address') && (descriptionField === lookupField.name)) {
					for (let addressField of ['country', 'state', 'city', 'place', 'number', 'postalCode', 'district', 'placeType', 'complement']) {
						const c = {};
						c[`${descriptionField}.${addressField}`] = {$regex: request.search, $options: 'i'};
						conditions.push(c);
					}
				} else {
					if (searchAsInt === false) {
						if (['date', 'dateTime'].includes(lookupField.type)) {
							condition[descriptionField] = new Date(request.search);
						} else if (lookupField.type !== 'boolean') {
							condition[descriptionField] = {$regex: request.search, $options: 'i'};
						}
					}
				}

				if (Object.keys(condition).length > 0) {
					conditions.push(condition);
				}
			}
		}

		if (conditions.length > 0) {
			query.$or = conditions;
		}
	}

	if (_.isArray(field.inheritedFields)) {
		for (let inheritedField of Array.from(field.inheritedFields)) {
			fields[inheritedField.fieldName] = 1;
		}
	}

	// if field have access
	if (field.access != null) {
		// set base for access if doesn't exists
		if ((this.user.access == null)) {
			this.user.access = {};
		}

		// If no access for field document, set empty array
		if ((this.user.access[field.document] == null)) {
			this.user.access[field.document] = [];
		// Else, if value isn't array, convert to array
		} else if (!_.isArray(this.user.access[field.document])) {
			this.user.access[field.document] = [this.user.access[field.document]];
		}

		// And finally add field access as first access value
		this.user.access[field.document].unshift(field.access);
	}

	// Find access for lookup list data
	const access = accessUtils.getAccessFor(field.document, this.user);

	// Define init filter
	const filter = {
		match: 'and',
		filters: []
	};

	if ((request.useChangeUserFilter === true) && _.isObject(access.changeUserFilter)) {
		filter.filters.push(access.changeUserFilter);

	} else if (_.isObject(access.readFilter)) {
		filter.filters.push(access.readFilter);
	}

	if (_.isObject(request.filter) && !_.isArray(request.filter)) {
		filter.filters.push(request.filter);
	}

	// Parse filters
	const readFilter = filterUtils.parseFilterObject(filter, lookupMeta, context);
	if (readFilter instanceof Error) {
		this.notifyError('Lookup - Access Filter Error', readFilter, request);
		return readFilter;
	}

	// If there are filter then add to query
	if (_.isObject(readFilter) && (Object.keys(readFilter).length > 0)) {
		if (Object.keys(query).length === 0) {
			query = readFilter;
		} else {
			query = {$and: [query, readFilter]};
		}
	}

	// Validate if user have permission to view each field
	for (let fieldName in fields) {
		const value = fields[fieldName];
		const accessField = accessUtils.getFieldPermissions(access, fieldName.split('.')[0]);
		if (accessField.isReadable !== true) {
			delete fields[fieldName];
		}
	}

	const options = {
		limit: parseInt(request.limit),
		skip: parseInt(request.start),
		fields,
		sort
	};

	if (_.isNaN(options.limit) || (options.limit == null)) {
		options.limit = 100;
	}

	const data = model.find(query, options).fetch();
	const total = model.find(query).count();

	return {success: true, data, total};
});


/* Receive a record and populate with detail fields
	@param authTokenId
	@param document
	@param record
*/
Meteor.registerMethod('data:populate:detailFieldsInRecord', 'withUser', 'withAccessForDocument', function(request) {
	const context = this;
	if ((request.record == null)) {
		return;
	}

	const populateDetailFields = function(field, value, parent) {
		if (((value != null ? value._id : undefined) == null)) {
			return context.notifyError(new Meteor.Error('internal-error', 'populateDetailFields: value without _id', {field, value, document: request.document, parent}));
		}

		const record = Meteor.call('data:find:byId', {
			document: field.document,
			fields: field.detailFields.join(','),
			dataId: value._id,
			__scope__: {
				user: context.user
			}
		}
		);

		if (__guard__(record != null ? record.data : undefined, x => x[0]) != null) {
			return (() => {
				const result = [];
				for (let recordKey in record.data[0]) {
					const recordValue = record.data[0][recordKey];
					result.push(value[recordKey] = recordValue);
				}
				return result;
			})();
		}
	};

	const metaObject = Meta[request.document];

	for (let fieldName in request.record) {
		const value = request.record[fieldName];
		const field = metaObject.fields[fieldName];
		if ((value != null) && (field != null) && (field.type === 'lookup') && ((field.detailFields != null ? field.detailFields.length : undefined) > 0)) {
			if (field.isList === true) {
				for (let item of Array.from(value)) { populateDetailFields(field, item, value); }
			} else {
				populateDetailFields(field, value);
			}
		}
	}

	return request.record;
});


/* Create a new record
	@param authTokenId
	@param document
	@param data
*/
Meteor.registerMethod('data:create', 'withUser', 'withAccessForDocument', 'ifAccessIsCreateable', 'withMetaForDocument', 'withModelForDocument', 'ifCreateIsValid', 'processCollectionLogin', function(request) {
	let field, k, resultOfValidation, value;
	const context = this;
	const { meta } = this;
	const { model } = this;

	if ((request.data != null ? request.data._user : undefined) != null) {
		let onlyMe = true;

		for (let newUser of Array.from(request.data._user)) {
			if (newUser._id !== this.user._id) {
				onlyMe = false;
			}
		}

		if (!onlyMe && (this.access.changeUser !== true)) {
			delete request.data._user;
		}
	}

	// Define response object to be populated later
	const response = {
		errors: [],
		success: true
	};

	// Remove null values and empty strings
	for (var key in request.data) { value = request.data[key]; if ((value === null) || (value === '')) { delete request.data[key]; } }

	// Validate if user have permission to create each field that he are trying
	for (let fieldName in request.data) {
		const accessField = accessUtils.getFieldPermissions(this.access, fieldName);
		if (accessField.isCreatable !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to create field ${fieldName}`);
		}
	}

	// After all validations
	// Init newRecord object
	const newRecord = {};

	// If no user was defined
	if ((request.data._user == null)) {
		// Get user id from session
		let userOid = this.user._id;

		// Test if was passed one queue
		const { queue } = request.data;
		// TODO: Remove
		// Workaround to don't process queue for saves on QueueUser whiout user
		if (meta.name !== 'QueueUser') {
			if (_.isObject(queue) && _.isString(queue._id)) {
				// If yes, get next user from queue and override user of session
				const userQueue = metaUtils.getNextUserFromQueue(queue._id, this.user);
				if (_.isObject(userQueue)) {
					userOid = userQueue.user._id.valueOf();
				}
			}
		}

		// Define user of session or queue in correctly format
		request.data._user =
			{_id: userOid};

		// If user field is isList change format to array
		if ((meta.fields._user != null ? meta.fields._user.isList : undefined) === true) {
			request.data._user = [request.data._user];
		}
	}

	// Validate and process lookups first to inherit data before validation
	for (key in meta.fields) {
		field = meta.fields[key];
		if (field.type === 'lookup') {
			if (newRecord[key] === undefined) {
				value = request.data[field.name];

				resultOfValidation = metaUtils.validateAndProcessValueFor(meta, key, value, 'insert', model, request.data, newRecord);
				if (resultOfValidation instanceof Error) {
					response.errors.push(resultOfValidation);
				}

				if (resultOfValidation !== undefined) {
					newRecord[key] = resultOfValidation;
				}
			}
		}
	}

	// If meta includes scriptBeforeValidation, run it in a sandboxed environment and extend request.data with its results
	if (meta.scriptBeforeValidation) {
		const extraData = {
			original: {},
			request: request.data,
			validated: newRecord
		};
		request.data = _.extend(request.data, utils.runScriptBeforeValidation(meta.scriptBeforeValidation, _.extend(request.data, newRecord), context, extraData));
	}

	// Iterate over all fields, except autoNumbers, of meta to validate values and insert default values
	for (key in meta.fields) {
		field = meta.fields[key];
		if (!['autoNumber'].includes(field.type)) {
			if (newRecord[key] === undefined) {
				// Remove empty strings
				if (request.data[field.name] === '') {
					delete request.data[field.name];
				}

				// If don't exists data for field and exists one default value into metadata, set default value
				if ((request.data[field.name] == null) && (field.defaultValue != null)) {
					request.data[field.name] = field.defaultValue;
				}

				// If don't exists data for field and exists default values into metadata, set default values
				if ((request.data[field.name] == null) && ((field.defaultValues != null ? field.defaultValues.length : undefined) > 0)) {
					// Work around to fix picklist behavior
					if (field.type === 'picklist') {
						let v = field.defaultValues[0] != null ? field.defaultValues[0].pt_BR : undefined;
						if ((v == null)) {
							k = Object.keys(field.defaultValues[0]);
							v = field.defaultValues[0][k[0]];
						}
						request.data[field.name] = v;
					} else {
						request.data[field.name] = field.defaultValues;
					}
				}

				value = request.data[field.name];
				resultOfValidation = metaUtils.validateAndProcessValueFor(meta, key, value, 'insert', model, request.data, newRecord);
				if (resultOfValidation instanceof Error) {
					this.notifyError('Create - Validation Error', resultOfValidation, request);
					response.errors.push(resultOfValidation);
				}

				if (resultOfValidation !== undefined) {
					newRecord[key] = resultOfValidation;
				}
			}
		}
	}

	// If meta includes validationScript, run it in a sandboxed environment
	if (meta.validationScript != null) {
		const validation = processValidationScript(meta.validationScript, meta.validationData, _.extend({}, request.data, newRecord), context);
		if ((validation != null ? validation.success : undefined) !== true) {
			const error = new Meteor.Error(validation.reason);
			this.notifyError('Create - Script Validation Error', error, request);
			response.errors.push(error);
		}
	}

	// If no errors util now, iterate over autoNumber fields to generate codes
	if (response.errors.length === 0) {
		for (key in meta.fields) {
			field = meta.fields[key];
			if (field.type === 'autoNumber') {
				value = request.data[field.name];

				// Ignore autonumbers if requested
				if ((request.ignoreAutoNumber !== true) || !value) {
					resultOfValidation = metaUtils.validateAndProcessValueFor(meta, key, value, 'insert', model, request.data, newRecord);
					if (resultOfValidation instanceof Error) {
						this.notifyError('Create - Validation Error', resultOfValidation, request);
						response.errors.push(resultOfValidation);
					}

					newRecord[key] = resultOfValidation;
				} else {
					newRecord[key] = value;
				}
			}
		}
	}

	for (k of Array.from(Object.keys(newRecord))) {
		// Don't save null and undefiend values
		if ((newRecord[k] === null) || (newRecord[k] === undefined)) {
			delete newRecord[k];
		}
	}

	// If record has data, then execute
	if ((Object.keys(newRecord).length > 0) && (response.errors.length === 0)) {
		// Define _createdAt to current date and time and _createdBy to current user
		let insertResult;
		newRecord._createdAt = request.data._createdAt || new Date;
		newRecord._createdBy = request.data._createdBy || {
			_id: this.user._id,
			name: this.user.name,
			group: this.user.group
		};

		// Set _updatedAt and _updatedBy with same values of _createdAt _createdBy
		newRecord._updatedAt = request.data._updatedAt || newRecord._createdAt;
		newRecord._updatedBy = request.data._updatedBy || newRecord._createdBy;

		// If an id was passed, use it
		if ((request.data._id != null) && _.isString(request.data._id)) {
			newRecord._id = request.data._id;
		}

		// Execute insert
		try {
			if (_.isObject(request.upsert)) {
				const updateOperation = { $setOnInsert: {}, $set: {} };
				if (_.isObject(request.updateOnUpsert)) {
					for (key in newRecord) {
						value = newRecord[key];
						if (newRecord.hasOwnProperty(key)) {
							if (request.updateOnUpsert[key]) {
								updateOperation['$set'][key] = newRecord[key];
							} else {
								updateOperation['$setOnInsert'][key] = newRecord[key];
							}
						}
					}
				} else {
					updateOperation['$setOnInsert'] = newRecord;
				}

				if (_.isEmpty(updateOperation['$set'])) {
					delete updateOperation['$set'];
				}

				if (_.isEmpty(updateOperation['$setOnInsert'])) {
					delete updateOperation['$setOnInsert'];
				}

				insertResult = model.upsert(request.upsert, updateOperation);
				if (insertResult.insertedId != null) {
					insertResult = insertResult.insertedId;
				} else if (insertResult.numberAffected > 0) {
					insertResult = __guard__(model.findOne(request.upsert), x => x._id);
				}
			} else {
				insertResult = model.insert(newRecord);
			}
		} catch (e) { 
			if (e.code === 11000) {
				e = new Meteor.Error('internal-error', "Erro ao inserir: registro já existe");
				NotifyErrors.notify('catchErrors', e);
				return e;
			} else {
				NotifyErrors.notify('DataInsertError', e);
				return e;
			}
		}


		let query =
			{_id: insertResult};

		// Call hooks
		if (!_.isEmpty(Namespace.onCreate)) {
			// Find record before apply access filter to query
			const hookData = {
				action: 'create',
				ns: Namespace.ns,
				documentName: request.document,
				user: _.pick(this.user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale']),
				data: [ model.findOne(query) ] // Find records before apply access filter to query
			};

			const urls = [].concat(Namespace.onCreate);
			for (var url of Array.from(urls)) {
				if (!_.isEmpty(url)) {
					url = url.replace('${dataId}', insertResult.valueOf());
					url = url.replace('${documentId}', `${Namespace.ns}:${request.document}`);

					httpRequest.post({ url, json: hookData }, function(err, response) {
						if (err != null) {
							NotifyErrors.notify('HookOnCreateError', err);
							return console.log("📠 ", `CREATE ERROR ${url}`.red, err);
						}

						if (response.statusCode === 200) {
							return console.log("📠 ", `${response.statusCode} CREATE ${url}`.green);
						} else {
							return console.log("📠 ", `${response.statusCode} CREATE ${url}`.red);
						}
					});
				}
			}
		}

		// Apply read access filter
		if (_.isObject(this.access.readFilter)) {
			const readFilter = filterUtils.parseFilterObject(this.access.readFilter, meta, context);
			if (readFilter instanceof Error) {
				this.notifyError('Create - Read Filter', readFilter, {accessFilter: this.access.readFilter});
				response.errors.push(readFilter);
			} else {
				query =
					{$and: [query, readFilter]};
			}
		}

		// Find insertedRecord
		let insertedRecord = model.findOne(query);

		if (meta.scriptAfterSave != null) {
			utils.runScriptAfterSave(meta.scriptAfterSave, [insertedRecord], context);
		}

		// Set update reords to response object
		if (_.isObject(insertedRecord)) {
			insertedRecord = accessUtils.removeUnauthorizedDataForRead(this.access, insertedRecord);
			response.data = [insertedRecord];
		}
	}

	// If there are errors then set success of response as false, else delete the key errors
	if (response.errors.length > 0) {
		response.success = false;
	} else {
		delete response.errors;
	}

	// And finally, send the response
	return response;
});


/* Update records
	@param authTokenId
	@param document
	@param data

	@TODO Faltam código de erros
*/
Meteor.registerMethod('data:update', 'withUser', 'withAccessForDocument', 'ifAccessIsUpdatable', 'withMetaForDocument', 'withModelForDocument', 'ifUpdateIsValid', 'processCollectionLogin', function(request) {
	let idMapItem, validateResult;
	let id;
	const context = this;
	const { meta } = this;
	const { model } = this;

	if ((this.access.changeUser !== true) && (__guard__(request.data != null ? request.data.data : undefined, x => x._user) != null)) {
		delete request.data.data._user;
	}

	const data = [];

	// Define response object to be populated later
	const response = {
		errors: [],
		success: true
	};

	// Separate queue from data
	const { queue } = request.data.data;

	// Define array to get all conditions of changed fields
	const fieldFilterConditions = [];

	// Validate if user have permission to update each field that he are trying
	for (var fieldName in request.data.data) {
		const accessField = accessUtils.getFieldPermissions(this.access, fieldName);
		if (accessField.isUpdatable !== true) {
			return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to update field ${fieldName}`);
		}

		// If there are condition in access for this field then add to array
		const accessFieldConditions = accessUtils.getFieldConditions(this.access, fieldName);
		if (accessFieldConditions.UPDATE != null) {
			fieldFilterConditions.push(accessFieldConditions.UPDATE);
		}
	}

	// Find records that we are trying to update
	// Map all passed ids to facilitate later access

	let query = {};

	// Define init filter
	const filter = {
		match: 'and',
		filters: []
	};

	// Add access update filter as sub filter
	if (_.isObject(this.access.updateFilter)) {
		filter.filters.push(this.access.updateFilter);
	}

	// Add field conditions as condition of filter
	if (fieldFilterConditions.length > 0) {
		filter.conditions = fieldFilterConditions;
	}

	// Parse filters
	const updateFilter = filterUtils.parseFilterObject(filter, meta, context);
	if (updateFilter instanceof Error) {
		this.notifyError('Update - Update Filter', updateFilter, request);
		return updateFilter;
	}

	// If there are filter then init query with this filter
	if (_.isObject(updateFilter) && (Object.keys(updateFilter).length > 0)) {
		query = updateFilter;
	}

	if ((query._id == null)) {
		query._id =
			{$in: []};
	}

	const idMap = {};

	// Add ids to filter
	for (var item of Array.from(request.data.ids)) {
		if (((query._id != null ? query._id.$in : undefined) != null) && _.isArray(query._id.$in)) {
			query._id.$in.push(item._id);
		}
		idMap[item._id] = item;
	}

	let options = {};

	if ((meta.scriptBeforeValidation == null) && (meta.validationScript == null) && (meta.scriptAfterSave == null)) {
		options = {
			fields: {
				_updatedAt: 1
			}
		};
	}

	const records = model.find(query, options).fetch();

	// Make a query with only _ids to verify if record does not exists or user does not have permission to view the record
	const existsQuery =
		{_id: query._id};

	const existsOptions = {
		fields: {
			_id: 1
		}
	};

	const existsRecords = model.find(existsQuery, existsOptions).fetch();
	const existsMap = {};

	for (let existsRecord of Array.from(existsRecords)) {
		existsMap[existsRecord._id] = existsRecord;
	}


	// Mark ids that exist on database and mark all out of date ids to later use
	for (var record of Array.from(records)) {
		idMapItem = idMap[record._id];
		if (idMapItem != null) {
			idMapItem.exists = true;
			idMapItem.record = record;

			if (meta.ignoreUpdatedAt !== true) {
				if (record._updatedAt.getTime() !== (new Date(idMapItem._updatedAt.$date)).getTime()) {
					idMapItem.outOfDate = true;
				}
			}
		}
	}

	// Verify if records that was marked as unexistent was only anaccessible by user
	for (id in idMap) {
		idMapItem = idMap[id];
		if (idMapItem.exists !== true) {
			idMapItem.userDontHasPermission = (existsMap[id] != null);
		}
	}

	// Create query to get history of out-of-date records that was updated after passed date and has at least one of passed fields
	const outOfDateQuery = [];

	const mapOfFieldsToUpdateForHistoryQuery = [];

	for (fieldName in request.data.data) {
		item = {};
		item[`diffs.${fieldName}`] = {$exists: 1};
		mapOfFieldsToUpdateForHistoryQuery.push(item);
	}

	// If id doesn't exists return an error and remove id from ids map
	// If id is out-of-date add to history query
	for (id in idMap) {
		idMapItem = idMap[id];
		if (idMapItem.exists !== true) {
			if (idMapItem.userDontHasPermission === true) {
				response.errors.push(new Meteor.Error('internal-error', `Sem premissão para atualizar o dado ${id}`, {bugsnag: false}));
			} else {
				response.errors.push(new Meteor.Error('internal-error', `Id [${id}] de dado inválido. Não existe dado em [${request.document}] para o id passado: ${id}`));
			}

			delete idMap[id];

		} else if (idMapItem.outOfDate === true) {
			outOfDateQuery.push({
				dataId: id,
				createdAt: {
					$gt: new Date(idMapItem._updatedAt.$date)
				},
				$or: mapOfFieldsToUpdateForHistoryQuery
			});
		}
	}

	// If there are out-of-date ids execute query
	if (outOfDateQuery.length > 0) {
		const outOfDateRecords = Models[`${request.document}.History`].find({$or: outOfDateQuery}).fetch();

		// If there are history process them
		if (outOfDateRecords.length > 0) {
			// Get firs of each record by id
			const outOfDateRecordsByDataId = {};
			for (let outOfDateRecord of Array.from(outOfDateRecords)) {
				if (outOfDateRecordsByDataId[outOfDateRecord.dataId] == null) { outOfDateRecordsByDataId[outOfDateRecord.dataId] = outOfDateRecord; }
			}

			// Iterate over ids map and verify if there are history results for each id
			for (id in idMap) {
				idMapItem = idMap[id];
				if (outOfDateRecordsByDataId[id] != null) {
					// Iterate over passed data to verify the first field that has been updated, return an error and remove id from id map
					for (fieldName in request.data.data) {
						if (outOfDateRecordsByDataId[id].diffs[fieldName] != null) {
							response.errors.push(new Meteor.Error('internal-error', `O Campo ${fieldName} do dado com id ${id} que está tentando salvar está desatualizado. A Modificação foi feita por [${outOfDateRecordsByDataId[id].createdBy.name}] at [${outOfDateRecordsByDataId[id].createdAt.toISOString()}]`));
							delete idMap[id];
						}
					}
				}
			}
		}
	}

	// Iterate over id map to create an array with ObjectIds to execute update query
	const idsToUpdate = [];
	const recordsToUpdate = [];
	for (id in idMap) {
		idMapItem = idMap[id];
		if (idMapItem.exists === true) {
			idsToUpdate.push(id);
			recordsToUpdate.push(idMapItem.record);
		}
	}

	let updatedIds = [];

	const validateAndUpdateRecords = records => {
		// After all validations
		// Init update object
		let bodyData, resultOfValidation, value;
		const update = {
			$set: {},
			$unset: {}
		};

		// Ignore history by default. If any field have ignoreHistory different from true then set as false
		let ignoreHistory = true;

		const validatedData = {};
		// Validate and process lookups first to inherit data before validation
		for (var key in request.data.data) {
			value = request.data.data[key];
			if (validatedData[key] === undefined) {
				if ((meta.fields[key] != null ? meta.fields[key].type : undefined) === 'lookup') {
					resultOfValidation = metaUtils.validateAndProcessValueFor(meta, key, value, 'update', model, request.data.data, validatedData, idsToUpdate);
					if (resultOfValidation instanceof Error) {
						return resultOfValidation;
					}
					if (resultOfValidation !== undefined) {
						validatedData[key] = resultOfValidation;
						if (meta.fields[key].ignoreHistory !== true) {
							ignoreHistory = false;
						}
					}
				}
			}
		}

		// If meta includes scriptBeforeValidation, run it in a sandboxed environment and extend body with its results
		if (meta.scriptBeforeValidation != null) {
			const extraData = {
				original: records[0],
				request: request.data.data,
				validated: validatedData
			};
			bodyData = _.extend(request.data.data, utils.runScriptBeforeValidation(meta.scriptBeforeValidation, _.extend({}, records[0], request.data.data, validatedData), context, extraData));
		} else {
			bodyData = _.extend({}, request.data.data);
		}

		// Iterate over passed data and decide to set or unset each field
		for (key in bodyData) {
			value = bodyData[key];
			if (validatedData[key] === undefined) {
				resultOfValidation = metaUtils.validateAndProcessValueFor(meta, key, value, 'update', model, bodyData, validatedData, idsToUpdate);
				if (resultOfValidation instanceof Error) {
					this.notifyError('Update - Validation Error', resultOfValidation, request);
					return resultOfValidation;
				}
				if (resultOfValidation !== undefined) {
					validatedData[key] = resultOfValidation;
					if (meta.fields[key].ignoreHistory !== true) {
						ignoreHistory = false;
					}
				}
			}
		}

		// If meta includes validationScript, run it in a sandboxed environment
		if (meta.validationScript != null) {
			const validation = processValidationScript(meta.validationScript, meta.validationData, _.extend({}, records[0], validatedData), context);
			if ((validation != null ? validation.success : undefined) !== true) {
				const error = new Meteor.Error(validation.reason);
				this.notifyError('Update - Script Validation Error', error, request);
				return error;
			}
		}

		for (key in validatedData) {
			value = validatedData[key];
			if (value !== undefined) {
				if (value === null) {
					update.$unset[key] = 1;
				} else {
					update.$set[key] = value;
				}
			}
		}

		// If there are no data to set remove the $set item
		if (Object.keys(update.$set).length === 0) {
			delete update.$set;
		}

		// If there are no data to unset remove the $unset item
		if (Object.keys(update.$unset).length === 0) {
			delete update.$unset;
		}

		// If there are ids to execute the update and if update has data, then execute
		if ((records.length > 0) && (Object.keys(update).length > 0)) {
			// Define _updatedAt to current date and time and _updatedBy to current user
			if (ignoreHistory !== true) {
				if (update.$set == null) { update.$set = {}; }
				update.$set._updatedAt = new Date;
				update.$set._updatedBy = {
					_id: this.user._id,
					name: this.user.name,
					group: this.user.group,
					ts: update.$set._updatedAt
				};
			}

			// Define update query
			query = {
				_id: {
					$in: []
				}
			};

			for (record of Array.from(records)) {
				query._id.$in.push(record._id);
			}

			// Execute update
			try {
				model.updateMany(query, update);
				return updatedIds = updatedIds.concat(query._id.$in);
			} catch (e) {
				NotifyErrors.notify('DataUpdateError', e);
				return e;
			}
		}
	};

	if ((meta.scriptBeforeValidation != null) || (meta.validationScript != null)) {
		for (let recordToUpdate of Array.from(recordsToUpdate)) {
			validateResult = validateAndUpdateRecords([recordToUpdate]);
			if (validateResult instanceof Error) {
				this.notifyError('Update - Validation Error', validateResult, request);
				return validateResult;
			}
		}
	} else {
		validateResult = validateAndUpdateRecords(recordsToUpdate);
		if (validateResult instanceof Error) {
			this.notifyError('Update - Validation Error', validateResult, request);
			return validateResult;
		}
	}

	if (updatedIds.length > 0) {
		// Call hooks
		if (!_.isEmpty(Namespace.onUpdate)) {
			const ids = ((() => {
				const result = [];
				for (id of Array.from(idsToUpdate)) { 					result.push(id.valueOf());
				}
				return result;
			})());

			const hookData = {
				action: 'update',
				ns: Namespace.ns,
				documentName: request.document,
				user: _.pick(this.user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale']),
				data: model.find(query).fetch() // Find records before apply access filter to query
			};

			const urls = [].concat(Namespace.onUpdate);
			for (var url of Array.from(urls)) {
				if (!_.isEmpty(url)) {
					url = url.replace('${dataId}', ids.join(','));
					url = url.replace('${documentId}', `${Namespace.ns}:${request.document}`);

					httpRequest.post({ url, json: hookData }, function(err, response) {
						if (err != null) {
							NotifyErrors.notify('HookOnUpdateError', err);
							return console.log("📠 ", `UPDATE ERROR ${url}`.red, err);
						}

						if (response.statusCode === 200) {
							return console.log("📠 ", `${response.statusCode} UPDATE ${url}`.green);
						} else {
							return console.log("📠 ", `${response.statusCode} UPDATE ${url}`.red);
						}
					});
				}
			}
		}

		// Apply read access filter
		if (_.isObject(this.access.readFilter)) {
			const readFilter = filterUtils.parseFilterObject(this.access.readFilter, meta, context);
			if (readFilter instanceof Error) {
				this.notifyError('Update - Validation Error', readFilter, {accessFilter: this.access.readFilter});
				response.errors.push(readFilter);
			} else {
				query =
					{$and: [query, readFilter]};
			}
		}

		// Find all update records
		const updatedRecords = model.find(query).fetch();

		if (meta.scriptAfterSave != null) {
			const extraData =
				{original: records};
			utils.runScriptAfterSave(meta.scriptAfterSave, updatedRecords, context, extraData);
		}

		// Set update reords to response object
		response.data = [];
		for (let updatedRecord of Array.from(updatedRecords)) {
			response.data.push(accessUtils.removeUnauthorizedDataForRead(this.access, updatedRecord));
		}
	}

	// If there are errors then set success of response as false, else delete the key errors
	if (response.errors.length > 0) {
		response.success = false;
	} else {
		delete response.errors;
	}

	// And finally, send the response
	return response;
});


/* Delete records
	@param authTokenId
	@param document
	@param data
*/
Meteor.registerMethod('data:delete', 'withUser', 'withAccessForDocument', 'ifAccessIsDeletable', 'withMetaForDocument', 'withModelForDocument', function(request) {
	let idMapItem;
	let id;
	const context = this;

	const data = [];

	// Define response object to be populated later
	const response = {
		errors: [],
		success: true
	};

	// Some validations of payload
	if (!_.isObject(request.data)) {
		return new Meteor.Error('internal-error', `[${request.document}] Invalid payload`);
	}

	if (!_.isArray(request.data.ids) || (request.data.ids.length === 0)) {
		return new Meteor.Error('internal-error', `[${request.document}] Payload must contain an array of ids with at least one item`);
	}

	const { meta } = this;

	for (var item of Array.from(request.data.ids)) {
		if (!_.isObject(item) || !_.isString(item._id)) {
			return new Meteor.Error('internal-error', `[${request.document}] Each id must contain an valid _id`);
		}

		if (meta.ignoreUpdatedAt !== true) {
			if (!_.isObject(item) || !_.isObject(item._updatedAt) || !_.isString(item._updatedAt.$date)) {
				return new Meteor.Error('internal-error', `[${request.document}] Each id must contain an date field named _updatedAt`);
			}
		}
	}

	const { model } = this;

	// Try to get trash model of document
	const trashModel = Models[`${request.document}.Trash`];
	if ((trashModel == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Document ${request.document}.Trash does not exists`);
	}

	// Find records that we are trying to update
	// Map all passed ids to facilitate later access

	let query = {};

	if (_.isObject(this.access.deleteFilter)) {
		const deleteFilter = filterUtils.parseFilterObject(this.access.deleteFilter, meta, context);
		if (deleteFilter instanceof Error) {
			this.notifyError('Delete - Validation Error', deleteFilter, request);
			return deleteFilter;
		}

		query = deleteFilter;
	}

	if ((query._id == null)) {
		query._id =
			{$in: []};
	}

	const idMap = {};

	for (item of Array.from(request.data.ids)) {
		if (((query._id != null ? query._id.$in : undefined) != null) && _.isArray(query._id.$in)) {
			query._id.$in.push(item._id);
		}
		idMap[item._id] = item;
	}

	const options = {};
		// fields:
		// 	_updatedAt: 1

	const records = model.find(query, options).fetch();

	// Make a query with only _ids to verify if record does not exists or user does not have permission to view the record
	const existsQuery =
		{_id: query._id};

	const existsOptions = {
		fields: {
			_id: 1
		}
	};

	const existsRecords = model.find(existsQuery, existsOptions).fetch();
	const existsMap = {};

	for (let existsRecord of Array.from(existsRecords)) {
		existsMap[existsRecord._id] = existsRecord;
	}

	// Mark ids that exists on database and mark all out of date ids to later use
	for (var record of Array.from(records)) {
		idMapItem = idMap[record._id];
		if (idMapItem != null) {
			idMapItem.exists = true;

			if (meta.ignoreUpdatedAt !== true) {
				if (record._updatedAt.getTime() !== (new Date(idMapItem._updatedAt.$date)).getTime()) {
					idMapItem.outOfDate = true;
				}
			}
		}
	}

	// Verify if records that was marked as unexistent was only anaccessible by user
	for (id in idMap) {
		idMapItem = idMap[id];
		if (idMapItem.exists !== true) {
			idMapItem.userDontHasPermission = (existsMap[id] != null);
		}
	}

	// If id doesn't exists return an error and remove id from ids map
	for (id in idMap) {
		idMapItem = idMap[id];
		if (idMapItem.exists !== true) {
			if (idMapItem.userDontHasPermission === true) {
				response.errors.push(new Meteor.Error('internal-error', `Sem premissão para ver o dado ${id}`));
			} else {
				response.errors.push(new Meteor.Error('internal-error', `Id [${id}] de dado inválido. Não existe dado em [${request.document}] para o id passado: ${id}`));
			}

			delete idMap[id];

		} else if (idMapItem.outOfDate === true) {
			response.errors.push(new Meteor.Error('internal-error', `Existe uma versão mais nova do dado que a que está tentando apagar [${id}]. Tente atualizar a tela e tente apagar novamente.`, {bugsnag: false}));

			delete idMap[id];
		}
	}

	// Iterate over id map to create an array with ObjectIds to verify relations
	const idsToVerifyRelations = [];
	for (id in idMap) {
		idMapItem = idMap[id];
		if (idMapItem.exists === true) {
			idsToVerifyRelations.push(id);
		}
	}


	// Get references of document
	const references = References[request.document];

	// If exist references
	if (_.isObject(references) && _.isObject(references.from)) {
		for (let referenceMetaName in references.from) {
			// Get model
			const referenceMeta = references.from[referenceMetaName];
			const referenceModel = Models[referenceMetaName];

			if (referenceModel != null) {
				// Define an array to multiple conditions
				const referenceConditions = [];
				// Get all fields that reference this meta and create one condition with all ids
				for (let referenceFieldName in referenceMeta) {
					const referenceField = referenceMeta[referenceFieldName];
					const condition = {};

					const ref = referenceFieldName;

					condition[`${ref}._id`] =
						{$in: idsToVerifyRelations};

					referenceConditions.push(condition);
				}

				// If there are references of this meta
				if (referenceConditions.length > 0) {
					// Set up a query with all conditions using operator "or"
					let referenceQuery =
						{$or: referenceConditions};

					let referenceQueryOptions = {
						fields: {
							_id: 1
						}
					};

					// Get first result
					let referenceResult = referenceModel.findOne(referenceQuery, referenceQueryOptions);

					// If there are result got ahead and find problems for each record
					if (referenceResult != null) {
						// For each id
						for (id of Array.from(idsToVerifyRelations)) {
							// Change all conditions
							for (let referenceCondition of Array.from(referenceConditions)) {
								// To set the unique property as one id condition
								referenceCondition[Object.keys(referenceCondition)[0]] = id;
							}

							// Define query to all field references of this id
							referenceQuery =
								{$or: referenceConditions};

							referenceQueryOptions = {
								fields: {
									_id: 1
								}
							};

							// Execute query
							referenceResult = referenceModel.findOne(referenceQuery, referenceQueryOptions);

							// If there are results
							if (referenceResult != null) {
								// Add error to response
								response.errors.push(new Meteor.Error('internal-error', `Não é possivel apagar o dado com id:[${request.document}] pois existem dados referenciando o mesmo do modulo [${referenceMetaName}].`, {bugsnag: false}));

								// And delete data from idMap
								delete idMap[id];
							}
						}
					}
				}
			}
		}
	}

	// Iterate over records to get only records that was valid to delete to save them into trash
	const recordsToSaveInTrash = [];
	for (record of Array.from(records)) {
		if ((idMap[record._id] != null ? idMap[record._id].exists : undefined) === true) {
			recordsToSaveInTrash.push(record);
		}
	}


	// Iterate over id map to create an array with ObjectIds to execute delete query
	const idsToDelete = [];
	for (id in idMap) {
		idMapItem = idMap[id];
		if (idMapItem.exists === true) {
			idsToDelete.push(id);
		}
	}

	// If there are ids to execute the delete, then execute
	if (idsToDelete.length > 0) {
		// Define delete query
		let e;
		query = {
			_id: {
				$in: idsToDelete
			}
		};

		// Save every record into trash
		for (record of Array.from(recordsToSaveInTrash)) {
			// Add information about how and when record was sent to trash
			record._deletedAt = new Date();
			record._deletedBy = {
				_id: this.user._id,
				name: this.user.name,
				group: this.user.group
			};

			try {
				trashModel.insert(record);
			} catch (error) {
				e = error;
				NotifyErrors.notify('TrashInsertError', e, {record});
			}
		}

		// Execute delete
		try {
			model.remove(query);
		} catch (error1) {
			e = error1;
			NotifyErrors.notify('DataDeleteError', e, {query});
			return e;
		}

		// Call hooks
		if (!_.isEmpty(Namespace.onDelete)) {
			const ids = ((() => {
				const result = [];
				for (id of Array.from(idsToDelete)) { 					result.push(id.valueOf());
				}
				return result;
			})());

			const hookData = {
				action: 'delete',
				ns: Namespace.ns,
				documentName: request.document,
				user: _.pick(this.user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale']),
				data: recordsToSaveInTrash
			};

			const urls = [].concat(Namespace.onDelete);
			for (var url of Array.from(urls)) {
				if (!_.isEmpty(url)) {
					url = url.replace('${dataId}', ids.join(','));
					url = url.replace('${documentId}', `${Namespace.ns}:${request.document}`);

					httpRequest.post({ url, json: hookData }, function(err, response) {
						if (err != null) {
							NotifyErrors.notify('HookOnDeleteError', err);
							return console.log("📠 ", `DELETE ERROR ${url}`.red, err);
						}

						if (response.statusCode === 200) {
							return console.log("📠 ", `${response.statusCode} DELETE ${url}`.green);
						} else {
							return console.log("📠 ", `${response.statusCode} DELETE ${url}`.red);
						}
					});
				}
			}
		}

		// Set ids to response object
		response.data = idsToDelete;
	}

	// If there are errors then set success of response as false, else delete the key errors
	if (response.errors.length > 0) {
		response.success = false;
	} else {
		delete response.errors;
	}

	// And finally, send the response
	return response;
});


/* Create relation
	@param authTokenId
	@param document
	@param fieldName
	@param data
*/
Meteor.registerMethod('data:relation:create', 'withUser', 'withAccessForDocument', function(request) {
	let data, reverseLookupModel;
	const context = this;

	// Try to get metadata
	const meta = Meta[request.document];
	if ((meta == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Document does not exists`);
	}

	// Try to get field of relation
	const field = meta.fields[request.fieldName];
	if ((field == null)) {
		return new Meteor.Error('internal-error', `[${request.document}] Field ${request.fieldName} does not exists`);
	}

	// Verify if type of field is filter
	if (field.type !== 'filter') {
		return new Meteor.Error('internal-error', `[${request.document}] Field ${request.fieldName} must be of type filter`);
	}

	// Verofy if field has relations
	if (!_.isArray(field.relations) || (field.relations.length === 0)) {
		return new Meteor.Error('internal-error', `[${request.document}] Field ${request.fieldName} must contains a property [relations] as array with at least one item`);
	}

	// Some validations of payload
	if (!_.isObject(request.data)) {
		return new Meteor.Error('internal-error', `[${request.document}] Invalid payload`);
	}

	if (!_.isObject(request.data) || !_.isArray(request.data.lookups) || !_.isArray(request.data.reverseLookups)) {
		return new Meteor.Error('internal-error', `[${request.document}] Payload must contain an object with properties [lookup] and [reverseLookups] as arrays`);
	}

	/*
	 * @TODO Get relation from request
	 */
	let relation = field.relations[0];

	for (let metaRelation of Array.from(field.relations)) {
		if (metaRelation.email != null) {
			relation = metaRelation;
			break;
		}
	}

	// Define response
	const response = {
		success: true,
		data: [],
		errors: []
	};

	if (request.data.data == null) { request.data.data = {}; }

	const sendEmail = ((request.data != null ? request.data.email : undefined) != null) && (request.data.email === true);
	const emailData = {};

	if (sendEmail) {
		reverseLookupModel = Models[Meta[relation.document].fields[relation.reverseLookup].document];
	}

	// Do a N x N loop to create all records of relation
	for (let lookup of Array.from(request.data.lookups)) {
		for (let reverseLookup of Array.from(request.data.reverseLookups)) {
			// Clone extra data
			var newData, populateFields;
			data = JSON.parse(JSON.stringify(request.data.data));

			if (relation.lookupField != null) {
				const lookupData = Models[field.document].findOne(lookup);
				lookup = utils.getObjectPathAgg(lookupData, relation.lookupField);
			}

			// Define lookups of relation
			data[relation.lookup] =
				{_id: lookup};

			data[relation.reverseLookup] =
				{_id: reverseLookup};

			if (sendEmail) {
				if (emailData[Meta[relation.document].fields[relation.reverseLookup].document] == null) { emailData[Meta[relation.document].fields[relation.reverseLookup].document] = []; }
				if ((reverseLookupModel != null) && !_.findWhere(emailData[Meta[relation.document].fields[relation.reverseLookup].document], { _id: reverseLookup })) {

					const reverseLookupData = reverseLookupModel.findOne({ _id: reverseLookup });
					metaUtils.populateLookupsData(Meta[relation.document].fields[relation.reverseLookup].document, reverseLookupData, { _user: 1, contact: 1 });

					emailData[Meta[relation.document].fields[relation.reverseLookup].document].push(reverseLookupData);
				}
			}

			let upsert = {};
			upsert[`${relation.lookup}._id`] = lookup;
			upsert[`${relation.reverseLookup}._id`] = reverseLookup;
			upsert = {$and: [upsert]};

			// generates fake new data and fetch relation data to preview
			if (sendEmail && request.preview) {
				if (emailData[relation.document] == null) { emailData[relation.document] = []; }

				populateFields = {};
				populateFields[relation.lookup] = 1;

				newData = _.clone(data);
				newData['_id'] = Random.id();

				metaUtils.populateLookupsData(relation.document, newData, populateFields);

				emailData[relation.document].push(newData);
			} else {
				// Create record
				const result = Meteor.call('data:create', {
					authTokenId: request.authTokenId,
					document: relation.document,
					data,
					upsert
				}
				);

				if (_.isNumber(result)) {
					return result;
				}

				// If result is an error return
				if (result instanceof Error) {
					this.notifyError('Relations - Lookup Error', result, request);
					return result;
				}

				// If there are data than concat with existent data
				if (_.isArray(result.data)) {
					response.data = response.data.concat(result.data);

					if (sendEmail) {
						if (emailData[relation.document] == null) { emailData[relation.document] = []; }

						populateFields = {};
						populateFields[relation.lookup] = 1;
						result.data.forEach(function(resultData) {
							newData = JSON.parse(JSON.stringify(resultData));

							metaUtils.populateLookupsData(relation.document, newData, populateFields);

							return emailData[relation.document].push(newData);
						});
					}
				}

				// If there are erros than concat with existent errors
				if (_.isArray(result.errors)) {
					response.errors = response.errors.concat(result.errors);
				}

				// If success is false define response success as false
				if (result.success === false) {
					response.success = false;
				}
			}
		}
	}

	if (sendEmail && ((emailData[relation.document] != null ? emailData[relation.document].length : undefined) > 0)) {
		const objectByString = function(o, s) {
			s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
			s = s.replace(/^\./, ''); // strip a leading dot
			const a = s.split('.');
			let i = 0;
			const n = a.length;
			while (i < n) {
				const k = a[i];
				if (k in o) {
					o = o[k];
				} else {
					return;
				}
				++i;
			}
			return o;
		};

		if ((relation.emailConf != null ? relation.emailConf.extraData : undefined) != null) {
			for (let fieldEmail in relation.emailConf.extraData) {
				const findEmailData = relation.emailConf.extraData[fieldEmail];
				const record = Meteor.call('data:find:all', findEmailData);

				if (record.success === true) {
					emailData[fieldEmail] = record.data;
				}
			}
		}

		emailData['request'] = request.data.data;

		const createdByUser = {};
		utils.copyObjectFieldsByPathsIncludingIds(this.user, createdByUser, Meta['Message'].fields['_createdBy'].descriptionFields);

		const updatedByUser = {};
		utils.copyObjectFieldsByPathsIncludingIds(this.user, updatedByUser, Meta['Message'].fields['_updatedBy'].descriptionFields);

		const userOwner = {};
		utils.copyObjectFieldsByPathsIncludingIds(this.user, userOwner, Meta['Message'].fields['_user'].descriptionFields);

		const messageData = {
			data: emailData,
			type: 'Email',
			status: 'Send',
			_createdAt: new Date(),
			_updatedAt: new Date(),
			_createdBy: createdByUser,
			_updatedBy: updatedByUser,
			_user: [ userOwner ]
		};

		if ((relation.emailConf != null ? relation.emailConf.template : undefined) != null) {
			messageData.template = relation.emailConf.template;
		}

		if ((relation.emailConf != null ? relation.emailConf.server : undefined) != null) {
			messageData.server = relation.emailConf.server;
		}

		// find a contact on source data of relation
		if (((Meta['Message'].fields['contact'] != null ? Meta['Message'].fields['contact'].descriptionFields : undefined) != null) && ((relation.emailConf != null ? relation.emailConf.contact : undefined) != null)) {
			const emailContactData = {};
			const contactData = objectByString(emailData, relation.emailConf.contact);

			if (contactData != null) {
				if ((__guard__(contactData != null ? contactData.email : undefined, x => x.length) > 0) && ((messageData.to == null) || _.isEmpty(messageData.to))) {
					messageData.to = contactData.email[0].address;
				}

				utils.copyObjectFieldsByPathsIncludingIds(contactData, emailContactData, Meta['Message'].fields['contact'].descriptionFields);

				messageData.contact = [ emailContactData ];
			}
		}

		if (((Meta['Message'].fields['opportunity'] != null ? Meta['Message'].fields['opportunity'].descriptionFields : undefined) != null) && ((relation.emailConf != null ? relation.emailConf.opportunity : undefined) != null)) {
			const emailOpportunityData = {};

			utils.copyObjectFieldsByPathsIncludingIds(objectByString(emailData, relation.emailConf.opportunity), emailOpportunityData, Meta['Message'].fields['opportunity'].descriptionFields);

			messageData.opportunity = emailOpportunityData;
		}

		// simulates a render by konsistent.mailConsumer
		if (request.preview) {
			return renderTemplate(messageData.template, _.extend({ message: { _id: Random.id() } }, emailData));
		}

		Models['Message'].insert(messageData);
	}

	// Remove array of data if it's empty
	if (response.data.length === 0) {
		delete response.data;
	}

	// Remove array of errors if it's empty
	if (response.errors.length === 0) {
		delete response.errors;
	}

	// Send response
	return response;
});

/* Save lead
	@param authTokenId
	@param data
	@param lead


KONDATA.call 'data:lead:save',
	lead:
		name: 'john doe'
		email: 'john.doe@konecty.com' (optional, but required if not phone)
		phone: '5130303030' ou [ '5130303030', '5133303030' ] (optional, but required if not email)
		broker: 'username' (optional)
		campaign: '_id' (optional)
		queue: '_id' (optional)
		extraFields: object (optional) -> other fields to be inserted, updated
	save: [
		document: 'Activity'
		data:
			subject: 'okokok'
	]

- Para salvar a lead eu recebo os seguintes dados:
	- Nome
	- Email
	- Telefone
	- Roleta
	- Campanha
	- Usuário responsável pelo contato (corretor)
- Com os dados informados, verifica se já existe um contato:
	- Primeiro busca um contato com o e-mail informado;
	- Se não achou com e-mail, busca um contato que possua o primeiro nome informado + telefone;
- Se achou um contato:
	- Atualiza o nome se o nome informado é maior que o existente;
	- Adiciona um possível novo e-mail;
	- Adiciona um possível novo telefone;
	- Atualiza a roleta;
	- Atualiza a campanha;
	- Se foi informado usuário responsável:
		- Adiciona o usuário informado como responsável do contato;
	- Se não informado usuário responsável:
		- Verifica se o contato possui uma oportunidade ativa:
			- Adiciona como responsável do contato o responsável ativo pela oportunidade atualizada mais recentemente.
		- Se não, se o contato possui uma atividade criada nos últimos 10 dias:
			- Adiciona como responsável do contato o responsável ativo pela atividade criada mais recentemente.
		- Se não, se foi informada uma roleta:
			- Adiciona como responsável do contato o próximo usuário da roleta informada.
		- Se não, verifica se a campanha informada possui uma roleta alvo:
			- Adiciona como responsável do contato o próximo usuário da roleta alvo da campanha.
*/
Meteor.registerMethod('data:lead:save', 'withUser', function(request) {
	let createRequest, record, result;
	const context = this;
	// meta = @meta

	console.log('data:lead:save ->'.yellow, global.Namespace.ns, '->'.green, JSON.stringify(request));

	// Some validations of payload
	if (!_.isObject(request.lead)) {
		return new Meteor.Error('internal-error', `[${request.document}] Invalid payload`);
	}

	// Define response
	const response = {
		success: true,
		data: [],
		errors: []
	};

	let phoneSent = [];
	if ((request.lead.phone != null) && !_.isEmpty(request.lead.phone)) {
		phoneSent = phoneSent.concat(request.lead.phone);
	}

	// validate if phone or email was passed
	if ((__guard__(request != null ? request.lead : undefined, x => x.email) == null) && (phoneSent.length === 0)) {
		response.success = false;
		response.errors = [ new Meteor.Error('data-lead-save-validation', "É obrigatório o preenchimento de ao menos um dos seguintes campos: email e telefone.") ];
		delete response.data;
		return response;
	}

	let contactUser = null;

	if (request.lead == null) { request.lead = {}; }

	let contact = null;

	// try to find a contact with given email
	if (request.lead.email != null) {
		// request.lead.email.some (email) ->
		record = Meteor.call('data:find:all', {
			document: 'Contact',
			filter: {
				conditions: [{
					term: 'email.address',
					operator: 'equals',
					value: request.lead.email
				}
				]
			},
			limit: 1
		}
		);

		if (__guard__(record != null ? record.data : undefined, x1 => x1[0]) != null) {
			contact = __guard__(record != null ? record.data : undefined, x2 => x2[0]);
		}
	}

	// If contact not found try to find with name and phone
	if ((contact == null) && (request.lead.name != null) && (phoneSent.length > 0)) {
		const regexName = _.first(_.words(request.lead.name));

		record = Meteor.call('data:find:all', {
			document: 'Contact',
			filter: {
				conditions: [{
					term: 'phone.phoneNumber',
					operator: 'equals',
					value: phoneSent[0]
				}
				, {
					term: 'name.full',
					operator: 'contains',
					value: regexName
				}
				]
			},
			limit: 1
		}
		);

		if (__guard__(record != null ? record.data : undefined, x3 => x3[0]) != null) {
			contact = __guard__(record != null ? record.data : undefined, x4 => x4[0]);
		}
	}

	let contactData = {};

	if (request.lead.name != null) {
		let setName = true;
		if (__guard__(contact != null ? contact.name : undefined, x5 => x5.full) != null) {
			if (request.lead.name.length < contact.name.full.length) {
				setName = false;
			}
		}

		if (setName) {
			const nameParts = _.words(request.lead.name);
			contactData.name = {
				first: _.first(nameParts),
				last: _.rest(nameParts).join(' ')
			};
		}
	}

	if (request.lead.email != null) {
		if (__guard__(contact != null ? contact.email : undefined, x6 => x6.length) > 0) {
			if (!_.findWhere(_.compact(contact.email), { address: request.lead.email })) {
				contactData.email = contact.email;
				contactData.email.push({
					address: request.lead.email});
			}
		} else if (!_.isEmpty(request.lead.email)) {
			contactData.email = [ {address: request.lead.email} ];
		}
	}

	if (phoneSent.length > 0) {
		if (__guard__(contact != null ? contact.phone : undefined, x7 => x7.length) > 0) {
			let firstPhoneNotFound = true;
			phoneSent.forEach(function(leadPhone) {
				if (!_.findWhere(_.compact(contact.phone), { phoneNumber: leadPhone })) {
					if (firstPhoneNotFound) {
						contactData.phone = contact.phone;
						firstPhoneNotFound = false;
					}

					return contactData.phone.push({
						countryCode: '55',
						phoneNumber: leadPhone
					});
				}
			});
		} else if (phoneSent.length > 0) {
			contactData.phone = [];

			phoneSent.forEach(leadPhone =>
				contactData.phone.push({
					countryCode: 55,
					phoneNumber: leadPhone
				})
			);
		}
	}

	// if no _user sent, _user will be set from users in queue
	if (request.lead.queue != null) { contactData.queue = { _id: request.lead.queue }; }

	if (request.lead.campaign != null) { contactData.campaign = { _id: request.lead.campaign }; }

	// Add extra fields to contactData
	if (request.lead.extraFields != null) { contactData = _.extend(contactData, request.lead.extraFields); }

	// controls if field _user was set to contact
	let addedUser = false;

	// sets _user based on the data sent
	if (request.lead.broker != null) {
		addedUser = true;

		record = Meteor.call('data:find:all', {
			document: 'User',
			filter: {
				conditions: [{
					term: 'username',
					operator: 'equals',
					value: request.lead.broker
				}
				]
			},
			fields: '_id',
			limit: 1
		}
		);

		if (__guard__(record != null ? record.data : undefined, x8 => x8.length) > 0) {
			if ((contact != null ? contact._user : undefined) != null) {
				if (!_.findWhere(_.compact(contact._user), { _id: record.data[0]._id })) {
					contactData._user = _.clone(contact._user);
					contactData._user.push({
						_id: record.data[0]._id});
				}
			} else {
				contactData._user = [ record.data[0] ];
			}

			// @TODO testar passando _user!!! array e não array
			contactUser =
				{_id: record.data[0]._id};
		}

	} else {
		// if a contact has been found try to set _user based on his opportunities and activities
		let userQueue;
		if (contact != null) {
			if (!addedUser && (contact.activeOpportunities != null) && ((contact != null ? contact.activeOpportunities : undefined) > 0)) {
				record = Meteor.call('data:find:all', {
					document: 'Opportunity',
					filter: {
						conditions: [{
							term: 'contact._id',
							operator: 'equals',
							value: contact._id
						}
						, {
							term: 'status',
							operator: 'in',
							value: [
								"Nova",
								"Ofertando Imóveis",
								"Em Visitação",
								"Proposta",
								"Contrato",
								"Pré-Reserva de Lançamentos"
							]
						}
						, {
							term: '_user.active',
							operator: 'equals',
							value: true
						}
						]
					},
					limit: 1,
					sort: [{
						property: '_updatedAt',
						direction: 'DESC'
					}
					],
					fields: '_id, _user'
				}
				);

				if (__guard__(__guard__(record != null ? record.data : undefined, x10 => x10[0]), x9 => x9._user) != null) {
					addedUser = true;

					contactUser = record.data[0]._user[0];

					// @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
					if (!_.findWhere(_.compact(contact._user), { _id: record.data[0]._user[0]._id })) {
						contactData._user = _.clone(contact._user);
						contactData._user.push(record.data[0]._user[0]);
					}
				}
			}

			// get recent activities from contact to find an _user
			if (!addedUser) {
				record = Meteor.call('data:find:all', {
					document: 'Activity',
					filter: {
						conditions: [{
							term: 'contact._id',
							operator: 'equals',
							value: contact._id
						}
						, {
							term: '_createdAt',
							operator: 'greater_or_equals',
							value: moment().subtract(10,'days').toDate()
						}
						, {
							term: '_user.active',
							operator: 'equals',
							value: true
						}
						]
					},
					limit: 1,
					sort: [{
						property: '_createdAt',
						direction: 'DESC'
					}
					],
					fields: '_id, _user'
				}
				);

				if (__guard__(__guard__(record != null ? record.data : undefined, x12 => x12[0]), x11 => x11._user) != null) {
					addedUser = true;

					contactUser = record.data[0]._user[0];

					// @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
					if (!_.findWhere(_.compact(contact._user), { _id: record.data[0]._user[0]._id })) {
						contactData._user = _.clone(contact._user);
						contactData._user.push(record.data[0]._user[0]);
					}
				}
			}
		}

		// if queue is set, set _user getting next user from queue sent
		if (!addedUser && (request.lead.queue != null)) {
			if (_.isString(request.lead.queue)) {
				userQueue = metaUtils.getNextUserFromQueue(request.lead.queue, this.user);

				addedUser = true;

				contactUser = userQueue.user;

				if ((userQueue.user != null ? userQueue.user._id : undefined) != null) {
					if (contact != null) {
						if (!_.findWhere(_.compact(contact._user), { _id: userQueue.user._id })) {
							contactData._user = _.clone(contact._user);
							contactData._user.push(userQueue.user);
						}
					} else {
						contactData._user = [ userQueue.user ];
					}
				}
			}
		}

		// if _user not set yet and campaign is set, try to find a queue set in campaign
		if (!addedUser && (request.lead.campaign != null)) {
			record = Meteor.call('data:find:all', {
				document: 'Campaign',
				filter: {
					conditions: [{
						term: '_id',
						operator: 'equals',
						value: request.lead.campaign
					}
					]
				},
				fields: '_id,targetQueue'
			}
			);

			if (__guard__(__guard__(record != null ? record.data : undefined, x14 => x14[0]), x13 => x13.targetQueue) != null) {
				// set targetQueue from campaign to contact if not set
				if ((contactData.queue == null)) {
					contactData.queue = { _id: record.data[0].targetQueue._id };
				}

				userQueue = metaUtils.getNextUserFromQueue(record.data[0].targetQueue._id, this.user);

				addedUser = true;

				contactUser = userQueue.user;

				if ((userQueue.user != null ? userQueue.user._id : undefined) != null) {
					if (contact != null) {
						if (!_.findWhere(_.compact(contact._user), { _id: userQueue.user._id })) {
							contactData._user = _.clone(contact._user);
							contactData._user.push(userQueue.user);
						}
					} else {
						contactData._user = [ userQueue.user ];
					}
				}
			}
		}
	}

	// sets _user with original data from contact if queue is set. prevents default behavior overwriting _user with next user from queue
	if (!addedUser && (contact != null)) {
		// some contacts doesn't have _user set, so set it to current request user
		if ((__guard__(contact._user != null ? contact._user[0] : undefined, x15 => x15._id) == null)) {
			contactData._user = [ { _id: this.user._id } ];
		} else if (contactData.queue != null) {
			contactData._user = _.clone(contact._user);
		}
	}

	// creates a contact if not found one
	if ((contact == null)) {
		createRequest = {
			document: 'Contact',
			data: contactData
		};

		// default data
		if ((contactData.status == null)) { createRequest.data.status = 'Lead'; }
		if ((contactData.type == null)) { createRequest.data.type = [ 'Cliente' ]; }

		console.log('[data:create] ->'.yellow, JSON.stringify(createRequest, null, '  '));

		result = Meteor.call('data:create', createRequest);
	} else if (!_.isEmpty(contactData)) {
		const updateRequest = {
			document: 'Contact',
			data: {
				ids: [ { _id: contact._id, _updatedAt: {$date: contact._updatedAt.toISOString()} } ],
				data: contactData
			}
		};

		console.log('[data:update] ->'.yellow, JSON.stringify(updateRequest, null, '  '));

		result = Meteor.call('data:update', updateRequest);
	} else {
		result = {
			success: true,
			data: [ contact ]
		};
	}

	if (_.isArray(result.errors)) {
		response.errors = response.errors.concat(result.errors);
	}

	if (result.success === false) {
		response.success = false;
	} else {
		response.data = result.data;

		const contactId = result.data[0]._id;

		// save other data sent
		if (request.save != null) {

			// set _user from created contact
			if (!addedUser) {
				contactUser = response.data[0]._user[0];
			}

			var saveRelations = (relations, contactId, parentObj) =>
				relations.some(function(saveObj) {
					createRequest = {
						document: saveObj.document,
						data: saveObj.data
					};

					if (__guard__(Meta[saveObj.document] != null ? Meta[saveObj.document].fields['contact'] : undefined, x16 => x16.isList) != null) {
						createRequest.data.contact = [
							{_id: contactId}
						];
					} else {
						createRequest.data.contact = {_id: contactId};
					}

					if (parentObj != null) {
						createRequest.data = _.extend(createRequest.data, parentObj);
					}

					// @TODO verificar no metodo do documento se o lookup de contato é isList para botar o array ou nao
					createRequest.data._user = [ contactUser ];

					const saveResult = Meteor.call('data:create', createRequest);

					// @TODO tratar os retornos
					if (saveResult.success === true) {
						response.data = response.data.concat(saveResult.data);

						if (saveObj.relations != null) {
							const relationMap = {};
							relationMap[saveObj.name] = { _id: saveResult.data[0]._id };

							return saveRelations(saveObj.relations, contactId, relationMap);
						}
					} else {
						return response.errors = response.errors.concat(saveResult.errors);
					}
				})
			;

			if (request.save != null) { saveRelations([].concat(request.save), contactId); }
		}
	}

	// Remove array of data if it's empty
	if (response.data.length === 0) {
		delete response.data;
	}

	// Remove array of errors if it's empty
	if (response.errors.length === 0) {
		delete response.errors;
	}

	// @TODO retornar apenas o campo _user que foi adicionado, e não todos caso o contato já exista e possua outro _user setado
	// if newUser? and response.data?.length > 0
	// 	response.data[0]._user = newUser

	// Send response
	return response;
});


var processValidationScript = function(validationScript, validationData, fullData, context) {
	const extraData = {};

	if (validationData != null) {
		for (let validationField in validationData) {
			const validationFilter = validationData[validationField];
			const validationDataFilter = JSON.parse(JSON.stringify(validationFilter));

			filterUtils.parseDynamicData(validationDataFilter, '$this', fullData);

			const record = Meteor.call('data:find:all', validationDataFilter);

			if (record.success === true) {
				extraData[validationField] = record.data;
			}
		}
	}

	return utils.runValidationScript(validationScript, fullData, context, extraData);
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}