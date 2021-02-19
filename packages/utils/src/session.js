const getAuthTokenIdFromReq = req => req.cookies['_authTokenId'] || req.cookies['authTokenId'] || req.headers['authorization'];

export { getAuthTokenIdFromReq };
