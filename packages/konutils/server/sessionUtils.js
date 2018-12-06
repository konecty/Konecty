sessionUtils = {};

sessionUtils.getAuthTokenIdFromReq = req =>
	req.cookies['_authTokenId'] || req.cookies['authTokenId'] || req.headers['authorization'];
