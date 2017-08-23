### List history for a record
	@param authTokenId
	@param document
	@param dataId
	@param fields
###
Meteor.registerMethod 'history:find', 'withUser', 'withAccessForDocument', (request) ->
	# Verify if user have permission to read records
	if @access.isReadable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to read records"

	historyModel = Models["#{request.document}.History"]

	metaObject = Meta[request.document]

	query =
		dataId: request.dataId

	fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind request.fields

	# Validate if user have permission to view each field
	emptyFields = Object.keys(fields).length is 0
	for fieldName of metaObject.fields
		accessField = accessUtils.getFieldPermissions @access, fieldName
		accessFieldConditions = accessUtils.getFieldConditions @access, fieldName
		if accessField.isReadable isnt true or accessFieldConditions?.READ?
			if emptyFields is true
				fields[fieldName] = 0
			else
				delete fields[fieldName]

	convertedFields = {}
	for field, value of fields
		convertedFields["data.#{field}"] = value
		convertedFields["diffs.#{field}"] = value

	options =
		fields: convertedFields
		sort: createdAt: 1

	records = historyModel.find(query, options).fetch()

	for record in records
		if not record.diffs? and record.data?
			record.diffs = {}
			for field, value of record.data
				record.diffs[field] = {}
				record.diffs[field][if record.type is 'delete' then 'from' else 'to'] = value

			delete record.data

	return data: records
