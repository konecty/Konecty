moment = Npm.require('moment');

crypto = require 'crypto'

metaUtils = {}

metaUtils.validateAndProcessValueFor = (meta, fieldName, value, actionType, model, objectOriginalValues, objectNewValues, idsToUpdate) ->
	field = meta.fields[fieldName]

	if not field?
		return new Meteor.Error 'utils-internal-error', "Field #{fieldName} does not exists on #{meta._id}"

	# Validate required fields
	if field.isRequired is true and not value?
		return new Meteor.Error 'utils-internal-error', "O Campo '#{fieldName}' é obrigatório, mas não está presente no dado.", { meta: meta, fieldName: fieldName, value: value, actionType: actionType, model: model, objectOriginalValues: objectOriginalValues, objectNewValues: objectNewValues, idsToUpdate: idsToUpdate }

	# Validate List fields
	if field.isList is true
		if field.maxElements? and field.maxElements > 0
			if not _.isArray(value) or value.length > field.maxElements
				return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be array with the maximum of #{field.maxElements} item(s)"

		if field.minElements? and field.minElements > 0
			if not _.isArray(value) or value.length < field.minElements
				return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be array with at least #{field.minElements} item(s)"

		if field.isAllowDuplicates is false and _.isArray(value)
			for itemA in value
				for itemB in value
					if utils.deepEqual(itemA, itemB) is true
						return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be array no duplicated values"

	# Validate picklist min selected
	if field.type is 'picklist'
		if _.isNumber(field.minSelected)
			if field.minSelected is 1
				if not value? or (_.isArray(value) and value.length is 0)
					return new Meteor.Error 'utils-internal-error', "A lista de escolha '#{fieldName}' exige o mínimo de 1 valores selecionados. Mas não está presente no dado."

	if actionType is 'update' and not value? and field.type is 'lookup'
		lookupUtils.removeInheritedFields field, objectNewValues

	if not value? and field.type isnt 'autoNumber'
		return value

	# If field is Unique verify if exists another record on db with same value
	if value? and field.isUnique is true and field.type isnt 'autoNumber'
		query = {}
		query[fieldName] = value

		multiUpdate = idsToUpdate?.length > 1

		# If is a single update exclude self record in verification
		if actionType is 'update' and multiUpdate isnt true
			query._id =
				$ne: idsToUpdate[0]

		count = model.find(query).count()
		if count > 0
			return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be unique"

	result = true

	removeUnauthorizedKeys = (obj, keys, path) ->
		objKeys = Object.keys obj

		unauthorizedKeys = objKeys.filter (key) ->
			return keys.indexOf(key) is -1

		for key in unauthorizedKeys
			delete obj[key]

		return obj

	mustBeValidFilter = (v) ->
		if not v.match in ['and', 'or']
			result = new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must contains a property named 'match' with one of values ['and', 'or']"
			return false

		if _.isArray(v.conditions)
			objectOfConditions = {}
			for condition in v.conditions
				objectOfConditions[condition.term.replace(/\./g, ':') + ':' + condition.operator] = condition
			v.conditions = objectOfConditions

		if not _.isObject(v.conditions)
			result = new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must contains a property named 'conditions' of type Object with at least 1 item"
			return false

		for key, condition of v.conditions
			if mustBeString(condition.term) is false or mustBeString(condition.operator) is false
				result = new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must contains conditions with properties 'term' and 'operator' of type String"
				return false

			operators = ['exists', 'equals', 'not_equals', 'in', 'not_in', 'contains', 'not_contains', 'starts_with', 'end_with', 'less_than', 'greater_than', 'less_or_equals', 'greater_or_equals', 'between']

			if not condition.operator in operators
				result = new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must contains conditions with valid operators such as [#{operators.join(', ')}]"
				return false

			if not condition.value?
				result = new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must contains conditions property named 'value'"
				return false

		if _.isArray(v.filters)
			for filter in v.filters
				if mustBeValidFilter(filter) is false
					return false

	mustBeString = (v, path) ->
		if not _.isString v
			result = new Meteor.Error 'utils-internal-error', "Value for field #{path or fieldName} must be a valid String"
			return false

	mustBeStringOrNull = (v, path) ->
		if not v? then return true
		return mustBeString v, path

	mustBeNumber = (v, path) ->
		if not _.isNumber v
			result = new Meteor.Error 'utils-internal-error', "Value for field #{path or fieldName} must be a valid Number"
			return false

	mustBeNumberOrNull = (v, path) ->
		if not v? then return true
		return mustBeNumber v, path

	mustBeBoolean = (v, path) ->
		if not _.isBoolean v
			result = new Meteor.Error 'utils-internal-error', "Value for field #{path or fieldName} must be a valid Boolean"
			return false

	mustBeBooleanOrNull = (v, path) ->
		if not v? then return true
		return mustBeBoolean v, path

	mustBeObject = (v, path) ->
		if not _.isObject v
			result = new Meteor.Error 'utils-internal-error', "Value for field #{path or fieldName} must be a valid Object"
			return false

	mustBeObjectOrNull = (v, path) ->
		if not v? then return true
		return mustBeObject v, path

	mustBeArray = (v, path) ->
		if not _.isArray v
			result = new Meteor.Error 'utils-internal-error', "Value for field #{path or fieldName} must be a valid Array"
			return false

	mustBeArrayOrNull = (v, path) ->
		if not v? then return true
		return mustBeArray v, path

	mustBeDate = (v, path) ->
		date = new Date v

		if isNaN date
			result = new Meteor.Error 'utils-internal-error', "Value for field #{path or fieldName} must be a valid string or number representation of date"
			return false

	mustBeDateOrNull = (v, path) ->
		if not v? then return true
		return mustBeDate v, path

	validate = (value) ->
		switch field.type
			when 'boolean'
				if mustBeBoolean(value) is false then return result

			when 'number', 'percentage'
				if mustBeNumber(value) is false then return result

				if _.isNumber(field.maxValue) and value > field.maxValue
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be less than #{field.maxValue}"

				if _.isNumber(field.minValue) and value < field.minValue
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be greater than #{field.minValue}"

			when 'picklist'
				if _.isNumber(field.maxSelected) and field.maxSelected > 1
					if mustBeArray(value) is false then return result
					if value.length > field.maxSelected
						return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be an array with max of #{field.maxSelected} item(s)"

				if _.isNumber(field.minSelected) and field.minSelected > 0
					if value.length < field.minSelected
						return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be an array with min of #{field.minSelected} item(s)"

				valuesToVerify = [].concat value

				for valueToVerify in valuesToVerify
					if not field.options[valueToVerify]?
						return new Meteor.Error 'utils-internal-error', "Value #{valueToVerify} for field #{fieldName} is invalid"

			when 'text', 'richText'
				if _.isNumber value
					value = String value

				if mustBeString(value) is false then return result

				if field.normalization? and changeCase["#{field.normalization}Case"]?
					value = changeCase["#{field.normalization}Case"] value

				if _.isNumber(field.size) and field.size > 0
					if value.length > field.size
						return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be smaller than #{field.size}"

			when 'dateTime', 'date'
				if mustBeObject(value) is false then return result

				if mustBeDate((value.$date || value), "#{fieldName}.$date") is false then return result

				value = new Date(value.$date || value)

				if field.maxValue? or field.minValue?
					maxValue = field.maxValue
					minValue = field.minValue
					if field.type is 'date'
						value.setHours(0)
						value.setMinutes(0)
						value.setSeconds(0)
						value.setMilliseconds(0)

					if maxValue? and maxValue is '$now'
						maxValue = new Date()
						if field.type is 'date'
							maxValue.setHours(0)
							maxValue.setMinutes(0)
							maxValue.setSeconds(0)
							maxValue.setMilliseconds(0)

					if minValue? and minValue is '$now'
						minValue = new Date()
						if field.type is 'date'
							minValue.setHours(0)
							minValue.setMinutes(0)
							minValue.setSeconds(0)
							minValue.setMilliseconds(0)

					if field.type is 'date'
						momentFormat = 'DD/MM/YYYY'
					else
						momentFormat = 'DD/MM/YYYY HH:mm:ss'

					if mustBeDate(maxValue) isnt false and value > maxValue
						return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be less than or equals to #{moment(maxValue).format(momentFormat)}"

					if mustBeDate(minValue) isnt false and value < minValue
						return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be greater than or equals to #{moment(minValue).format(momentFormat)}"
			when 'time'
				if mustBeNumber(value) is false then return result

				if value < 0 or value > 86400000
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be agreater then 0 and less then 86400000"

			when 'email'
				if mustBeObject(value) is false then return result
				if mustBeString(value.address) is false then return result
				if mustBeStringOrNull(value.type) is false then return result

				if regexUtils.email.test(value.address) is false
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName}.address must be a valid email"

				value.address = value.address.toLowerCase()

			when 'url'
				if mustBeString(value) is false then return result

				if regexUtils.url.test(value) is false
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be a valid url"

			when 'personName'
				if mustBeObject(value) is false then return result

				keys = ['prefix', 'first', 'middle', 'last', 'sufix']

				removeUnauthorizedKeys value, keys

				fullName = []
				for key in keys
					if mustBeStringOrNull(value[key], "#{fieldName}.#{key}") is false then return result
					if _.isString value[key]
						value[key] = changeCase.titleCase value[key]
						fullName.push value[key]

				value.full = fullName.join ' '

			when 'phone'
				if mustBeObject(value) is false then return result

				validKeys = ['countryCode', 'phoneNumber', 'extention', 'type']

				removeUnauthorizedKeys value, validKeys

				for validKey in validKeys
					if _.isNumber value[validKey]
						value[validKey] = String value[validKey]

				if _.isString value.countryCode
					value.countryCode = parseInt value.countryCode

				if mustBeNumber(value.countryCode, "#{fieldName}.countryCode") is false then return result
				if mustBeString(value.phoneNumber, "#{fieldName}.phoneNumber") is false then return result
				if mustBeStringOrNull(value.extention, "#{fieldName}.extention") is false then return result
				if mustBeStringOrNull(value.extention, "#{fieldName}.type") is false then return result

				if value.countryCode < 0 or value.countryCode > 999
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName}.countryCode must contains 1, 2 or 3 digits"

				if value.countryCode is 55 and not /^[0-9]{10,12}$/.test value.phoneNumber
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName}.phoneNumber with countryCode '55' must contains from 10 to 12 digits"

			when 'geoloc'
				if mustBeArray(value) is false then return result

				if value.length isnt 2 or not _.isNumber(value[0]) or not _.isNumber(value[1])
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be an array with longitude and latitude"

			when 'money'
				if mustBeObject(value) is false then return result

				removeUnauthorizedKeys value, ['currency', 'value']

				currencies = ['BRL']
				if not _.isString(value.currency) or not value.currency in currencies
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName}.currency must be one of [#{currencies.join(', ')}]"

				if not _.isNumber value.value
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName}.value must be a valid Number"

			when 'json'
				if not _.isObject(value) and not _.isArray(value)
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be a valid Array or Object"

			when 'password'
				if mustBeString(value) is false then return result

				value = password.encrypt value

			when 'encrypted'
				if mustBeString(value) is false then return result

				value = crypto.createHash('md5').update(value).digest 'hex'

			when 'autoNumber'
				if actionType is 'update'
					value = undefined
				else
					value = metaUtils.getNextCode meta.name, fieldName

			when 'address'
				if mustBeObject(value) is false then return result

				if field.isRequired is true
					requiredKeys = ['country', 'state', 'city', 'place', 'number']
					optionalKeys = ['postalCode', 'district', 'placeType', 'complement', 'type']
				else
					requiredKeys = []
					optionalKeys = ['country', 'state', 'city', 'place', 'number', 'postalCode', 'district', 'placeType', 'complement', 'type']

				extraKeys = ['geolocation']

				removeUnauthorizedKeys value, requiredKeys.concat(optionalKeys).concat(extraKeys)

				for key in requiredKeys
					if _.isNumber value[key]
						value[key] = String value[key]

					if mustBeString(value[key], "#{fieldName}.#{key}") is false then return result

				for key in optionalKeys
					if _.isNumber value[key]
						value[key] = String value[key]

					if mustBeStringOrNull(value[key], "#{fieldName}.#{key}") is false then return result

				if mustBeArrayOrNull(value.geolocation, "#{fieldName}.geolocation") is false then return result

				if _.isArray(value.geolocation) and (value.geolocation.length isnt 2 or not _.isNumber(value.geolocation[0]) or not _.isNumber(value.geolocation[1]))
					return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName}.geolocation must be an array with longitude and latitude"

			when 'filter'
				if mustBeObject(value) is false then return result

				if mustBeValidFilter(value) is false then return result

				utils.recursiveObject value, (key, value, parent) ->
					if value?['$date']
						parent[key] = new Date value['$date']

			when 'composite'
				if mustBeObject(value) is false then return result

				if field.compositeType is 'reference'
					meta = Meta[field.objectRefId]
					if not meta?
						return new Meteor.Error 'utils-internal-error', "Document #{field.objectRefId} not found"

					for key, subValue of value
						validation = metaUtils.validateAndProcessValueFor meta, key, subValue, actionType, model, value, value, idsToUpdate
						if validation instanceof Error
							return validation
						value[key] = validation

			when 'lookup', 'inheritLookup'
				if mustBeObject(value) is false then return result

				if mustBeString(value._id, "#{fieldName}._id") is false then return result

				lookupModel = Models[field.document]
				if not lookupModel?
					return new Meteor.Error 'utils-internal-error', "Document #{field.document} not found"

				query =
					_id: value._id

				record = lookupModel.findOne(query)

				if not record?
					return new Meteor.Error 'utils-internal-error', "Record not found for field #{fieldName} with _id [#{value._id}] on document [#{field.document}]"

				lookupUtils.copyDescriptionAndInheritedFields field, value, record, meta, actionType, model, objectOriginalValues, objectNewValues, idsToUpdate

			# when 'masked'
			# when 'calculated'
			when 'file'
				if mustBeObject(value) is false then return result
				keys = ['key', 'name', 'size', 'created', 'etag', 'headers', 'kind', 'last_modified', 'description', 'label', 'wildcard']
				removeUnauthorizedKeys value, keys

			else
				e = new Meteor.Error 'utils-internal-error', "Field #{fieldName} of type #{field.type} can not be validated"
				NotifyErrors.notify 'ValidateError', e
				return e

		return value

	if field.isList isnt true
		return validate value

	if not _.isArray value
		if value?
			value = [value]
		else
			return new Meteor.Error 'utils-internal-error', "Value for field #{fieldName} must be array"

	for item, index in value
		value[index] = validate item
		if value[index] instanceof Error
			return value[index]

	return value

metaUtils.getNextUserFromQueue = (queueStrId, user) ->
	collection = Models.QueueUser.rawCollection()
	findAndModify = Meteor.wrapAsync(collection.findAndModify, collection)

	# Mount query, sort, update, and options
	query =
		'queue._id': queueStrId

	sort =
		count: 1
		order: 1

	update =
		$inc:
			count: 1
		$set:
			_updatedAt: new Date
			_updatedBy:
				_id: user._id
				name: user.name
				group: user.group

	options =
		'new': true

	# Execute findAndModify
	queueUser = findAndModify query, sort, update, options

	if queueUser?.value?
		queueUser = queueUser.value
	else
		queueUser = undefined

	if not _.isObject queueUser
		queueUser = Models.Queue.findOne queueStrId
		if queueUser?._user?[0]?
			return {
				user: queueUser._user[0]
			}
		return undefined

	# ConvertIds
	utils.convertObjectIdsToFn queueUser, (id) ->
		id.valueOf()

	# Return queueUser
	return queueUser

metaUtils.getNextCode = (documentName, fieldName) ->
	meta = Meta[documentName]
	fieldName ?= 'code'

	# Force autoNumber record to exists
	Models["#{documentName}.AutoNumber"].upsert {_id: fieldName}, {$set: {_id: fieldName}}

	collection = Models["#{documentName}.AutoNumber"].rawCollection()
	findAndModify = Meteor.wrapAsync(collection.findAndModify, collection);

	# Mount query, sort, update, and options
	query =
		_id: fieldName

	sort = {}

	update =
		$inc:
			next_val: 1

	options =
		'new': true

	# Try to get next code
	try
		result = findAndModify query, sort, update, options
		if result?.value and result?.value?.next_val
			return result.value.next_val
	catch e
		throw err

	# If no results return 0
	return 0

### Populate passed data with more lookup information
	@param {String} documentName
	@param {Object} data
	@param {Object} fields  An Object with names of fields to populate with witch fields to populate

	@example
		metaUtils.populateLookupsData('Recruitment', record, {job: {code: 1}, contact: {code: 1, name: 1}})
###
metaUtils.populateLookupsData = (documentName, data, fields) ->
	check fields, Object

	meta = Meta[documentName]

	for fieldName, field of meta.fields when field.type is 'lookup' and data[fieldName]? and fields[fieldName]?
		options = {}
		if Match.test fields[fieldName], Object
			options.fields = fields[fieldName]

		if field.isList isnt true
			data[fieldName] = Models[field.document].findOne({_id: data[fieldName]._id}, options)
		else
			ids = data[fieldName]?.map (item) ->
				return item._id

			if ids.length > 0
				data[fieldName] = Models[field.document].find({_id: $in: ids}, options).fetch()

	return data
