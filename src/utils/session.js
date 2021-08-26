const getAuthTokenIdFromReq = req => {
	// eslint-disable-next-line no-underscore-dangle
	const token = req.cookies._authTokenId || req.cookies.authTokenId || req.headers.authorization;

	if (/^Bearer/i.test(token)) {
		return token.replace(/^Bearer[ ]+/i, '');
	}
	return token;
};

// eslint-disable-next-line import/prefer-default-export
export { getAuthTokenIdFromReq };
