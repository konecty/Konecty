import isString from 'lodash/isString';
import get from 'lodash/get';
import has from 'lodash/has';

import { callMethod } from 'utils/methods';

import { getAuthTokenIdFromReq } from 'utils/session';
import { Namespace } from 'metadata';

const getCookieDomain = req => {
	const domainParts = req.get('host').split('.');

	return domainParts.length > 2 ? `.${domainParts.slice(1).join('.')}` : domainParts.join('.');
};

const getIp = req => {
	const forwardedFor = req.get('x-forwarded-for');
	if (forwardedFor == null) {
		return '';
	}

	const [ip] = `${forwardedFor}`.replace(/\s/g, '').split(',');
	return ip;
};

export default app => {
	app.get('/api/v1/auth/loginByUrl/:ns/:sessionId', (req, res) => {
		req.params.sessionId = decodeURIComponent(req.params.sessionId.replace(/\s/g, '+'));

		// Verify if Namespace have a session expiration metadata config and set
		const cookieMaxAge = get(Namespace, 'sessionExpirationInSeconds', 2592000);

		// Set cookie with session id
		res.set('set-cookie', `_authTokenId=${req.params.sessionId}; domain=${getCookieDomain(req)} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);

		// Redirect to system
		return res.redirect('/');
	});

	/* Login using email and password */
	app.post('/api/v1/auth/login', async (req, res) => {
		// Map body parameters
		// eslint-disable-next-line camelcase
		const { user, password, ns, geolocation, resolution, password_SHA256 } = req.body;

		// Verify if Namespace have a session expiration metadata config and set
		const cookieMaxAge = get(Namespace, 'sessionExpirationInSeconds', 2592000);

		const userAgent = req.headers['user-agent'];

		const ip = getIp(req);

		const loginResult = await callMethod('auth:login', {
			ns,
			ip,
			user,
			password,
			password_SHA256,
			geolocation,
			resolution,
			userAgent,
		});

		if (loginResult instanceof Error) {
			res.send(401, loginResult);
		} else {
			res.send({ ...loginResult, cookieMaxAge });
		}
	});

	/* Logout currently session */
	app.get('/api/v1/auth/logout', async (req, res) => res.send(await callMethod('auth:logout', { authTokenId: getAuthTokenIdFromReq(req) })));

	/* Reset password */
	app.post('/api/v1/auth/reset', async (req, res) => {
		// Map body parameters
		const { user, ns } = req.body;

		const ip = getIp(req);

		const resetResult = await callMethod('auth:resetPassword', {
			user,
			ns,
			ip,
			host: req.get('Host'),
		});

		res.send(resetResult);
	});

	/* Set geolocation for current session */
	app.post('/api/v1/auth/setgeolocation', async (req, res) => {
		// Map body parameters
		const { longitude, latitude } = req.body;

		const userAgent = req.headers['user-agent'];

		const ip = getIp(req);

		const result = await callMethod('auth:setGeolocation', {
			authTokenId: getAuthTokenIdFromReq(req),
			longitude,
			latitude,
			userAgent,
			ip,
		});

		res.send(result);
	});

	/* Get information from current session */
	app.get('/api/v1/auth/info', async (req, res) => {
		const infoResult = await callMethod('auth:info', { authTokenId: getAuthTokenIdFromReq(req) });
		res.send(infoResult);
	});

	/* Set User password */
	app.get('/api/v1/auth/setPassword/:userId/:password', async (req, res) => {
		const setPasswordResult = await callMethod('auth:setPassword', {
			authTokenId: getAuthTokenIdFromReq(req),
			userId: req.params.userId,
			password: req.params.password,
		});
		res.send(setPasswordResult);
	});

	/* Set a random password for User and send by email */
	app.post('/api/v1/auth/setRandomPasswordAndSendByEmail', async (req, res) => {
		const result = await callMethod('auth:setRandomPasswordAndSendByEmail', {
			authTokenId: getAuthTokenIdFromReq(req),
			userIds: req.body,
		});
		res.send(result);
	});
};
