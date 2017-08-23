# Middleware to get user and populate into request
Meteor.registerMiddleware 'withUser', (request) ->
	if @user?
		return

	if request?.authTokenId?
		@hashedToken = request.authTokenId


		# @TODO: In the future, use only @hashedToken = Accounts._hashLoginToken request.authTokenId as it should always receive client loginToken
		if request.authTokenId.toLowerCase? and request.authTokenId.length is 24
			@hashedToken = request.authTokenId.toLowerCase()

		if request.authTokenId.length is 43
			@hashedToken = Accounts._hashLoginToken request.authTokenId

		@user = Meteor.users.findOne 'services.resume.loginTokens.hashedToken': @hashedToken

		# If no user was found return error
		if not @user?
			console.log "[withUser] User not found using token #{@hashedToken}"
			return 401

		@userId = @user._id

	else if @userId?
		@user = Meteor.users.findOne _id: @userId

	else
		console.log '[withUser] No authTokenId or user was passed'
		return 401

	if @user.active isnt true
		console.log "[withUser] User inactive for token #{@hashedToken}"
		return 401

	# Set lastLogin if no lastLogin or is older than 1h
	if not request? or request.dontSetLastLogin isnt true
		if not @user.lastLogin? or not _.isDate(@user.lastLogin) or (Date.now() - @user.lastLogin.getTime()) > 3600000
			Meteor.defer =>
				Meteor.users.update @user._id, $set: lastLogin: new Date

	return


# Middleware to get access from document as parameter 'document'
Meteor.registerMiddleware 'withAccessForDocument', (request) ->
	if @access?
		return

	documentName = request.document

	# If no param was found with document name return 401 (Unauthorized)
	if not documentName?
		console.log '[withAccessForDocument] No documentName was passaed'
		return 401

	# Find access
	access = accessUtils.getAccessFor documentName, @user

	# If return is false no access was found then return 401 (Unauthorized)
	if access is false
		console.log '[withAccessForDocument] User have no access'
		return 401

	# If return is object then set access into requrest
	if _.isObject access
		@access = access
		return

	# Return 401 (Unauthorized) if no access was found
	console.log '[withAccessForDocument] No access found'
	return 401


# Middleware to get meta from document as parameter 'document'
Meteor.registerMiddleware 'withMetaForDocument', (request) ->
	documentName = request.document

	# If no param was found with document name return 401 (Unauthorized)
	if not documentName?
		return new Meteor.Error 'internal-error', '[withMetaForDocument] No documentName was passaed', {request: request}

	# Try to get metadata
	meta = Meta[request.document]
	if not meta?
		return new Meteor.Error 'internal-error', "[withMetaForDocument] Document [#{request.document}] does not exists", {request: request}

	@meta = meta
	return


# Middleware to get model from document as parameter 'document'
Meteor.registerMiddleware 'withModelForDocument', (request) ->
	documentName = request.document

	# If no param was found with document name return 401 (Unauthorized)
	if not documentName?
		return new Meteor.Error 'internal-error', '[withModelForDocument] No documentName was passaed', {request: request}

	# Try to get model of document
	model = Models[request.document]
	if not model?
		return new Meteor.Error 'internal-error', "[withModelForDocument] Document [#{request.document}] does not exists", {request: request}

	@model = model
	return
