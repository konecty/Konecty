### Simualte merge
	@TODO: Permissões?

	@param authTokenId
	@param document
	@param ids
	@param targetId
###
Meteor.registerMethod 'merge:simulate', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	context = @
	{access, meta, model} = @

	# Initial validations
	if not Match.test request.ids, [String]
		return new Meteor.Error 'internal-error', 'A propriedade [ids] deve ser um array de strings', request: request

	if request.ids.length is 0
		return new Meteor.Error 'internal-error', 'Deve ser informado ao menos um id', request: request

	if not Match.test request.targetId, String
		return new Meteor.Error 'internal-error', 'A propriedade [targetId] deve ser uma string', request: request

	if request.ids.indexOf(request.targetId) is -1
		return new Meteor.Error 'internal-error', 'A propriedade [targetId] deve ser um dos valores informados na propriedade [ids]', request: request

	# Find data
	query =
		_id:
			$in: request.ids

	records = model.find(query).fetch()

	if records.length isnt request.ids.length
		foundIds = records.map (record) -> record._id
		return new Meteor.Error 'internal-error', "Foram encontrados apenas os ids [#{foundIds.join(', ')}] para os ids passados [#{request.ids.join(', ')}]"

	merged = {}
	conflicts = {}

	removeDuplicatedValues = (values, directValues) ->
		result = []
		for value1, index1 in values
			equals = false
			for index2 in [index1+1...values.length]
				value2 = values[index2]
				if directValues is true
					if utils.deepEqual value1, value2
						equals = true
						break
				else
					if utils.deepEqual value1.value, value2.value
						equals = true
						break

			if equals is false
				result.push value1

		return result

	processIsListField = (values) ->
		result =
			_id: []
			value: []

		for value in values when Match.test(value.value, Array) and value.value.length > 0
			result.value = result.value.concat value.value
			result._id.push value._id

		result.value = removeDuplicatedValues result.value, true

		return [result]

	processField = (field) ->
		values = []
		for record in records when record[field.name]?
			values.push
				_id: record._id
				value: record[field.name]

		if field.isList isnt true
			values = removeDuplicatedValues values

		if values.length is 1
			return merged[field.name] = values[0].value

		if values.length > 1
			if field.isList is true
				values = processIsListField values
				merged[field.name] = values[0].value
			else
				if _.isArray(values[0].value) and _.difference(values[0].value, values[1].value).length is 0
					merged[field.name] = values[0].value
				else if _.isEqual values[0].value, values[1].value
					merged[field.name] = values[0].value
				else
					conflicts[field.name] = values

	excludedTypes = ['autoNumber']
	excludedNames = ['_updatedAt', '_createdAt']

	processField field for fieldName, field of meta.fields when field.type not in excludedTypes and field.name not in excludedNames

	return {
		merged: merged
		conflicts: conflicts
	}


### Execute merge
	@TODO: Permissões?

	@param authTokenId
	@param document
	@param ids
	@param targetId
	@param data
###
Meteor.registerMethod 'merge:save', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	context = @
	{access, meta, model} = @

	# Initial validations
	if not Match.test request.ids, [String]
		return new Meteor.Error 'internal-error', 'A propriedade [ids] deve ser um array de strings', request: request

	if request.ids.length is 0
		return new Meteor.Error 'internal-error', 'Deve ser informado ao menos um id', request: request

	if not Match.test request.targetId, String
		return new Meteor.Error 'internal-error', 'A propriedade [targetId] deve ser uma string', request: request

	if not Match.test request.data, Object
		return new Meteor.Error 'internal-error', 'A propriedade [data] deve ser um objeto contendo valores', request: request

	request.ids = _.without request.ids, request.targetId

	# Find data
	query =
		_id:
			$in: request.ids

	records = model.find(query).fetch()

	if records.length isnt request.ids.length
		foundIds = records.map (record) -> record._id
		return new Meteor.Error 'internal-error', "Foram encontrados apenas os ids [#{foundIds.join(', ')}] para os ids passados [#{request.ids.join(', ')}]"


	# Find target id
	query =
		_id: request.targetId

	targetRecord = model.findOne(query)

	# Remove unmodified values
	for field, value of targetRecord
		if field isnt '_merge' and utils.deepEqual value, request.data[field]
			delete request.data[field]


	# Add merge ids into record
	request.data._merge ?= []
	request.data._merge = request.data._merge.concat request.ids
	request.data._merge = _.uniq request.data._merge

	update =
		ids: [
			_id: targetRecord._id
			_updatedAt:
				$date: targetRecord._updatedAt.toISOString()
		]
		data: request.data

	# Exec update
	updateResult = Meteor.call 'data:update',
		data: update
		document: request.document
		__scope__:
			user: @user
			access: @access

	if not updateResult.data?[0]?
		return updateResult

	# Get history Model
	historyModel = Models["#{request.document}.History"]

	# Define ids to delete
	del =
		ids: []

	# Get ids to delete and generate merge histories
	for record in records
		del.ids.push
			_id: record._id
			_updatedAt: $date: record._updatedAt.toISOString()

		query =
			_id: Date.now()*100

		data =
			_id: query._id
			dataId: record._id
			mergeTargetId: request.targetId
			type: 'merge'
			createdAt: new Date
			createdBy:
				_id: @user._id
				name: @user.name
				group: @user.group
			data: record

		historyModel.upsert query, data

		# update old histories to reference the new merged document
		historyModel.update { dataId: record._id, origDataId: { $exists: false } }, { $set: { origDataId: record._id } }, { multi: true }
		historyModel.update { dataId: record._id }, { $set: { dataId: request.targetId } }, { multi: true }

	for referenceDocumentName, referenceFields of References[request.document]?.from
		for referenceFieldName, referenceField of referenceFields
			update =
				ids: [
					_id: targetRecord._id
					_updatedAt:
						$date: targetRecord._updatedAt.toISOString()
				]
				data: request.data

			query = {}
			query["#{referenceFieldName}._id"] = $in: request.ids

			update =
				_updatedAt: new Date
				_updatedBy:
					_id: @user._id
					name: @user.name
					group: @user.group
				_merge: request.data._merge

			update[referenceFieldName] =
				_id: updateResult.data[0]._id

			if _.isArray referenceField.descriptionFields
				utils.copyObjectFieldsByPathsIncludingIds updateResult.data[0], update[referenceFieldName], referenceField.descriptionFields

			if referenceField.isList is true
				update["#{referenceFieldName}.$"] = update[referenceFieldName]
				delete update[referenceFieldName]

			update =
				$set: update

			options =
				multi: true

			model = Models[referenceDocumentName]
			model.update query, update, options

	# Exec deletions
	Meteor.call 'data:delete',
		data: del
		document: request.document
		__scope__:
			user: @user
			access: @access


	return updateResult


