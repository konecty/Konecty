global.middlewares = {}

# Middleware to get user and populate into request
middlewares.user = (req, res, next) ->
	token = req.cookies['_authTokenId'] or req.cookies['authTokenId']
	hashedToken = Accounts._hashLoginToken token

	# Find User from session
	req.user = Meteor.users.findOne 'services.resume.loginTokens.hashedToken': $in: [ token, hashedToken ]

	# If no user was found return error
	if not req.user?
		return res.send new Meteor.Error 'internal-error', 'Token doesn\'t exists'

	if req.user.active isnt true
		return res.send new Meteor.Error 'internal-error', 'User inactive'

	# If everithing is awesome go to next step
	next()

# Middleware to get access of user and document
middlewares.getAccessFor = (documentParamName) ->
	return (req, res, next) ->
		documentName = req.params[documentParamName]

		# If no param was found with document name return 401 (Unauthorized)
		if not documentName?
			return res.send 401

		# Find access
		access = accessUtils.getAccessFor documentName, req.user

		# If return is false no access was found then return 401 (Unauthorized)
		if access is false
			return res.send 401

		# If return is object then set access into requrest
		if _.isObject access
			req.access = access
			return next()

		# Return 401 (Unauthorized) if no access was found
		return res.send 401

# Middleware to get session, user and access
middlewares.sessionUserAndGetAccessFor = (documentParamName) ->
	return (req, res, next) ->
		middlewares.user req, res, ->
			fn = middlewares.getAccessFor(documentParamName)
			fn req, res, next