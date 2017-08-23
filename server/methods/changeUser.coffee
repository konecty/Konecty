validateRequest = (request, access) ->
	# Verify if user have permission to update record
	if access.isUpdatable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to update this record"

	if access.changeUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to change users"

	if not _.isArray(request.users) or request.users.length is 0
		return new Meteor.Error 'internal-error', "[#{request.document}] You need to provide the property [users] as an array with at least one item", {request: request}

	for user in request.users when _.isObject(user) isnt true or _.isString(user.id) isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] Each user must be and Object with an [_id] as String", {request: request}

	if not _.isArray(request.ids) or request.ids.length is 0
		return new Meteor.Error 'internal-error', "[#{request.document}] You need to provide the property [ids] as an array with at least one item", {request: request}

	for id in request.ids when _.isString(id) isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] Each id must be String", {request: request}


### Add users
	@param authTokenId
	@param document
	@param ids
	@param users
###
Meteor.registerMethod 'changeUser:add', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	if @access.addUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to add users"

	validateRequestResult = validateRequest request, @access
	if validateRequest instanceof Error
		return validateRequest

	resultOfValidation = metaUtils.validateAndProcessValueFor @meta, '_user', request.users, 'update', @model, {}, {}, request.ids
	if resultOfValidation instanceof Error
		return resultOfValidation

	for user in request.users
		now = new Date

		query =
			_id:
				$in: request.ids
			'_user._id':
				$ne: user._id

		update =
			$push:
				_user:
					$each: [user]
					$position: 0
			$set:
				_updatedAt: now
				_updatedBy:
					_id: @user._id
					name: @user.name
					group: @user.group
					ts: now

		options =
			multi: true

		try
			@model.update query, update, options
		catch e
			return e

	return success: true


### Remove users
	@param authTokenId
	@param document
	@param ids
	@param users
###
Meteor.registerMethod 'changeUser:remove', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	if @access.removeUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to remove users"

	validateRequestResult = validateRequest request, @access
	if validateRequest instanceof Error
		return validateRequest

	userIds = request.users.map (user) -> user._id

	now = new Date

	query =
		_id:
			$in: request.ids
		'_user._id':
			$in: userIds

	update =
		$pull:
			_user:
				_id:
					$in: userIds
		$set:
			_updatedAt: now
			_updatedBy:
				_id: @user._id
				name: @user.name
				group: @user.group
				ts: now

	options =
		multi: true

	try
		@model.update query, update, options
	catch e
		return e

	return success: true


### Define users
	@param authTokenId
	@param document
	@param ids
	@param users
###
Meteor.registerMethod 'changeUser:define', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	if @access.defineUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to define users"

	validateRequestResult = validateRequest request, @access
	if validateRequest instanceof Error
		return validateRequest

	resultOfValidation = metaUtils.validateAndProcessValueFor @meta, '_user', request.users, 'update', @model, {}, {}, request.ids
	if resultOfValidation instanceof Error
		return resultOfValidation

	now = new Date

	query =
		_id:
			$in: request.ids

	update =
		$set:
			_user: request.users
			_updatedAt: now
			_updatedBy:
				_id: @user._id
				name: @user.name
				group: @user.group
				ts: now

	options =
		multi: true

	try
		@model.update query, update, options
	catch e
		return e

	return success: true


### Replace users
	@param authTokenId
	@param document
	@param ids
	@param users
###
Meteor.registerMethod 'changeUser:replace', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	if @access.replaceUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to replace users"

	access = @access

	# Verify if user have permission to update record
	if access.isUpdatable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to update this record"

	if access.changeUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to change users"

	if not _.isObject(request.from) or not _.isString(request.from._id)
		return new Meteor.Error 'internal-error', "[#{request.document}] You need to provide the property [from] as an Object with an [_id] as String", {request: request}

	if not _.isObject(request.to) or not _.isString(request.to._id)
		return new Meteor.Error 'internal-error', "[#{request.document}] You need to provide the property [to] as an Object with an [_id] as String", {request: request}

	if not _.isArray(request.ids) or request.ids.length is 0
		return new Meteor.Error 'internal-error', "[#{request.document}] You need to provide the property [ids] as an array with at least one item", {request: request}

	for id in request.ids when _.isString(id) isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] Each id must be String", {request: request}


	resultOfValidation = metaUtils.validateAndProcessValueFor @meta, '_user', [request.to], 'update', @model, {}, {}, request.ids
	if resultOfValidation instanceof Error
		return resultOfValidation

	now = new Date

	query =
		_id:
			$in: request.ids
		'_user._id': request.from._id

	update =
		$push:
			_user:
				$each: [request.to]
				$position: 0
		$set:
			_updatedAt: now
			_updatedBy:
				_id: @user._id
				name: @user.name
				group: @user.group
				ts: now

	options =
		multi: true

	try
		@model.update query, update, options
	catch e
		return e

	now = new Date

	update =
		$pull:
			_user:
				_id: request.from._id
		$set:
			_updatedAt: now
			_updatedBy:
				_id: @user._id
				name: @user.name
				group: @user.group
				ts: now

	try
		@model.update query, update, options
	catch e
		return e

	return success: true


### Count inactive users
	@param authTokenId
	@param document
	@param ids
###
Meteor.registerMethod 'changeUser:countInactive', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	if @access.removeInactiveUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to remove inactive users"

	# Verify if user have permission to update records
	if @access.isUpdatable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to update this record"

	if @access.changeUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to change users"

	for id in request.ids when _.isString(id) isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] Each id must be String", {request: request}

	query =
		_id:
			$in: request.ids
		'_user.active': false

	try
		count = @model.find(query).count()
		return {
			success: true,
			count: count
		}
	catch e
		return e


### Remove inactive users
	@param authTokenId
	@param document
	@param ids
###
Meteor.registerMethod 'changeUser:removeInactive', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	if @access.removeInactiveUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to remove inactive users"

	# Verify if user have permission to update records
	if @access.isUpdatable isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to update this record"

	if @access.changeUser isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to change users"

	for id in request.ids when _.isString(id) isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] Each id must be String", {request: request}

	now = new Date

	query =
		_id:
			$in: request.ids
		'_user.active': false

	update =
		$pull:
			_user:
				active: false
		$set:
			_updatedAt: now
			_updatedBy:
				_id: @user._id
				name: @user.name
				group: @user.group
				ts: now

	options =
		multi: true

	try
		@model.update query, update, options
	catch e
		return e

	return success: true


### Set queue and user
	@param authTokenId
	@param document
	@param ids
	@param queue
###
Meteor.registerMethod 'changeUser:setQueue', 'withUser', 'withAccessForDocument', 'withMetaForDocument', 'withModelForDocument', (request) ->
	if @access.defineUserWithQueue isnt true
		return new Meteor.Error 'internal-error', "[#{request.document}] You don't have permission to define users using queue"

	validateRequestResult = validateRequest request, @access
	if validateRequest instanceof Error
		return validateRequest

	queue = metaUtils.validateAndProcessValueFor @meta, 'queue', request.queue, 'update', @model, {}, {}, id
	if queue instanceof Error
		return queue

	now = new Date

	for id in request.ids
		userQueue = metaUtils.getNextUserFromQueue request.queue._id, @user
		user = metaUtils.validateAndProcessValueFor @meta, '_user', userQueue.user, 'update', @model, {}, {}, id
		if user instanceof Error
			return user

		query =
			_id: id

		update =
			$set:
				queue: queue
				_user: user
				_updatedAt: now
				_updatedBy:
					_id: @user._id
					name: @user.name
					group: @user.group
					ts: now

		try
			@model.update query, update
		catch e
			return e

	return success: true
