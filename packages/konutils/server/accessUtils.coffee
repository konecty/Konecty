accessUtils = {}

accessUtils.getFieldConditions = (metaAccess, fieldName) ->
	accessField = metaAccess.fields and metaAccess.fields[fieldName]

	conditions = {}

	if accessField?.UPDATE?.condition?
		conditions.UPDATE = accessField.UPDATE.condition

	if accessField?.CREATE?.condition?
		conditions.CREATE = accessField.CREATE.condition

	if accessField?.READ?.condition?
		conditions.READ = accessField.READ.condition

	return conditions

accessUtils.getFieldPermissions = (metaAccess, fieldName) ->
	accessField = metaAccess.fields and metaAccess.fields[fieldName]

	access =
		isUpdatable: true
		isCreatable: true
		isDeletable: true
		isReadable: true

	if accessField?.UPDATE?.allow?
		access.isUpdatable = accessField.UPDATE.allow is true
	else
		access.isUpdatable = metaAccess.fieldDefaults.isUpdatable is true

	if accessField?.CREATE?.allow?
		access.isCreatable = accessField.CREATE.allow is true
	else
		access.isCreatable = metaAccess.fieldDefaults.isCreatable is true

	if accessField?.READ?.allow?
		access.isReadable = accessField.READ.allow is true
	else
		access.isReadable = metaAccess.fieldDefaults.isReadable is true

	access.isDeletable = metaAccess.fieldDefaults.isDeletable is true

	if metaAccess.isUpdatable isnt true
		access.isUpdatable = false

	if metaAccess.isCreatable isnt true
		access.isCreatable = false

	if metaAccess.isDeletable isnt true
		access.isDeletable = false

	if metaAccess.isReadable isnt true
		access.isReadable = false

	return access

accessUtils.getAccessFor = (documentName, user) ->
	# If user has no access defined set access as defaults: 'Default'
	if not user.access? or user.access is null
		user.access =
			defaults: 'Default'

	# If user has no default access set as 'Default'
	if not user.access.defaults? or user.access.defaults is null
		user.access.defaults = 'Default'

	# If user has not access for Document Name set as defaults
	if not user.access[documentName]? or user.access[documentName] is null
		user.access[documentName] = user.access.defaults

	accessName = user.access[documentName]

	# Return false to Deny if access is false
	if accessName is false
		return false

	# If accessName is String or Array try to use it
	if _.isArray(accessName) or _.isString(accessName)
		accessName = [].concat accessName

		# Try to get named access of module
		for name in accessName
			access = global.Access["#{documentName}:access:#{name}"]
			if access?
				return access

		# Try to get named access of Default
		for name in accessName
			access = global.Access["Default:access:#{name}"]
			if access?
				return access

		# Return false to Deny
		return false

	# Return false if no access was found
	return false

accessUtils.removeUnauthorizedDataForRead = (metaAccess, data) ->
	if not _.isObject data
		return data

	for fieldName, value of data
		access = accessUtils.getFieldPermissions metaAccess, fieldName
		if access.isReadable isnt true
			delete data[fieldName]

	return data