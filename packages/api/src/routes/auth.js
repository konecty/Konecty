import isString from 'lodash/isString';
import get from 'lodash/get';
import has from 'lodash/has';

import { callMethod } from '@konecty/utils/methods';

import { getAuthTokenIdFromReq } from '@konecty/utils/session';
import { Namespace } from '@konecty/metadata';

const getCookieDomain = req => {
	const domainParts = req.get('host').split('.');

	return domainParts.length > 2 ? `.${domainParts.slice(1).join('.')}` : domainParts.join('.');
};

const init = app => {
	app.get('/rest/auth/loginByUrl/:ns/:sessionId', function (req, res) {
		req.params.sessionId = decodeURIComponent(req.params.sessionId.replace(/\s/g, '+'));

		// Verify if Namespace have a session expiration metadata config and set
		const cookieMaxAge = get(Namespace, 'sessionExpirationInSeconds', 2592000);

		// Set cookie with session id
		res.set('set-cookie', `_authTokenId=${req.params.sessionId}; domain=${getCookieDomain(req)} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);

		// Redirect to system
		return res.redirect('/');
	});

	/* Login using email and password */
	app.post('/rest/auth/login', async function (req, res) {
		// Map body parameters
		const { user, password, ns, geolocation, resolution, password_SHA256 } = req.body;

		// Verify if Namespace have a session expiration metadata config and set
		const cookieMaxAge = get(Namespace, 'sessionExpirationInSeconds', 2592000);

		const userAgent = req.headers['user-agent'];

		let ip = req.get('x-forwarded-for');
		if (isString(ip)) {
			ip = ip.replace(/\s/g, '').split(',')[0];
		}

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

		if (get(loginResult, 'success', false) === true) {
			// Set cookie with session id
			if (isString(ns)) {
				res.set(
					'set-cookie',
					`_authTokenNs=${ns}; _authTokenId=${loginResult.authId}; domain=${getCookieDomain(req)} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`,
				);
			} else {
				res.set('set-cookie', `_authTokenId=${loginResult.authId}; domain=${getCookieDomain(req)} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);
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
	app.get('/rest/auth/logout', async (req, res) => res.send(await callMethod('auth:logout', { authTokenId: getAuthTokenIdFromReq(req) })));

	/* Reset password */
	app.post('/rest/auth/reset', async function (req, res) {
		// Map body parameters
		const { user, ns } = req.body;

		let ip = req.get('x-forwarded-for');
		if (isString(ip)) {
			ip = ip.replace(/\s/g, '').split(',')[0];
		}

		const resetResult = await callMethod('auth:resetPassword', {
			user,
			ns,
			ip,
			host: req.get('Host'),
		});

		res.send(resetResult);
	});

	/* Set geolocation for current session */
	app.post('/rest/auth/setgeolocation', async function (req, res) {
		// Map body parameters
		const { longitude, latitude } = req.body;

		const userAgent = req.headers['user-agent'];

		let ip = req.get('x-forwarded-for');
		if (isString(ip)) {
			ip = ip.replace(/\s/g, '').split(',')[0];
		}

		const result = await callMethod('auth:setGeolocation', {
			authTokenId: getAuthTokenIdFromReq(req),
			longitude,
			latitude,
			userAgent,
			ip,
		});

		res.send(result);
	});

	/* Get information from current session*/
	app.get('/rest/auth/info', async (req, res) => {
		const infoResult = await callMethod('auth:info', { authTokenId: getAuthTokenIdFromReq(req) });
		res.send(infoResult);
	});

	/* Set User password */
	app.get('/rest/auth/setPassword/:userId/:password', async (req, res) => {
		const setPasswordResult = await callMethod('auth:setPassword', {
			authTokenId: getAuthTokenIdFromReq(req),
			userId: req.params.userId,
			password: req.params.password,
		});
		res.send(setPasswordResult);
	});

	/* Set a random password for User and send by email */
	app.post('/rest/auth/setRandomPasswordAndSendByEmail', async (req, res) => {
		const result = await callMethod('auth:setRandomPasswordAndSendByEmail', {
			authTokenId: getAuthTokenIdFromReq(req),
			userIds: req.body,
		});
		res.send(result);
	});
};

export { init };
