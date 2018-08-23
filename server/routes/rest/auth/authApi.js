/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
app.get('/rest/auth/loginByUrl/:ns/:sessionId', function(req, res, next) {
	let domain;
	if (Meteor.absoluteUrl().indexOf('localhost') !== -1) {
		domain = '';
	} else {
		domain = 'domain=.konecty.com;';
	}

	req.params.sessionId = decodeURIComponent(req.params.sessionId.replace(/\s/g, '+'));

	const namespace = MetaObject.findOne({_id: 'Namespace'});
	
	// Verify if Namespace have a session expiration metadata config and set
	const cookieMaxAge = (namespace.sessionExpirationInSeconds != null) ? namespace.sessionExpirationInSeconds : 2592000;
	
	// Set cookie with session id
	res.set('set-cookie', `_authTokenId=${req.params.sessionId}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);
	res.set('set-cookie', `_authTokenNs=${req.params.ns}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);

	// Redirect to system
	return res.redirect('/');
});


/* Login using email and password */
app.post('/rest/auth/login', function(req, res, next) {
	// Map body parameters
	let domain;
	const {user, password, ns, geolocation, resolution, password_SHA256} = req.body;
	
	const namespace = MetaObject.findOne({_id: 'Namespace'});

	// Verify if Namespace have a session expiration metadata config and set
	const cookieMaxAge = (namespace.sessionExpirationInSeconds != null) ? namespace.sessionExpirationInSeconds : 2592000;

	const userAgent = req.headers['user-agent'];

	if (Meteor.absoluteUrl().indexOf('localhost') !== -1) {
		domain = '';
	} else {
		domain = 'domain=.konecty.com;';
	}

	let ip = req.get('x-forwarded-for');
	if (_.isString(ip)) {
		ip = ip.replace(/\s/g, '').split(',')[0];
	}

	const loginResult = Meteor.call('auth:login', {
		ns,
		ip,
		user,
		password,
		password_SHA256,
		geolocation,
		resolution,
		userAgent
	}
	);

	if ((loginResult != null ? loginResult.success : undefined) === true) {
		// Set cookie with session id
		res.set('set-cookie', `_authTokenId=${loginResult.authId}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);
		if (_.isString(ns)) {
			res.set('set-cookie', `_authTokenNs=${ns}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);
		}

		return res.send(loginResult);
	} else {
		if ((loginResult != null ? loginResult.errors : undefined) != null) {
			return res.send(401, loginResult);
		} else {
			return res.send(loginResult);
		}
	}
});


/* Logout currently session */
app.get('/rest/auth/logout', (req, res, next) =>
	res.send(Meteor.call('auth:logout',
		{authTokenId: sessionUtils.getAuthTokenIdFromReq(req)})
	)
);


/* Reset password */
app.post('/rest/auth/reset', function(req, res, next) {
	// Map body parameters
	const {user, ns} = req.body;

	let ip = req.get('x-forwarded-for');
	if (_.isString(ip)) {
		ip = ip.replace(/\s/g, '').split(',')[0];
	}

	return res.send(Meteor.call('auth:resetPassword', {
		user,
		ns,
		ip,
		host: req.get('Host')
	}
	)
	);
});


/* Set geolocation for current session */
app.post('/rest/auth/setgeolocation', function(req, res, next) {
	// Map body parameters
	const {longitude, latitude} = req.body;

	const userAgent = req.headers['user-agent'];

	let ip = req.get('x-forwarded-for');
	if (_.isString(ip)) {
		ip = ip.replace(/\s/g, '').split(',')[0];
	}

	return res.send(Meteor.call('auth:setGeolocation', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		longitude,
		latitude,
		userAgent,
		ip
	}
	)
	);
});


/* Get information from current session*/
app.get('/rest/auth/info', (req, res, next) =>
	res.send(Meteor.call('auth:info',
		{authTokenId: sessionUtils.getAuthTokenIdFromReq(req)})
	)
);


/* Set User password */
app.get('/rest/auth/setPassword/:userId/:password', (req, res, next) =>
	res.send(Meteor.call('auth:setPassword', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		userId: req.params.userId,
		password: req.params.password
	}
	)
	)
);


/* Set a random password for User and send by email */
app.post('/rest/auth/setRandomPasswordAndSendByEmail', (req, res, next) =>
	res.send(Meteor.call('auth:setRandomPasswordAndSendByEmail', {
		authTokenId: sessionUtils.getAuthTokenIdFromReq(req),
		userIds: req.body
	}
	)
	)
);
