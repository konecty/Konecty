vm = Npm.require 'vm'
momentzone = Npm.require 'moment-timezone'

utils = {}

utils.deepEqual = (a, b) ->
	if not b? and not a?
		return true

	if not b? or not a?
		return false

	compareObject = ->
		if a instanceof Meteor.Collection.ObjectID and b instanceof Meteor.Collection.ObjectID
			return a._str is b._str

		if a instanceof Meteor.Collection.ObjectID or b instanceof Meteor.Collection.ObjectID
			return false

		if Object.keys(a).length isnt Object.keys(b).length
			return false

		for key, value of a
			if utils.deepEqual(value, b[key]) isnt true
				return false
		return true

	compareArray = ->
		if a.length isnt b.length
			return false

		for item, index in a
			if utils.deepEqual(item, b[index]) isnt true
				return false
		return true

	if typeof a isnt typeof b
		return false

	if _.isArray a
		if not _.isArray b
			return false
		return compareArray()

	if _.isDate a
		if not _.isDate b
			return false

		return a.getTime() is b.getTime()

	if _.isObject a
		if not _.isObject b
			return false

		return compareObject()

	return a is b

utils.copyObjectFieldsByPaths = (fromObject, toObject, paths) ->
	for path in paths
		sections = path.split '.'
		leaf = sections.pop()

		walkFrom = fromObject
		walkTo = toObject

		for section in sections
			if not _.isObject walkFrom[section]
				continue

			if not _.isObject walkTo[section]
				walkTo[section] = {}

			walkFrom = walkFrom[section]
			walkTo = walkTo[section]

		if walkFrom[leaf]?
			walkTo[leaf] = walkFrom[leaf]

utils.copyObjectFieldsByPathsIncludingIds = (fromObject, toObject, paths) ->
	pathsToAdd = []

	if paths.indexOf('_id') is -1
		pathsToAdd.push '_id'

	for path in paths
		sections = path.split '.'
		if sections.length > 1
			pathsToAdd.push "#{sections[0]}._id"

	paths = pathsToAdd.concat paths

	utils.copyObjectFieldsByPaths fromObject, toObject, paths

utils.getTermsOfFilter = (filter) ->
	terms = []
	if not _.isObject filter
		return terms

	if _.isArray filter.conditions
		for condition in filter.conditions
			terms.push condition.term

	else if _.isObject filter.conditions
		for key, condition of filter.conditions
			terms.push condition.term

	if _.isArray filter.filters
		for i in filter.filters
			terms = terms.concat utils.getTermsOfFilter i

	return terms

utils.getFirstPartOfArrayOfPaths = (paths) ->
	if not _.isArray paths
		return paths

	return paths.map (i) ->
		i.split('.')[0]


utils.getObjectIdString = (objectId) ->
	if objectId instanceof Meteor.Collection.ObjectID
		return objectId._str

	if objectId instanceof MongoInternals.NpmModule.ObjectID
		return objectId.toString()

	if _.isObject(objectId) and _.isString(objectId.$oid)
		return objectId.$oid

	return objectId

utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind = (fieldsString) ->
	fields = {}

	if _.isString fieldsString
		fieldsArray = fieldsString.replace(/\s/g, '').split ','
		for key in fieldsArray
			fields[key] = 1

	return fields

utils.rpad = (str, length) ->
	str += ' ' while str.length < length
	return str

utils.getByLocale = (obj, user) ->
	if not user?.locale? or not obj?[user.locale]?
		return

	return obj[user.locale]

utils.getLabel = (obj, user) ->
	if not obj?.label?
		return

	return utils.getByLocale obj.label, user

utils.getPlurals = (obj, user) ->
	if not obj?.plurals?
		return

	return utils.getByLocale obj.plurals, user

utils.convertObjectIdsToFn = (values, fn) ->
	if _.isArray values
		values.forEach (item, index) ->
			values[index] = utils.convertObjectIdsToFn item, fn
		return values

	if _.isObject values
		if values instanceof Mongo.ObjectID
			return fn values._str

		_.each values, (value, key) ->
			values[key] = utils.convertObjectIdsToFn value, fn
		return values

	return values

utils.recursiveObject = (obj, fn) ->
	if not _.isObject obj
		return obj

	_.each obj, (value, key) ->
		if _.isObject value
			utils.recursiveObject value, fn

		if _.isArray value
			_.each value, (item) ->
				if _.isObject item
					utils.recursiveObject item, fn

		fn key, value, obj

# Runs script in a sandboxed environment and returns resulting object
utils.runScriptBeforeValidation = (script, data, req, extraData) ->
	try
		user = JSON.parse JSON.stringify req.user if req.user?
		contextData =
			data: data
			emails: []
			user: user
			console: console
			extraData: extraData

		sandbox = vm.createContext contextData
		script = "result = (function(data, emails, user, console) { " + script + " })(data, emails, user, console);"
		vm.runInContext script, sandbox

		# Check if scriptBeforeValidation added any e-mails to be sent
		# Accepted values:
		#	emails.push({ from: '', to: '', server: '', subject: '', html: '' });
		#	emails.push({ from: '', to: '', server: '', subject: '', template: '_id', data: {  } });
		#	emails.push({ from: '', to: '', server: '', template: '_id', data: {  } });
		if sandbox.emails? and _.isArray(sandbox.emails) and sandbox.emails.length > 0 and Models?['Message']?
			sandbox.emails = JSON.parse(JSON.stringify(sandbox.emails))
			for email in sandbox.emails
				if email.relations?
					email.data = metaUtils.populateLookupsData(req.meta._id, data, email.relations)
				if email.toPath?
					email.to = utils.getObjectPathAgg(email.data, email.toPath)

				# HACK for dealing with modified date fields and inserting emails
				for key, value of email.data
					if _.isString(value?['$date'])
						email.data[key] = new Date(value['$date'])

				email.type = 'Email'
				email.status = 'Send'

				Models['Message'].insert email

		if sandbox.result? and _.isObject sandbox.result
			return sandbox.result
		else
			return {}
	catch e
		req.notifyError 'runScriptBeforeValidation', e, {script: script, data: data}
		return {}

# Runs script in a sandboxed environment and returns resulting object
utils.runValidationScript = (script, data, req, extraData) ->
	try
		user = JSON.parse JSON.stringify req.user if req.user?
		contextData =
			data: data
			user: user
			console: console
			extraData: extraData

		sandbox = vm.createContext contextData
		script = "result = (function(data, user, console) { " + script + " })(data, user, console);"
		vm.runInContext script, sandbox

		if sandbox.result? and _.isObject sandbox.result
			return sandbox.result
		else
			return {}
	catch e
		req.notifyError 'runValidationScript', e, {script: script, data: data}
		return {}

utils.runScriptAfterSave = (script, data, context, extraData) ->
	try
		# exposed Meteor.call for sandboxed script
		konectyCall = (method) ->
			if method.match /^auth:/
				throw new Meteor.Error 'invalid-method', 'Trying to call an invalid method'

			Meteor.call.apply context, arguments

		user = JSON.parse JSON.stringify context.user if context.user?
		contextData =
			data: data
			user: user
			console: console
			konectyCall: konectyCall
			Models: Models
			extraData: extraData
			moment: moment
			momentzone: momentzone

		sandbox = vm.createContext contextData
		script = "result = (function(data, user, console, Models, konectyCall, extraData) { " + script + " })(data, user, console, Models, konectyCall, extraData);"
		vm.runInContext script, sandbox

		if sandbox.result? and _.isObject sandbox.result
			return sandbox.result
		else
			return {}
	catch e
		console.log 'scriptAfterSave Error ->'.red, e
		context.notifyError 'runScriptAfterSave', e, {script: script, data: data}
		return {}

utils.formatValue = (value, field, ignoreIsList) ->
	if not value?
		return ''

	if field.isList is true and ignoreIsList isnt true
		values = []
		for item in value
			values.push utils.formatValue item, field, true
		return values.join ', '

	switch field.type
		# TODO time

		when 'boolean'
			return if value is true then 'Sim' else 'Não'
		when 'personName'
			return value.full
		when 'lookup'
			result = []

			recursive = (field, value) ->
				if field.type is 'lookup'
					meta = Meta[field.document]
					recursiveValues = []

					_.each field.descriptionFields, (descriptionField) ->
						descriptionField = descriptionField.split '.'

						descriptionField = meta.fields[descriptionField[0]]

						if descriptionField and _.isObject value
							recursiveValues.push recursive descriptionField, value[descriptionField.name]

					return recursiveValues

				value = utils.formatValue value, field
				return value

			result = recursive field, value

			sort = (items) ->
				return items.sort (a, b) ->
					return _.isArray a

			resultRecursive = (items) ->
				if _.isArray items
					items = sort items
					_.each items, (item, index) ->
						items[index] = resultRecursive item

					return '(' + items.join(' - ') + ')'

				return items

			result = sort result
			_.each result, (r, index) ->
				result[index] = resultRecursive r

			return result.join ' - '
		when 'address'
			result = []
			value.placeType? && result.push "#{value.placeType}"
			value.place? && result.push " #{value.place}"
			value.number? && result.push ", #{value.number}"
			value.complement? && result.push ", #{value.complement}"
			value.district? && result.push ", #{value.district}"
			value.city? && result.push ", #{value.city}"
			value.state? && result.push ", #{value.state}"
			value.country? && result.push ", #{value.country}"
			value.postalCode? && result.push ", #{value.postalCode}"
			return result.join ''
		when 'phone'
			result = []
			value.countryCode? && result.push "#{value.countryCode}"
			value.phoneNumber? && value.phoneNumber.length > 6 && result.push " (#{value.phoneNumber.substr(0,2)}) #{(value.phoneNumber).substr(2,4)}-#{(value.phoneNumber).substr(6)}"
			return result.join ''
		when 'money'
			result = []
			if value?.currency? && value.currency is 'BRL'
				return "R$ #{_.numberFormat(value.value, 2, ',', '.')}"
			else
				return "$ #{_.numberFormat(value.value, 2)}"
		when 'date'
			if value.toISOString?
				return value.toISOString().replace /^(\d{4})-(\d{2})-(\d{2}).*/, "$3/$2/$1"
			else
				return value
		when 'dateTime'
			if value.toISOString?
				return value.toISOString().replace /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).*/, "$3/$2/$1 $4:$5:$6"
			else
				return value
		when 'filter'
			return "(filtro)"
		when 'picklist'
			if _.isArray value
				return value.join ', '
			else
				return value
		else
			return value

utils.getObjectPathAgg = (obj, path, defaultValue) ->
	if not path?
		return obj

	if not obj?
		return defaultValue

	if _.isString path
		return utils.getObjectPathAgg obj, path.split('.'), defaultValue

	currentPath = path[0]

	if path.length is 1
		if obj[currentPath] is undefined
			return defaultValue

		return obj[currentPath]

	value
	if _.isArray(obj[currentPath]) and not /^\d$/.test(path[1])
		value = []
		path = path.slice(1)
		for item in obj[currentPath]
			value = value.concat utils.getObjectPathAgg item, path, defaultValue
	else
		value = utils.getObjectPathAgg obj[currentPath], path.slice(1), defaultValue

	return value

utils.setObjectByPath = (obj, keyPath, value) ->
	lastKeyIndex = keyPath.length-1
	for i in [0...lastKeyIndex]
		key = keyPath[i]
		if not (key in obj)
			obj[key] = {}
		obj = obj[key]

	obj[keyPath[lastKeyIndex]] = value
