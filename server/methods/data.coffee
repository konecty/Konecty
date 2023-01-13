import moment from 'moment';

httpRequest = require 'request'

### Get next user of queue
	@param authTokenId
	@param document
	@param queueId
###
Meteor.registerMethod 'data:queue:next', 'withUser', 'withAccessForDocument', (request) ->
	user = metaUtils.getNextUserFromQueue request.queueId, @user

	if not user?
		return success: false

	return success: true, user: user


### Get a list of records
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
###
Meteor.registerMethod 'data:find:all', 'withUser', 'withAccessForDocument', (request) ->
	context = @

	# Verify if user have permission to read records
	if context.access.isReadable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to read records"

	model = Models[request.document]
	if not model?
		return new Meteor.Error 'internal-error', "[#{request.document}] Document does not exists"

	fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind request.fields

	if fields?.$textScore?
		fields.$textScore = $meta: 'textScore'

	metaObject = Meta[request.document]

	query = {}

	# Define init filter
	filter =
		match: 'and'
		filters: []

	# If filter is not given, apply meta default filters
	if not _.isObject(request.filter) and request.displayName? and request.displayType?
		displayMeta = DisplayMeta["#{request.document}:#{request.displayType}:#{request.displayName}"]
		if displayMeta?.filter?
			filter.filters.push displayMeta.filter

	if _.isObject context.access.readFilter
		filter.filters.push context.access.readFilter

	if _.isObject request.filter
		filter.filters.push request.filter

	# Parse filters
	readFilter = filterUtils.parseFilterObject filter, metaObject, context
	if readFilter instanceof Error
		context.notifyError 'Find - Filter Error', readFilter, request
		return readFilter

	# If there are filter then init query with this filter
	if _.isObject(readFilter) and Object.keys(readFilter).length > 0
		query = readFilter

	if _.isObject(request.filter) and _.isString(request.filter.textSearch)
		query.$text =
			$search: request.filter.textSearch

	# Validate if user have permission to view each field
	emptyFields = Object.keys(fields).length is 0
	for fieldName of metaObject.fields
		accessField = accessUtils.getFieldPermissions context.access, fieldName
		if accessField.isReadable isnt true
			if emptyFields is true
				fields[fieldName] = 0
			else
				delete fields[fieldName]

	sort = {}
	if request.sort
		request.sort = JSON.parse(request.sort) if _.isString request.sort

		sort = sortUtils.parseSortArray request.sort
		if sort instanceof Error
			context.notifyError 'Find - Sort Error', sort, request
			return sort

	# Force money to filter with .value
	for key, value of sort
		if metaObject.fields[key]?.type is 'money'
			sort["#{key}.value"] = sort[key]
			delete sort[key]

		if metaObject.fields[key]?.type is 'personName'
			sort["#{key}.full"] = sort[key]
			delete sort[key]

		if key is '$textScore'
			if fields.$textScore?
				sort.$textScore = $meta: 'textScore'
			else
				delete sort.$textScore

	accessConditions = []

	for fieldName of metaObject.fields
		accessField = accessUtils.getFieldPermissions @access, fieldName
		if accessField.isReadable is true
			accessFieldConditions = accessUtils.getFieldConditions @access, fieldName
			if accessFieldConditions.READ?
				condition = filterUtils.parseFilterCondition accessFieldConditions.READ, metaObject, context, true
				if condition instanceof Error
					@notifyError 'FindOne - Access Filter Error', condition, {accessFilter: accessFieldConditions.READ}
					return condition

				accessConditions.push
					fieldName: fieldName
					condition: condition

				if (emptyFields is true and not fields[fieldName]?) or (emptyFields isnt true and fields[fieldName] is 1)
					conditionFields = Object.keys condition
					for conditionField in conditionFields
						if emptyFields is true
							delete fields[conditionField]
						else
							fields[conditionField] = 1

	options =
		limit: parseInt request.limit
		skip: parseInt request.start
		fields: fields
		sort: sort

	if _.isNaN(options.limit) or not options.limit?
		options.limit = 50
	
	if (options.limit >= 1000)
		options.sort =  { _id: 1 }

	records = model.find(query, options).fetch()

	local = collection: new Meteor.Collection null

	for record in records
		local.collection.insert record

	for accessCondition in accessConditions
		update = $unset: {}
		update.$unset[accessCondition.fieldName] = 1
		options = multi: true

		affected = local.collection.update accessCondition.condition, update, options

	records = local.collection.find().fetch()

	delete local.collection

	data =
		success: true
		data: records

	if request.getTotal is true
		data.total = model.find(query).count()

	if request.withDetailFields is 'true'
		for record, index in records
			populatedRecord = Meteor.call 'data:populate:detailFieldsInRecord',
				record: record
				document: request.document
				__scope__:
					user: @user
					access: @access

			if populatedRecord?
				records[index] = populatedRecord

	return data

### Get distinct field values from records
	@param authTokenId
	@param document
	@param field
###
Meteor.registerMethod 'data:find:distinct', 'withUser', 'withAccessForDocument', (request) ->
	context = @

	# Verify if user have permission to read records
	if context.access.isReadable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to read records"

	model = Models[request.document]
	if not model?
		return new Meteor.Error 'internal-error', "[#{request.document}] Document does not exists"

	if not _.isString request.field
		return new Meteor.Error 'internal-error', "[#{request.document}] field must be string"

	metaObject = Meta[request.document]

	query = {}

	# Define init filter
	filter =
		match: 'and'
		filters: []

	if _.isObject context.access.readFilter
		filter.filters.push context.access.readFilter

	# Parse filters
	readFilter = filterUtils.parseFilterObject filter, metaObject, context
	if readFilter instanceof Error
		context.notifyError 'Find - Filter Error', readFilter, request
		return readFilter

	# If there are filter then init query with this filter
	if _.isObject(readFilter) and Object.keys(readFilter).length > 0
		query = readFilter

	# Validate if user have permission to view field

	accessField = accessUtils.getFieldPermissions context.access, request.field
	if accessField.isReadable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to read field"

	options =
		fields: utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind request.field

	records = model.find(query, options).fetch()

	values = []
	_.each records, (item) ->
		value = utils.getObjectPathAgg item, request.field
		if _.isArray value
			_.each value, (_value) -> values.push _value
		else
			values.push value

	uniques = _.uniq _.compact values

	data =
		success: true
		data: uniques

	return data


### Get a record by id
	@param authTokenId
	@param document
	@param fields
	@param dataId
###
Meteor.registerMethod 'data:find:byId', 'withUser', 'withAccessForDocument', (request) ->
	context = @

	# Verify if user have permission to read records
	if @access.isReadable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to read records"

	model = Models[request.document]
	if not model?
		return new Meteor.Error 'internal-error', "[#{request.document}] Document does not exists"

	if not _.isString request.dataId
		return new Meteor.Error 'internal-error', "[#{request.document}] DataId must be string"

	metaObject = Meta[request.document]

	query = {}

	# Define init filter
	filter =
		match: 'and'
		filters: []

	if _.isObject @access.readFilter
		filter.filters.push @access.readFilter

	# Parse filters
	readFilter = filterUtils.parseFilterObject filter, metaObject, context
	if readFilter instanceof Error
		@notifyError 'Find - Filter Error', readFilter, request
		return readFilter

	# If there are filter then init query with this filter
	if _.isObject(readFilter) and Object.keys(readFilter).length > 0
		query = readFilter

	fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind request.fields

	# Validate if user have permission to view each field
	emptyFields = Object.keys(fields).length is 0
	for fieldName of metaObject.fields
		accessField = accessUtils.getFieldPermissions @access, fieldName
		if accessField.isReadable isnt true
			if emptyFields is true
				fields[fieldName] = 0
			else
				delete fields[fieldName]

	query._id = request.dataId

	accessConditions = []

	for fieldName of metaObject.fields
		accessField = accessUtils.getFieldPermissions @access, fieldName
		if accessField.isReadable is true
			accessFieldConditions = accessUtils.getFieldConditions @access, fieldName
			if accessFieldConditions.READ?
				condition = filterUtils.parseFilterCondition accessFieldConditions.READ, metaObject, context, true
				if condition instanceof Error
					@notifyError 'FindOne - Access Filter Error', condition, {accessFilter: accessFieldConditions.READ}
					return condition

				accessConditions.push
					fieldName: fieldName
					condition: condition

				if (emptyFields is true and not fields[fieldName]?) or (emptyFields isnt true and fields[fieldName] is 1)
					conditionFields = Object.keys condition
					for conditionField in conditionFields
						if emptyFields is true
							delete fields[conditionField]
						else
							fields[conditionField] = 1

	options =
		fields: fields

	data = model.findOne query, options

	if data?
		local = collection: new Meteor.Collection null

		local.collection.insert data

		for accessCondition in accessConditions
			update = $unset: {}
			update.$unset[accessCondition.fieldName] = 1
			options = multi: true

			affected = local.collection.update accessCondition.condition, update, options

		data = local.collection.find({}).fetch()

		delete local.collection

		if data? and request.withDetailFields is 'true'
			for record, index in data
				populatedRecord = Meteor.call 'data:populate:detailFieldsInRecord',
					record: record
					document: request.document
					__scope__:
						user: @user
						access: @access

				if populatedRecord?
					data[index] = populatedRecord

	else
		data = []

	return success: true, data: data, total: data.length


### Get a list of records from a lookup
	@param authTokenId
	@param document
	@param field
	@param search
	@param start
	@param limit
	@param useChangeUserFilter
###
Meteor.registerMethod 'data:find:byLookup', 'withUser', 'withAccessForDocument', (request) ->
	context = @

	meta = Meta[request.document]

	if not meta?
		return new Meteor.Error 'internal-error', "[#{request.document}] Document does not exists"

	field = meta.fields[request.field]
	if not field?
		return new Meteor.Error 'internal-error', "[#{request.document}] Field #{request.field} does not exists"

	model = Models[field.document]

	lookupMeta = Meta[field.document]

	if not model?
		return new Meteor.Error 'internal-error', "[#{request.document}] Document #{field.document} does not exists"
	
	try
		new RegExp(request.search)
	catch e
		return new Meteor.Error 'internal-error', "Invalid search [#{request.search}]"

	query = {}
	fields =
		_updatedAt: 1

	sort = {}

	if _.isArray field.descriptionFields
		conditions = []
		descriptionFields = field.descriptionFields

		if _.isArray field.searchableFields
			descriptionFields = descriptionFields.concat field.searchableFields

		sortArrayField = false

		for descriptionField in descriptionFields
			lookupField = lookupMeta.fields[descriptionField.split('.')[0]]

			if lookupField.type is 'picklist' or lookupField.isList is true
				unless sortArrayField
					sort[descriptionField] = 1
					sortArrayField = true
			else
				sort[descriptionField] = 1

			fields[descriptionField] = 1

			if _.isString(request.search) and request.search.length > 0
				condition = {}

				searchAsInt = String(parseInt(request.search)) is request.search

				if lookupField.type in ['number', 'autoNumber', 'money']
					floatValue = parseFloat request.search
					if floatValue? and not isNaN(floatValue)
						condition[descriptionField] = floatValue
				else if lookupField.type is 'address' and descriptionField is lookupField.name
					for addressField in ['country', 'state', 'city', 'place', 'number', 'postalCode', 'district', 'placeType', 'complement']
						c = {}
						c["#{descriptionField}.#{addressField}"] = {$regex: request.search, $options: 'i'}
						conditions.push c
				else
					if searchAsInt is false
						if lookupField.type in ['date', 'dateTime']
							condition[descriptionField] = new Date request.search
						else if lookupField.type isnt 'boolean'
							condition[descriptionField] = {$regex: request.search, $options: 'i'}

				if Object.keys(condition).length > 0
					conditions.push condition

		if conditions.length > 0
			query.$or = conditions

	if _.isArray field.inheritedFields
		for inheritedField in field.inheritedFields
			fields[inheritedField.fieldName] = 1

	# if field have access
	if field.access?
		# set base for access if doesn't exists
		if not @user.access?
			@user.access = {}

		# If no access for field document, set empty array
		if not @user.access[field.document]?
			@user.access[field.document] = []
		# Else, if value isn't array, convert to array
		else if not _.isArray @user.access[field.document]
			@user.access[field.document] = [@user.access[field.document]]

		# And finally add field access as first access value
		@user.access[field.document].unshift field.access

	# Find access for lookup list data
	access = accessUtils.getAccessFor field.document, @user

	# Define init filter
	filter =
		match: 'and'
		filters: []

	if request.useChangeUserFilter is true and _.isObject access.changeUserFilter
		filter.filters.push access.changeUserFilter

	else if _.isObject access.readFilter
		filter.filters.push access.readFilter

	if _.isObject(request.filter) and not _.isArray(request.filter)
		filter.filters.push request.filter

	# Parse filters
	readFilter = filterUtils.parseFilterObject filter, lookupMeta, context
	if readFilter instanceof Error
		@notifyError 'Lookup - Access Filter Error', readFilter, request
		return readFilter

	# If there are filter then add to query
	if _.isObject(readFilter) and Object.keys(readFilter).length > 0
		if Object.keys(query).length is 0
			query = readFilter
		else
			query = $and: [query, readFilter]

	# Validate if user have permission to view each field
	for fieldName, value of fields
		accessField = accessUtils.getFieldPermissions access, fieldName.split('.')[0]
		if accessField.isReadable isnt true
			delete fields[fieldName]

	options =
		limit: parseInt request.limit
		skip: parseInt request.start
		fields: fields
		sort: sort

	if _.isNaN(options.limit) or not options.limit?
		options.limit = 100

	data = model.find(query, options).fetch()
	total = model.find(query).count()

	return success: true, data: data, total: total


### Receive a record and populate with detail fields
	@param authTokenId
	@param document
	@param record
###
Meteor.registerMethod 'data:populate:detailFieldsInRecord', 'withUser', 'withAccessForDocument', (request) ->
	context = @
	if not request.record?
		return

	populateDetailFields = (field, value, parent) ->
		if not value?._id?
			return context.notifyError new Meteor.Error 'internal-error', 'populateDetailFields: value without _id', {field: field, value: value, document: request.document, parent: parent}

		record = Meteor.call 'data:find:byId',
			document: field.document
			fields: field.detailFields.join(',')
			dataId: value._id
			__scope__:
				user: context.user

		if record?.data?[0]?
			for recordKey, recordValue of record.data[0]
				value[recordKey] = recordValue

	metaObject = Meta[request.document]

	for fieldName, value of request.record
		field = metaObject.fields[fieldName]
		if value? and field? and field.type is 'lookup' and field.detailFields?.length > 0
			if field.isList is true
				populateDetailFields(field, item, value) for item in value
			else
				populateDetailFields field, value

	return request.record


### Create a new record
	@param authTokenId
	@param document
	@param data
###
Meteor.registerMethod 'data:create', 'withUser', 'withAccessForDocument', 'ifAccessIsCreateable', 'withMetaForDocument', 'withModelForDocument', 'ifCreateIsValid', 'processCollectionLogin', (request) ->
	context = @
	meta = @meta
	model = @model

	if request.data?._user?
		onlyMe = true

		for newUser in request.data._user
			if newUser._id isnt @user._id
				onlyMe = false

		if not onlyMe and @access.changeUser isnt true
			delete request.data._user

	# Define response object to be populated later
	response =
		errors: []
		success: true

	# Remove null values and empty strings
	delete request.data[key] for key, value of request.data when value is null or value is ''

	# Validate if user have permission to create each field that he are trying
	for fieldName of request.data
		accessField = accessUtils.getFieldPermissions @access, fieldName
		if accessField.isCreatable isnt true
			return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to create field #{fieldName}"

	# After all validations
	# Init newRecord object
	newRecord = {}

	# If no user was defined
	if not request.data._user?
		# Get user id from session
		userOid = @user._id

		# Test if was passed one queue
		queue = request.data.queue
		# TODO: Remove
		# Workaround to don't process queue for saves on QueueUser whiout user
		if meta.name isnt 'QueueUser'
			if _.isObject(queue) and _.isString(queue._id)
				# If yes, get next user from queue and override user of session
				userQueue = metaUtils.getNextUserFromQueue queue._id, @user
				if _.isObject userQueue
					userOid = userQueue.user._id.valueOf()

		# Define user of session or queue in correctly format
		request.data._user =
			_id: userOid

		# If user field is isList change format to array
		if meta.fields._user?.isList is true
			request.data._user = [request.data._user]

	# Validate and process lookups first to inherit data before validation
	for key, field of meta.fields when field.type is 'lookup'
		if newRecord[key] is undefined
			value = request.data[field.name]

			resultOfValidation = metaUtils.validateAndProcessValueFor meta, key, value, 'insert', model, request.data, newRecord
			if resultOfValidation instanceof Error
				response.errors.push resultOfValidation

			if resultOfValidation isnt undefined
				newRecord[key] = resultOfValidation

	# If meta includes scriptBeforeValidation, run it in a sandboxed environment and extend request.data with its results
	if meta.scriptBeforeValidation
		extraData =
			original: {}
			request: request.data
			validated: newRecord
		request.data = _.extend(request.data, utils.runScriptBeforeValidation(meta.scriptBeforeValidation, _.extend(request.data, newRecord), context, extraData))

	# Iterate over all fields, except autoNumbers, of meta to validate values and insert default values
	for key, field of meta.fields when field.type not in ['autoNumber']
		if newRecord[key] is undefined
			# Remove empty strings
			if request.data[field.name] is ''
				delete request.data[field.name]

			# If don't exists data for field and exists one default value into metadata, set default value
			if not request.data[field.name]? and field.defaultValue?
				request.data[field.name] = field.defaultValue

			# If don't exists data for field and exists default values into metadata, set default values
			if not request.data[field.name]? and field.defaultValues?.length > 0
				# Work around to fix picklist behavior
				if field.type is 'picklist'
					v = field.defaultValues[0]?.pt_BR
					if not v?
						k = Object.keys field.defaultValues[0]
						v = field.defaultValues[0][k[0]]
					request.data[field.name] = v
				else
					request.data[field.name] = field.defaultValues

			value = request.data[field.name]
			resultOfValidation = metaUtils.validateAndProcessValueFor meta, key, value, 'insert', model, request.data, newRecord
			if resultOfValidation instanceof Error
				@notifyError 'Create - Validation Error', resultOfValidation, request
				response.errors.push resultOfValidation

			if resultOfValidation isnt undefined
				newRecord[key] = resultOfValidation

	# If meta includes validationScript, run it in a sandboxed environment
	if meta.validationScript?
		validation = processValidationScript(meta.validationScript, meta.validationData, _.extend({}, request.data, newRecord), context)
		if validation?.success isnt true
			error = new Meteor.Error validation.reason
			@notifyError 'Create - Script Validation Error', error, request
			response.errors.push error

	# If no errors util now, iterate over autoNumber fields to generate codes
	if response.errors.length is 0
		for key, field of meta.fields when field.type is 'autoNumber'
			value = request.data[field.name]

			# Ignore autonumbers if requested
			if request.ignoreAutoNumber isnt true or not value
				resultOfValidation = metaUtils.validateAndProcessValueFor meta, key, value, 'insert', model, request.data, newRecord
				if resultOfValidation instanceof Error
					@notifyError 'Create - Validation Error', resultOfValidation, request
					response.errors.push resultOfValidation

				newRecord[key] = resultOfValidation
			else
				newRecord[key] = value

	for k in Object.keys newRecord
		# Don't save null and undefiend values
		if newRecord[k] is null or newRecord[k] is undefined
			delete newRecord[k]

	# If record has data, then execute
	if Object.keys(newRecord).length > 0 and response.errors.length is 0
		# Define _createdAt to current date and time and _createdBy to current user
		newRecord._createdAt = request.data._createdAt || new Date
		newRecord._createdBy = request.data._createdBy || {
			_id: @user._id
			name: @user.name
			group: @user.group
		}

		# Set _updatedAt and _updatedBy with same values of _createdAt _createdBy
		newRecord._updatedAt = request.data._updatedAt || newRecord._createdAt
		newRecord._updatedBy = request.data._updatedBy || newRecord._createdBy

		# If an id was passed, use it
		if request.data._id? and _.isString request.data._id
			newRecord._id = request.data._id

		# Execute insert
		try
			if _.isObject request.upsert
				updateOperation = { $setOnInsert: {}, $set: {} }
				if _.isObject request.updateOnUpsert
					for key, value of newRecord
						if newRecord.hasOwnProperty(key)
							if request.updateOnUpsert[key]
								updateOperation['$set'][key] = newRecord[key]
							else
								updateOperation['$setOnInsert'][key] = newRecord[key]
				else
					updateOperation['$setOnInsert'] = newRecord;

				if _.isEmpty(updateOperation['$set'])
					delete updateOperation['$set']

				if _.isEmpty(updateOperation['$setOnInsert'])
					delete updateOperation['$setOnInsert']

				insertResult = model.upsert request.upsert, updateOperation
				if insertResult.insertedId?
					insertResult = insertResult.insertedId
				else if insertResult.numberAffected > 0
					insertResult = model.findOne(request.upsert)?._id
			else
				insertResult = model.insert newRecord
		catch e 
			if e.code is 11000
				e = new Meteor.Error 'internal-error', "Erro ao inserir: registro já existe"
				NotifyErrors.notify 'catchErrors', e
				return e
			else
				NotifyErrors.notify 'DataInsertError', e
				return e


		query =
			_id: insertResult

		# Call hooks
		if not _.isEmpty Namespace.onCreate
			# Find record before apply access filter to query
			hookData =
				action: 'create'
				ns: Namespace.ns
				documentName: request.document
				user: _.pick(@user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale'])
				data: [ model.findOne query ] # Find records before apply access filter to query

			urls = [].concat Namespace.onCreate
			for url in urls when not _.isEmpty url
				url = url.replace '${dataId}', insertResult.valueOf()
				url = url.replace '${documentId}', "#{Namespace.ns}:#{request.document}"

				httpRequest.post { url: url, json: hookData }, (err, response) ->
					if err?
						NotifyErrors.notify 'HookOnCreateError', err
						return console.log "📠 ", "CREATE ERROR #{url}".red, err

					if response.statusCode is 200
						console.log "📠 ", "#{response.statusCode} CREATE #{url}".green
					else
						console.log "📠 ", "#{response.statusCode} CREATE #{url}".red

		# Apply read access filter
		if _.isObject @access.readFilter
			readFilter = filterUtils.parseFilterObject @access.readFilter, meta, context
			if readFilter instanceof Error
				@notifyError 'Create - Read Filter', readFilter, {accessFilter: @access.readFilter}
				response.errors.push readFilter
			else
				query =
					$and: [query, readFilter]

		# Find insertedRecord
		insertedRecord = model.findOne query

		if meta.scriptAfterSave?
			utils.runScriptAfterSave meta.scriptAfterSave, [insertedRecord], context

		# Set update reords to response object
		if _.isObject insertedRecord
			insertedRecord = accessUtils.removeUnauthorizedDataForRead @access, insertedRecord
			response.data = [insertedRecord]

	# If there are errors then set success of response as false, else delete the key errors
	if response.errors.length > 0
		response.success = false
	else
		delete response.errors

	# And finally, send the response
	return response


### Update records
	@param authTokenId
	@param document
	@param data

	@TODO Faltam código de erros
###
Meteor.registerMethod 'data:update', 'withUser', 'withAccessForDocument', 'ifAccessIsUpdatable', 'withMetaForDocument', 'withModelForDocument', 'ifUpdateIsValid', 'processCollectionLogin', (request) ->
	context = @
	meta = @meta
	model = @model

	if @access.changeUser isnt true and request.data?.data?._user?
		delete request.data.data._user

	data = []

	# Define response object to be populated later
	response =
		errors: []
		success: true

	# Separate queue from data
	queue = request.data.data.queue

	# Define array to get all conditions of changed fields
	fieldFilterConditions = []

	# Validate if user have permission to update each field that he are trying
	for fieldName of request.data.data
		accessField = accessUtils.getFieldPermissions @access, fieldName
		if accessField.isUpdatable isnt true
			return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to update field #{fieldName}"

		# If there are condition in access for this field then add to array
		accessFieldConditions = accessUtils.getFieldConditions @access, fieldName
		if accessFieldConditions.UPDATE?
			fieldFilterConditions.push accessFieldConditions.UPDATE

	# Find records that we are trying to update
	# Map all passed ids to facilitate later access

	query = {}

	# Define init filter
	filter =
		match: 'and'
		filters: []

	# Add access update filter as sub filter
	if _.isObject @access.updateFilter
		filter.filters.push @access.updateFilter

	# Add field conditions as condition of filter
	if fieldFilterConditions.length > 0
		filter.conditions = fieldFilterConditions

	# Parse filters
	updateFilter = filterUtils.parseFilterObject filter, meta, context
	if updateFilter instanceof Error
		@notifyError 'Update - Update Filter', updateFilter, request
		return updateFilter

	# If there are filter then init query with this filter
	if _.isObject(updateFilter) and Object.keys(updateFilter).length > 0
		query = updateFilter

	if not query._id?
		query._id =
			$in: []

	idMap = {}

	# Add ids to filter
	for item in request.data.ids
		if query._id?.$in? and _.isArray(query._id.$in)
			query._id.$in.push item._id
		idMap[item._id] = item

	options = {}

	if not meta.scriptBeforeValidation? and not meta.validationScript? and not meta.scriptAfterSave?
		options =
			fields:
				_updatedAt: 1

	records = model.find(query, options).fetch()

	# Make a query with only _ids to verify if record does not exists or user does not have permission to view the record
	existsQuery =
		_id: query._id

	existsOptions =
		fields:
			_id: 1

	existsRecords = model.find(existsQuery, existsOptions).fetch()
	existsMap = {}

	for existsRecord in existsRecords
		existsMap[existsRecord._id] = existsRecord


	# Mark ids that exist on database and mark all out of date ids to later use
	for record in records
		idMapItem = idMap[record._id]
		if idMapItem?
			idMapItem.exists = true
			idMapItem.record = record

			if meta.ignoreUpdatedAt isnt true
				if record._updatedAt.getTime() isnt (new Date(idMapItem._updatedAt.$date)).getTime()
					idMapItem.outOfDate = true

	# Verify if records that was marked as unexistent was only anaccessible by user
	for id, idMapItem of idMap
		if idMapItem.exists isnt true
			idMapItem.userDontHasPermission = existsMap[id]?

	# Create query to get history of out-of-date records that was updated after passed date and has at least one of passed fields
	outOfDateQuery = []

	mapOfFieldsToUpdateForHistoryQuery = []

	for fieldName of request.data.data
		item = {}
		item["diffs.#{fieldName}"] = $exists: 1
		mapOfFieldsToUpdateForHistoryQuery.push item

	# If id doesn't exists return an error and remove id from ids map
	# If id is out-of-date add to history query
	for id, idMapItem of idMap
		if idMapItem.exists isnt true
			if idMapItem.userDontHasPermission is true
				response.errors.push new Meteor.Error 'internal-error', "Sem premissão para atualizar o dado #{id}", bugsnag: false
			else
				response.errors.push new Meteor.Error 'internal-error', "Id [#{id}] de dado inválido. Não existe dado em [#{request.document}] para o id passado: #{id}"

			delete idMap[id]

		else if idMapItem.outOfDate is true
			outOfDateQuery.push
				dataId: id
				createdAt:
					$gt: new Date idMapItem._updatedAt.$date
				$or: mapOfFieldsToUpdateForHistoryQuery

	# If there are out-of-date ids execute query
	if outOfDateQuery.length > 0
		outOfDateRecords = Models["#{request.document}.History"].find($or: outOfDateQuery).fetch()

		# If there are history process them
		if outOfDateRecords.length > 0
			# Get firs of each record by id
			outOfDateRecordsByDataId = {}
			for outOfDateRecord in outOfDateRecords
				outOfDateRecordsByDataId[outOfDateRecord.dataId] ?= outOfDateRecord

			# Iterate over ids map and verify if there are history results for each id
			for id, idMapItem of idMap
				if outOfDateRecordsByDataId[id]?
					# Iterate over passed data to verify the first field that has been updated, return an error and remove id from id map
					for fieldName of request.data.data
						if outOfDateRecordsByDataId[id].diffs[fieldName]?
							response.errors.push new Meteor.Error 'internal-error', "O Campo #{fieldName} do dado com id #{id} que está tentando salvar está desatualizado. A Modificação foi feita por [#{outOfDateRecordsByDataId[id].createdBy.name}] at [#{outOfDateRecordsByDataId[id].createdAt.toISOString()}]"
							delete idMap[id]

	# Iterate over id map to create an array with ObjectIds to execute update query
	idsToUpdate = []
	recordsToUpdate = []
	for id, idMapItem of idMap
		if idMapItem.exists is true
			idsToUpdate.push id
			recordsToUpdate.push idMapItem.record

	updatedIds = []

	validateAndUpdateRecords = (records) =>
		# After all validations
		# Init update object
		update =
			$set: {}
			$unset: {}

		# Ignore history by default. If any field have ignoreHistory different from true then set as false
		ignoreHistory = true

		validatedData = {}
		# Validate and process lookups first to inherit data before validation
		for key, value of request.data.data
			if validatedData[key] is undefined
				if meta.fields[key]?.type is 'lookup'
					resultOfValidation = metaUtils.validateAndProcessValueFor meta, key, value, 'update', model, request.data.data, validatedData, idsToUpdate
					if resultOfValidation instanceof Error
						return resultOfValidation
					if resultOfValidation isnt undefined
						validatedData[key] = resultOfValidation
						if meta.fields[key].ignoreHistory isnt true
							ignoreHistory = false

		# If meta includes scriptBeforeValidation, run it in a sandboxed environment and extend body with its results
		if meta.scriptBeforeValidation?
			extraData =
				original: records[0]
				request: request.data.data
				validated: validatedData
			bodyData = _.extend {}, request.data.data, utils.runScriptBeforeValidation(meta.scriptBeforeValidation, _.extend({}, records[0], request.data.data, validatedData), context, extraData)
		else
			bodyData = _.extend {}, request.data.data

		# Iterate over passed data and decide to set or unset each field
		for key, value of bodyData
			if validatedData[key] is undefined
				resultOfValidation = metaUtils.validateAndProcessValueFor meta, key, value, 'update', model, bodyData, validatedData, idsToUpdate
				if resultOfValidation instanceof Error
					@notifyError 'Update - Validation Error', resultOfValidation, request
					return resultOfValidation
				if resultOfValidation isnt undefined
					validatedData[key] = resultOfValidation
					if meta.fields[key].ignoreHistory isnt true
						ignoreHistory = false

		# If meta includes validationScript, run it in a sandboxed environment
		if meta.validationScript?
			validation = processValidationScript(meta.validationScript, meta.validationData, _.extend({}, records[0], validatedData), context)
			if validation?.success isnt true
				error = new Meteor.Error validation.reason
				@notifyError 'Update - Script Validation Error', error, request
				return error

		for key, value of validatedData
			unless value is undefined
				if value is null
					update.$unset[key] = 1
				else
					update.$set[key] = value

		# If there are no data to set remove the $set item
		if Object.keys(update.$set).length is 0
			delete update.$set

		# If there are no data to unset remove the $unset item
		if Object.keys(update.$unset).length is 0
			delete update.$unset

		# If there are ids to execute the update and if update has data, then execute
		if records.length > 0 and Object.keys(update).length > 0
			# Define _updatedAt to current date and time and _updatedBy to current user
			if ignoreHistory isnt true
				update.$set ?= {}
				update.$set._updatedAt = new Date
				update.$set._updatedBy =
					_id: @user._id
					name: @user.name
					group: @user.group
					ts: update.$set._updatedAt

			# Define update query
			query =
				_id:
					$in: []

			for record in records
				query._id.$in.push record._id

			# Define update to multi update
			options =
				multi: true

			# Execute update
			try
				model.update query, update, options
				updatedIds = updatedIds.concat query._id.$in
			catch e
				NotifyErrors.notify 'DataUpdateError', e
				return e

	if meta.scriptBeforeValidation? or meta.validationScript?
		for recordToUpdate in recordsToUpdate
			validateResult = validateAndUpdateRecords [recordToUpdate]
			if validateResult instanceof Error
				@notifyError 'Update - Validation Error', validateResult, request
				return validateResult
	else
		validateResult = validateAndUpdateRecords recordsToUpdate
		if validateResult instanceof Error
			@notifyError 'Update - Validation Error', validateResult, request
			return validateResult

	if updatedIds.length > 0
		# Call hooks
		if not _.isEmpty Namespace.onUpdate
			ids = (id.valueOf() for id in idsToUpdate)

			hookData =
				action: 'update'
				ns: Namespace.ns
				documentName: request.document
				user: _.pick(@user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale'])
				data: model.find(query).fetch() # Find records before apply access filter to query

			urls = [].concat Namespace.onUpdate
			for url in urls when not _.isEmpty url
				url = url.replace '${dataId}', ids.join ','
				url = url.replace '${documentId}', "#{Namespace.ns}:#{request.document}"

				httpRequest.post { url: url, json: hookData }, (err, response) ->
					if err?
						NotifyErrors.notify 'HookOnUpdateError', err
						return console.log "📠 ", "UPDATE ERROR #{url}".red, err

					if response.statusCode is 200
						console.log "📠 ", "#{response.statusCode} UPDATE #{url}".green
					else
						console.log "📠 ", "#{response.statusCode} UPDATE #{url}".red

		# Apply read access filter
		if _.isObject @access.readFilter
			readFilter = filterUtils.parseFilterObject @access.readFilter, meta, context
			if readFilter instanceof Error
				@notifyError 'Update - Validation Error', readFilter, {accessFilter: @access.readFilter}
				response.errors.push readFilter
			else
				query =
					$and: [query, readFilter]

		# Find all update records
		updatedRecords = model.find(query).fetch()

		if meta.scriptAfterSave?
			extraData =
				original: records
			utils.runScriptAfterSave meta.scriptAfterSave, updatedRecords, context, extraData

		# Set update reords to response object
		response.data = []
		for updatedRecord in updatedRecords
			response.data.push accessUtils.removeUnauthorizedDataForRead @access, updatedRecord

	# If there are errors then set success of response as false, else delete the key errors
	if response.errors.length > 0
		response.success = false
	else
		delete response.errors

	# And finally, send the response
	return response


### Delete records
	@param authTokenId
	@param document
	@param data
###
Meteor.registerMethod 'data:delete', 'withUser', 'withAccessForDocument', 'ifAccessIsDeletable', 'withMetaForDocument', 'withModelForDocument', (request) ->
	context = @

	data = []

	# Define response object to be populated later
	response =
		errors: []
		success: true

	# Some validations of payload
	if not _.isObject request.data
		return new Meteor.Error 'internal-error', "[#{request.document}] Invalid payload"

	if not _.isArray(request.data.ids) or request.data.ids.length is 0
		return new Meteor.Error 'internal-error', "[#{request.document}] Payload must contain an array of ids with at least one item"

	meta = @meta

	for item in request.data.ids
		if not _.isObject(item) or not _.isString(item._id)
			return new Meteor.Error 'internal-error', "[#{request.document}] Each id must contain an valid _id"

		if meta.ignoreUpdatedAt isnt true
			if not _.isObject(item) or not _.isObject(item._updatedAt) or not _.isString(item._updatedAt.$date)
				return new Meteor.Error 'internal-error', "[#{request.document}] Each id must contain an date field named _updatedAt"

	model = @model

	# Try to get trash model of document
	trashModel = Models["#{request.document}.Trash"]
	if not trashModel?
		return new Meteor.Error 'internal-error', "[#{request.document}] Document #{request.document}.Trash does not exists"

	# Find records that we are trying to update
	# Map all passed ids to facilitate later access

	query = {}

	if _.isObject @access.deleteFilter
		deleteFilter = filterUtils.parseFilterObject @access.deleteFilter, meta, context
		if deleteFilter instanceof Error
			@notifyError 'Delete - Validation Error', deleteFilter, request
			return deleteFilter

		query = deleteFilter

	if not query._id?
		query._id =
			$in: []

	idMap = {}

	for item in request.data.ids
		if query._id?.$in? and _.isArray(query._id.$in)
			query._id.$in.push item._id
		idMap[item._id] = item

	options = {}
		# fields:
		# 	_updatedAt: 1

	records = model.find(query, options).fetch()

	# Make a query with only _ids to verify if record does not exists or user does not have permission to view the record
	existsQuery =
		_id: query._id

	existsOptions =
		fields:
			_id: 1

	existsRecords = model.find(existsQuery, existsOptions).fetch()
	existsMap = {}

	for existsRecord in existsRecords
		existsMap[existsRecord._id] = existsRecord

	# Mark ids that exists on database and mark all out of date ids to later use
	for record in records
		idMapItem = idMap[record._id]
		if idMapItem?
			idMapItem.exists = true

			if meta.ignoreUpdatedAt isnt true
				if record._updatedAt.getTime() isnt (new Date(idMapItem._updatedAt.$date)).getTime()
					idMapItem.outOfDate = true

	# Verify if records that was marked as unexistent was only anaccessible by user
	for id, idMapItem of idMap
		if idMapItem.exists isnt true
			idMapItem.userDontHasPermission = existsMap[id]?

	# If id doesn't exists return an error and remove id from ids map
	for id, idMapItem of idMap
		if idMapItem.exists isnt true
			if idMapItem.userDontHasPermission is true
				response.errors.push new Meteor.Error 'internal-error', "Sem premissão para ver o dado #{id}"
			else
				response.errors.push new Meteor.Error 'internal-error', "Id [#{id}] de dado inválido. Não existe dado em [#{request.document}] para o id passado: #{id}"

			delete idMap[id]

		else if idMapItem.outOfDate is true
			response.errors.push new Meteor.Error 'internal-error', "Existe uma versão mais nova do dado que a que está tentando apagar [#{id}]. Tente atualizar a tela e tente apagar novamente.", bugsnag: false

			delete idMap[id]

	# Iterate over id map to create an array with ObjectIds to verify relations
	idsToVerifyRelations = []
	for id, idMapItem of idMap
		if idMapItem.exists is true
			idsToVerifyRelations.push id


	# Get references of document
	references = References[request.document]

	# If exist references
	if _.isObject(references) and _.isObject(references.from)
		for referenceMetaName, referenceMeta of references.from
			# Get model
			referenceModel = Models[referenceMetaName]

			if referenceModel?
				# Define an array to multiple conditions
				referenceConditions = []
				# Get all fields that reference this meta and create one condition with all ids
				for referenceFieldName, referenceField of referenceMeta
					condition = {}

					ref = referenceFieldName

					condition["#{ref}._id"] =
						$in: idsToVerifyRelations

					referenceConditions.push condition

				# If there are references of this meta
				if referenceConditions.length > 0
					# Set up a query with all conditions using operator "or"
					referenceQuery =
						$or: referenceConditions

					referenceQueryOptions =
						fields:
							_id: 1

					# Get first result
					referenceResult = referenceModel.findOne referenceQuery, referenceQueryOptions

					# If there are result got ahead and find problems for each record
					if referenceResult?
						# For each id
						for id in idsToVerifyRelations
							# Change all conditions
							for referenceCondition in referenceConditions
								# To set the unique property as one id condition
								referenceCondition[Object.keys(referenceCondition)[0]] = id

							# Define query to all field references of this id
							referenceQuery =
								$or: referenceConditions

							referenceQueryOptions =
								fields:
									_id: 1

							# Execute query
							referenceResult = referenceModel.findOne referenceQuery, referenceQueryOptions

							# If there are results
							if referenceResult?
								# Add error to response
								response.errors.push new Meteor.Error 'internal-error', "Não é possivel apagar o dado com id:[#{request.document}] pois existem dados referenciando o mesmo do modulo [#{referenceMetaName}].", bugsnag: false

								# And delete data from idMap
								delete idMap[id]

	# Iterate over records to get only records that was valid to delete to save them into trash
	recordsToSaveInTrash = []
	for record in records
		if idMap[record._id]?.exists is true
			recordsToSaveInTrash.push record


	# Iterate over id map to create an array with ObjectIds to execute delete query
	idsToDelete = []
	for id, idMapItem of idMap
		if idMapItem.exists is true
			idsToDelete.push id

	# If there are ids to execute the delete, then execute
	if idsToDelete.length > 0
		# Define delete query
		query =
			_id:
				$in: idsToDelete

		# Save every record into trash
		for record in recordsToSaveInTrash
			# Add information about how and when record was sent to trash
			record._deletedAt = new Date()
			record._deletedBy =
				_id: @user._id
				name: @user.name
				group: @user.group

			try
				trashModel.insert record
			catch e
				NotifyErrors.notify 'TrashInsertError', e, {record: record}

		# Execute delete
		try
			model.remove query
		catch e
			NotifyErrors.notify 'DataDeleteError', e, {query: query}
			return e

		# Call hooks
		if not _.isEmpty Namespace.onDelete
			ids = (id.valueOf() for id in idsToDelete)

			hookData =
				action: 'delete'
				ns: Namespace.ns
				documentName: request.document
				user: _.pick(@user, ['_id', 'code', 'name', 'active', 'username', 'nickname', 'group', 'emails', 'locale'])
				data: recordsToSaveInTrash

			urls = [].concat Namespace.onDelete
			for url in urls when not _.isEmpty url
				url = url.replace '${dataId}', ids.join ','
				url = url.replace '${documentId}', "#{Namespace.ns}:#{request.document}"

				httpRequest.post { url: url, json: hookData }, (err, response) ->
					if err?
						NotifyErrors.notify 'HookOnDeleteError', err
						return console.log "📠 ", "DELETE ERROR #{url}".red, err

					if response.statusCode is 200
						console.log "📠 ", "#{response.statusCode} DELETE #{url}".green
					else
						console.log "📠 ", "#{response.statusCode} DELETE #{url}".red

		# Set ids to response object
		response.data = idsToDelete

	# If there are errors then set success of response as false, else delete the key errors
	if response.errors.length > 0
		response.success = false
	else
		delete response.errors

	# And finally, send the response
	return response


### Create relation
	@param authTokenId
	@param document
	@param fieldName
	@param data
###
Meteor.registerMethod 'data:relation:create', 'withUser', 'withAccessForDocument', (request) ->
	context = @

	# Try to get metadata
	meta = Meta[request.document]
	if not meta?
		return new Meteor.Error 'internal-error', "[#{request.document}] Document does not exists"

	# Try to get field of relation
	field = meta.fields[request.fieldName]
	if not field?
		return new Meteor.Error 'internal-error', "[#{request.document}] Field #{request.fieldName} does not exists"

	# Verify if type of field is filter
	if field.type isnt 'filter'
		return new Meteor.Error 'internal-error', "[#{request.document}] Field #{request.fieldName} must be of type filter"

	# Verofy if field has relations
	if not _.isArray(field.relations) or field.relations.length is 0
		return new Meteor.Error 'internal-error', "[#{request.document}] Field #{request.fieldName} must contains a property [relations] as array with at least one item"

	# Some validations of payload
	if not _.isObject request.data
		return new Meteor.Error 'internal-error', "[#{request.document}] Invalid payload"

	if not _.isObject(request.data) or not _.isArray(request.data.lookups) or not _.isArray(request.data.reverseLookups)
		return new Meteor.Error 'internal-error', "[#{request.document}] Payload must contain an object with properties [lookup] and [reverseLookups] as arrays"

	###
	# @TODO Get relation from request
	###
	relation = field.relations[0]

	for metaRelation in field.relations
		if metaRelation.email?
			relation = metaRelation
			break

	# Define response
	response =
		success: true
		data: []
		errors: []

	request.data.data ?= {}

	sendEmail = request.data?.email? and request.data.email is true
	emailData = {}

	if sendEmail
		reverseLookupModel = Models[Meta[relation.document].fields[relation.reverseLookup].document]

	# Do a N x N loop to create all records of relation
	for lookup in request.data.lookups
		for reverseLookup in request.data.reverseLookups
			# Clone extra data
			data = JSON.parse JSON.stringify request.data.data

			if relation.lookupField?
				lookupData = Models[field.document].findOne lookup
				lookup = utils.getObjectPathAgg lookupData, relation.lookupField

			# Define lookups of relation
			data[relation.lookup] =
				_id: lookup

			data[relation.reverseLookup] =
				_id: reverseLookup

			if sendEmail
				emailData[Meta[relation.document].fields[relation.reverseLookup].document] ?= []
				if reverseLookupModel? and not _.findWhere emailData[Meta[relation.document].fields[relation.reverseLookup].document], { _id: reverseLookup }

					reverseLookupData = reverseLookupModel.findOne { _id: reverseLookup }
					metaUtils.populateLookupsData Meta[relation.document].fields[relation.reverseLookup].document, reverseLookupData, { _user: 1, contact: 1 }

					emailData[Meta[relation.document].fields[relation.reverseLookup].document].push reverseLookupData

			upsert = {}
			upsert["#{relation.lookup}._id"] = lookup
			upsert["#{relation.reverseLookup}._id"] = reverseLookup
			upsert = $and: [upsert]

			# generates fake new data and fetch relation data to preview
			if sendEmail and request.preview
				emailData[relation.document] ?= []

				populateFields = {}
				populateFields[relation.lookup] = 1

				newData = _.clone data
				newData['_id'] = Random.id()

				metaUtils.populateLookupsData relation.document, newData, populateFields

				emailData[relation.document].push newData
			else
				# Create record
				result = Meteor.call 'data:create',
					authTokenId: request.authTokenId
					document: relation.document
					data: data
					upsert: upsert

				if _.isNumber result
					return result

				# If result is an error return
				if result instanceof Error
					@notifyError 'Relations - Lookup Error', result, request
					return result

				# If there are data than concat with existent data
				if _.isArray result.data
					response.data = response.data.concat result.data

					if sendEmail
						emailData[relation.document] ?= []

						populateFields = {}
						populateFields[relation.lookup] = 1
						result.data.forEach (resultData) ->
							newData = JSON.parse JSON.stringify resultData

							metaUtils.populateLookupsData relation.document, newData, populateFields

							emailData[relation.document].push newData

				# If there are erros than concat with existent errors
				if _.isArray result.errors
					response.errors = response.errors.concat result.errors

				# If success is false define response success as false
				if result.success is false
					response.success = false

	if sendEmail and emailData[relation.document]?.length > 0
		objectByString = (o, s) ->
			s = s.replace(/\[(\w+)\]/g, '.$1') # convert indexes to properties
			s = s.replace(/^\./, '') # strip a leading dot
			a = s.split('.')
			i = 0
			n = a.length
			while i < n
				k = a[i]
				if k of o
					o = o[k]
				else
					return
				++i
			o

		if relation.emailConf?.extraData?
			for fieldEmail, findEmailData of relation.emailConf.extraData
				record = Meteor.call 'data:find:all', findEmailData

				if record.success is true
					emailData[fieldEmail] = record.data

		emailData['request'] = request.data.data

		createdByUser = {}
		utils.copyObjectFieldsByPathsIncludingIds @user, createdByUser, Meta['Message'].fields['_createdBy'].descriptionFields

		updatedByUser = {}
		utils.copyObjectFieldsByPathsIncludingIds @user, updatedByUser, Meta['Message'].fields['_updatedBy'].descriptionFields

		userOwner = {}
		utils.copyObjectFieldsByPathsIncludingIds @user, userOwner, Meta['Message'].fields['_user'].descriptionFields

		messageData =
			data: emailData
			type: 'Email'
			status: 'Send'
			_createdAt: new Date()
			_updatedAt: new Date()
			_createdBy: createdByUser
			_updatedBy: updatedByUser
			_user: [ userOwner ]

		if relation.emailConf?.template?
			messageData.template = relation.emailConf.template

		if relation.emailConf?.server?
			messageData.server = relation.emailConf.server

		# find a contact on source data of relation
		if Meta['Message'].fields['contact']?.descriptionFields? and relation.emailConf?.contact?
			emailContactData = {}
			contactData = objectByString(emailData, relation.emailConf.contact)

			if contactData?
				if contactData?.email?.length > 0 and (not messageData.to? or _.isEmpty messageData.to)
					messageData.to = contactData.email[0].address

				utils.copyObjectFieldsByPathsIncludingIds contactData, emailContactData, Meta['Message'].fields['contact'].descriptionFields

				messageData.contact = [ emailContactData ]

		if Meta['Message'].fields['opportunity']?.descriptionFields? and relation.emailConf?.opportunity?
			emailOpportunityData = {}

			utils.copyObjectFieldsByPathsIncludingIds objectByString(emailData, relation.emailConf.opportunity), emailOpportunityData, Meta['Message'].fields['opportunity'].descriptionFields

			messageData.opportunity = emailOpportunityData

		# simulates a render by konsistent.mailConsumer
		if request.preview
			return renderTemplate messageData.template, _.extend({ message: { _id: Random.id() } }, emailData)

		Models['Message'].insert messageData

	# Remove array of data if it's empty
	if response.data.length is 0
		delete response.data

	# Remove array of errors if it's empty
	if response.errors.length is 0
		delete response.errors

	# Send response
	return response

### Save lead
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
###
Meteor.registerMethod 'data:lead:save', 'withUser', (request) ->
	context = @
	# meta = @meta

	console.log 'data:lead:save ->'.yellow, global.Namespace.ns, '->'.green, JSON.stringify request

	# Some validations of payload
	if not _.isObject request.lead
		return new Meteor.Error 'internal-error', "[#{request.document}] Invalid payload"

	# Define response
	response =
		success: true
		data: []
		errors: []

	phoneSent = []
	if request.lead.phone? and not _.isEmpty request.lead.phone
		phoneSent = phoneSent.concat(request.lead.phone)

	# validate if phone or email was passed
	if not request?.lead?.email? and phoneSent.length is 0
		response.success = false
		response.errors = [ new Meteor.Error 'data-lead-save-validation', "É obrigatório o preenchimento de ao menos um dos seguintes campos: email e telefone." ]
		delete response.data
		return response

	contactUser = null

	request.lead ?= {}

	contact = null

	# try to find a contact with given email
	if request.lead.email?
		# request.lead.email.some (email) ->
		record = Meteor.call 'data:find:all',
			document: 'Contact'
			filter:
				conditions: [
					term: 'email.address'
					operator: 'equals'
					value: request.lead.email
				]
			limit: 1

		if record?.data?[0]?
			contact = record?.data?[0]

	# If contact not found try to find with name and phone
	if not contact? and request.lead.name? and phoneSent.length > 0
		regexName = _.first(_.words(request.lead.name))

		record = Meteor.call 'data:find:all',
			document: 'Contact'
			filter:
				conditions: [
					term: 'phone.phoneNumber'
					operator: 'equals'
					value: phoneSent[0]
				,
					term: 'name.full'
					operator: 'contains'
					value: regexName
				]
			limit: 1

		if record?.data?[0]?
			contact = record?.data?[0]

	contactData = {}

	if request.lead.name?
		setName = true
		if contact?.name?.full?
			if request.lead.name.length < contact.name.full.length
				setName = false

		if setName
			nameParts = _.words request.lead.name
			contactData.name =
				first: _.first(nameParts)
				last: _.rest(nameParts).join(' ')

	if request.lead.email?
		if contact?.email?.length > 0
			if not _.findWhere _.compact(contact.email), { address: request.lead.email }
				contactData.email = contact.email
				contactData.email.push
					address: request.lead.email
		else if not _.isEmpty request.lead.email
			contactData.email = [ address: request.lead.email ]

	if phoneSent.length > 0
		if contact?.phone?.length > 0
			firstPhoneNotFound = true
			phoneSent.forEach (leadPhone) ->
				if not _.findWhere _.compact(contact.phone), { phoneNumber: leadPhone }
					if firstPhoneNotFound
						contactData.phone = contact.phone
						firstPhoneNotFound = false

					contactData.phone.push
						countryCode: '55'
						phoneNumber: leadPhone
		else if phoneSent.length > 0
			contactData.phone = []

			phoneSent.forEach (leadPhone) ->
				contactData.phone.push
					countryCode: 55
					phoneNumber: leadPhone

	# if no _user sent, _user will be set from users in queue
	contactData.queue = { _id: request.lead.queue } if request.lead.queue?

	contactData.campaign = { _id: request.lead.campaign } if request.lead.campaign?

	# Add extra fields to contactData
	contactData = _.extend(contactData, request.lead.extraFields) if request.lead.extraFields?

	# controls if field _user was set to contact
	addedUser = false

	# sets _user based on the data sent
	if request.lead.broker?
		addedUser = true

		record = Meteor.call 'data:find:all',
			document: 'User'
			filter:
				conditions: [
					term: 'username'
					operator: 'equals'
					value: request.lead.broker
				]
			fields: '_id'
			limit: 1

		if record?.data?.length > 0
			if contact?._user?
				if not _.findWhere _.compact(contact._user), { _id: record.data[0]._id }
					contactData._user = _.clone contact._user
					contactData._user.push
						_id: record.data[0]._id
			else
				contactData._user = [ record.data[0] ]

			# @TODO testar passando _user!!! array e não array
			contactUser =
				_id: record.data[0]._id

	else
		# if a contact has been found try to set _user based on his opportunities and activities
		if contact?
			if not addedUser and contact.activeOpportunities? and contact?.activeOpportunities > 0
				record = Meteor.call 'data:find:all',
					document: 'Opportunity'
					filter:
						conditions: [
							term: 'contact._id'
							operator: 'equals'
							value: contact._id
						,
							term: 'status'
							operator: 'in'
							value: [
								"Nova"
								"Ofertando Imóveis"
								"Em Visitação"
								"Proposta"
								"Contrato"
								"Pré-Reserva de Lançamentos"
							]
						,
							term: '_user.active'
							operator: 'equals'
							value: true
						]
					limit: 1
					sort: [
						property: '_updatedAt'
						direction: 'DESC'
					]
					fields: '_id, _user'

				if record?.data?[0]?._user?
					addedUser = true

					contactUser = record.data[0]._user[0]

					# @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
					if not _.findWhere _.compact(contact._user), { _id: record.data[0]._user[0]._id }
						contactData._user = _.clone contact._user
						contactData._user.push record.data[0]._user[0]

			# get recent activities from contact to find an _user
			if not addedUser
				record = Meteor.call 'data:find:all',
					document: 'Activity'
					filter:
						conditions: [
							term: 'contact._id'
							operator: 'equals'
							value: contact._id
						,
							term: '_createdAt'
							operator: 'greater_or_equals'
							value: moment().subtract(10,'days').toDate()
						,
							term: '_user.active'
							operator: 'equals'
							value: true
						]
					limit: 1
					sort: [
						property: '_createdAt'
						direction: 'DESC'
					]
					fields: '_id, _user'

				if record?.data?[0]?._user?
					addedUser = true

					contactUser = record.data[0]._user[0]

					# @TODO talvez seja necessário testar se `record.data[0]._user` é realmente um array
					if not _.findWhere _.compact(contact._user), { _id: record.data[0]._user[0]._id }
						contactData._user = _.clone contact._user
						contactData._user.push record.data[0]._user[0]

		# if queue is set, set _user getting next user from queue sent
		if not addedUser and request.lead.queue?
			if _.isString(request.lead.queue)
				userQueue = metaUtils.getNextUserFromQueue request.lead.queue, @user

				addedUser = true

				contactUser = userQueue.user

				if userQueue.user?._id?
					if contact?
						if not _.findWhere _.compact(contact._user), { _id: userQueue.user._id }
							contactData._user = _.clone contact._user
							contactData._user.push userQueue.user
					else
						contactData._user = [ userQueue.user ]

		# if _user not set yet and campaign is set, try to find a queue set in campaign
		if not addedUser and request.lead.campaign?
			record = Meteor.call 'data:find:all',
				document: 'Campaign'
				filter:
					conditions: [
						term: '_id'
						operator: 'equals'
						value: request.lead.campaign
					]
				fields: '_id,targetQueue'

			if record?.data?[0]?.targetQueue?
				# set targetQueue from campaign to contact if not set
				if not contactData.queue?
					contactData.queue = { _id: record.data[0].targetQueue._id }

				userQueue = metaUtils.getNextUserFromQueue record.data[0].targetQueue._id, @user

				addedUser = true

				contactUser = userQueue.user

				if userQueue.user?._id?
					if contact?
						if not _.findWhere _.compact(contact._user), { _id: userQueue.user._id }
							contactData._user = _.clone contact._user
							contactData._user.push userQueue.user
					else
						contactData._user = [ userQueue.user ]

	# sets _user with original data from contact if queue is set. prevents default behavior overwriting _user with next user from queue
	if not addedUser and contact?
		# some contacts doesn't have _user set, so set it to current request user
		if not contact._user?[0]?._id?
			contactData._user = [ { _id: @user._id } ]
		else if contactData.queue?
			contactData._user = _.clone contact._user

	# creates a contact if not found one
	if not contact?
		createRequest =
			document: 'Contact'
			data: contactData

		# default data
		createRequest.data.status = 'Lead' if not contactData.status?
		createRequest.data.type = [ 'Cliente' ] if not contactData.type?

		console.log '[data:create] ->'.yellow, JSON.stringify createRequest, null, '  '

		result = Meteor.call 'data:create', createRequest
	else if not _.isEmpty contactData
		updateRequest =
			document: 'Contact'
			data:
				ids: [ { _id: contact._id, _updatedAt: $date: contact._updatedAt.toISOString() } ]
				data: contactData

		console.log '[data:update] ->'.yellow, JSON.stringify updateRequest, null, '  '

		result = Meteor.call 'data:update', updateRequest
	else
		result =
			success: true
			data: [ contact ]

	if _.isArray result.errors
		response.errors = response.errors.concat result.errors

	if result.success is false
		response.success = false
	else
		response.data = result.data

		contactId = result.data[0]._id

		# save other data sent
		if request.save?

			# set _user from created contact
			if not addedUser
				contactUser = response.data[0]._user[0]

			saveRelations = (relations, contactId, parentObj) ->
				relations.some (saveObj) ->
					createRequest =
						document: saveObj.document
						data: saveObj.data

					if Meta[saveObj.document]?.fields['contact']?.isList?
						createRequest.data.contact = [
							_id: contactId
						]
					else
						createRequest.data.contact = _id: contactId

					if parentObj?
						createRequest.data = _.extend createRequest.data, parentObj

					# @TODO verificar no metodo do documento se o lookup de contato é isList para botar o array ou nao
					createRequest.data._user = [ contactUser ]

					saveResult = Meteor.call 'data:create', createRequest

					# @TODO tratar os retornos
					if saveResult.success is true
						response.data = response.data.concat saveResult.data

						if saveObj.relations?
							relationMap = {}
							relationMap[saveObj.name] = { _id: saveResult.data[0]._id }

							saveRelations saveObj.relations, contactId, relationMap
					else
						response.errors = response.errors.concat saveResult.errors

			saveRelations([].concat(request.save), contactId) if request.save?

	# Remove array of data if it's empty
	if response.data.length is 0
		delete response.data

	# Remove array of errors if it's empty
	if response.errors.length is 0
		delete response.errors

	# @TODO retornar apenas o campo _user que foi adicionado, e não todos caso o contato já exista e possua outro _user setado
	# if newUser? and response.data?.length > 0
	# 	response.data[0]._user = newUser

	# Send response
	return response


processValidationScript = (validationScript, validationData, fullData, context) ->
	extraData = {}

	if validationData?
		for validationField, validationFilter of validationData
			validationDataFilter = JSON.parse JSON.stringify validationFilter

			filterUtils.parseDynamicData validationDataFilter, '$this', fullData

			record = Meteor.call 'data:find:all', validationDataFilter

			if record.success is true
				extraData[validationField] = record.data

	return utils.runValidationScript(validationScript, fullData, context, extraData)
