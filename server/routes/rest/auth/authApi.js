import { Meteor } from 'meteor/meteor';
import { StatusCodes } from 'http-status-codes';

import { isString, get, has } from 'lodash';

import { app } from '/server/lib/routes/app.js';
import { MetaObject, Namespace } from '/imports/model/MetaObject';
import { getAuthTokenIdFromReq } from '/imports/utils/sessionUtils';
import { login } from '/imports/auth/login';
import { logout } from '/imports/auth/logout';
import { saveGeoLocation } from '/imports/auth/geolocation';
import { userInfo } from '/imports/auth/info';
import { setPassword, resetPassword } from '/imports/auth/password';

function getDomain(host) {
	if (host == null || /^localhost/.test(host)) {
		return '';
	} else {
		const server = host.split('.').slice(1).join('.');
		return `domain=${server}`;
	}
}

app.get('/rest/auth/loginByUrl/:ns/:sessionId', async function (req, res) {
	const domain = getDomain(req.headers['host']);

	req.params.sessionId = decodeURIComponent(req.params.sessionId.replace(/\s/g, '+'));

	// Verify if Namespace have a session expiration metadata config and set
	const cookieMaxAge = get(Namespace, 'sessionExpirationInSeconds', 2592000);

	// Set cookie with session id
	res.set('set-cookie', `_authTokenId=${req.params.sessionId}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);

	// Redirect to system
	return res.redirect('/');
});

/* Login using email and password */
app.post('/rest/auth/login', async function (req, res) {
	// Map body parameters
	const { user, password, ns, geolocation, resolution, password_SHA256 } = req.body;

	const namespace = MetaObject.findOne({ _id: 'Namespace' });

	// Verify if Namespace have a session expiration metadata config and set
	const cookieMaxAge = get(namespace, 'sessionExpirationInSeconds', 2592000);

	const userAgent = req.headers['user-agent'];

	const domain = getDomain(req.headers['host']);

	let ip = req.get('x-forwarded-for');
	if (isString(ip)) {
		ip = ip.replace(/\s/g, '').split(',')[0];
	}

	const loginResult = await login({
		ns,
		ip,
		user,
		password,
		password_SHA256,
		geolocation,
		resolution,
		userAgent,
	});

	if (get(loginResult, 'success', false) === true) {
		// Set cookie with session id
		if (isString(ns)) {
			res.set('set-cookie', `_authTokenNs=${ns}; _authTokenId=${loginResult.authId}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);
		} else {
			res.set('set-cookie', `_authTokenId=${loginResult.authId}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);
		}

		res.send({ ...loginResult, cookieMaxAge });
	} else {
		if (has(loginResult, 'errors')) {
			res.send(401, loginResult);
		} else {
			res.send({ ...loginResult, cookieMaxAge });
		}
	}
});

/* Logout currently session */
app.get('/rest/auth/logout', async (req, res) => {
	try {
		const authTokenId = getAuthTokenIdFromReq(req);
		const result = await logout(authTokenId);

		if ((result.success = true)) {
			res.set('set-cookie', `_authTokenId=; Version=1; Path=/; Max-Age=0`);
			res.send(StatusCodes.OK, result);
		} else {
			res.send(StatusCodes.UNAUTHORIZED, result);
		}
	} catch (error) {
		res.send(StatusCodes.INTERNAL_SERVER_ERROR, { success: false, errors: [{ message: error.message }] });
	}
});

/* Reset password */
app.post('/rest/auth/reset', async function (req, res) {
	// Map body parameters
	const { user, ns } = req.body;

	let ip = req.get('x-forwarded-for');
	if (isString(ip)) {
		ip = ip.replace(/\s/g, '').split(',')[0];
	}

	const result = await resetPassword({ user, ns, ip, host: req.get('Host') });

	res.send(result);
});

/* Set geolocation for current session */
app.post('/rest/auth/setgeolocation', async function (req, res) {
	try {
		const { longitude, latitude } = req.body;

		const userAgent = req.headers['user-agent'];

		let ip = req.get('x-forwarded-for');
		if (isString(ip)) {
			ip = ip.replace(/\s/g, '').split(',')[0];
		}

		const authTokenId = getAuthTokenIdFromReq(req);

		const result = await saveGeoLocation({ authTokenId, longitude, latitude, userAgent, ip });

		res.send(result);
	} catch (error) {
		res.send(StatusCodes.INTERNAL_SERVER_ERROR, { success: false, errors: [{ message: error.message }] });
	}
});

/* Get information from current session*/
app.get('/rest/auth/info', async (req, res) => {
	const authTokenId = getAuthTokenIdFromReq(req);
	const result = await userInfo(authTokenId);
	res.send(result);
});

/* Set User password */
app.get('/rest/auth/setPassword/:userId/:password', async (req, res) => {
	const authTokenId = getAuthTokenIdFromReq(req);
	const result = await setPassword({ authTokenId, userId: req.params.userId, password: req.params.password });
	res.send(result);
});

/* Set a random password for User and send by email */
app.post('/rest/auth/setRandomPasswordAndSendByEmail', (req, res) => {
	console.dir({ setRandomPasswordAndSendByEmail: req.body });
	return res.send(
		Meteor.call('auth:setRandomPasswordAndSendByEmail', {
			authTokenId: getAuthTokenIdFromReq(req),
			userIds: req.body,
			host: req.get('Host'),
		}),
	);
});
