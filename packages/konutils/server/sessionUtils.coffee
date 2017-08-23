sessionUtils = {}

sessionUtils.getAuthTokenIdFromReq = (req) ->
	# Get session id from cookie
	return req.cookies['_authTokenId'] or req.cookies['authTokenId']
