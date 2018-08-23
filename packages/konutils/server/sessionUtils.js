const sessionUtils = {};

sessionUtils.getAuthTokenIdFromReq = req =>
	// Get session id from cookie
	req.cookies['_authTokenId'] || req.cookies['authTokenId']
;
