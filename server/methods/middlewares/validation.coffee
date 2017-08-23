# Middleware to verify if user have permission to create records
### @DEPENDS_ON_ACCESS ###
Meteor.registerMiddleware 'ifAccessIsCreateable', (request) ->
	if @access.isCreatable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to create records", {bugsnag: false}
	return


# Middleware to verify if user have permission to update records
### @DEPENDS_ON_ACCESS ###
Meteor.registerMiddleware 'ifAccessIsUpdatable', (request) ->
	if @access.isUpdatable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to update this record"
	return


# Middleware to verify if user have permission to delete records
### @DEPENDS_ON_ACCESS ###
Meteor.registerMiddleware 'ifAccessIsDeletable', (request) ->
	if @access.isDeletable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to delete this record"
	return


# Middleware to verify if update playload is valid
### @DEPENDS_ON_META ###
Meteor.registerMiddleware 'ifUpdateIsValid', (request) ->
	if not _.isObject request.data
		return new Meteor.Error 'internal-error', "[#{request.document}] Invalid payload"

	if not _.isArray(request.data.ids) or request.data.ids.length is 0
		return new Meteor.Error 'internal-error', "[#{request.document}] Payload must contain an array of ids with at least one item"

	if not _.isObject(request.data.data) or Object.keys(request.data.data).length is 0
		return new Meteor.Error 'internal-error', "[#{request.document}] Payload must contain an object with data to update with at least one item"

	meta = @meta

	for item in request.data.ids
		if not _.isObject(item) or not _.isString(item._id)
			return new Meteor.Error 'internal-error', "[#{request.document}] Each id must contain an valid _id"

		if meta.ignoreUpdatedAt isnt true
			if not _.isObject(item) or not _.isObject(item._updatedAt) or not _.isString(item._updatedAt.$date)
				return new Meteor.Error 'internal-error', "[#{request.document}] Each id must contain an date field named _updatedAt"
	return


# Middleware to verify if create playload is valid
Meteor.registerMiddleware 'ifCreateIsValid', (request) ->
	if not _.isObject request.data
		return new Meteor.Error 'internal-error', "Invalid payload"

	if not _.isObject(request.data) or Object.keys(request.data).length is 0
		return new Meteor.Error 'internal-error', "[#{request.document}] Payload must contain an object with at least one item"

	return
