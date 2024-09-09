import formbody from '@fastify/formbody';
import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

import { StatusCodes } from 'http-status-codes';

import get from 'lodash/get';
import has from 'lodash/has';
import isString from 'lodash/isString';

import { saveGeoLocation } from '@imports/auth/geolocation';
import { userInfo } from '@imports/auth/info';
import { login } from '@imports/auth/login';
import { logout } from '@imports/auth/logout';
import { resetPassword, setPassword } from '@imports/auth/password';
import { setRandomPasswordAndSendByEmail } from '@imports/auth/password/email';
import { MetaObject } from '@imports/model/MetaObject';
import { KonectyResult } from '@imports/types/result';
import { getAuthTokenIdFromReq } from '@imports/utils/sessionUtils';

function getDomain(host: string | undefined) {
	if (host == null || /^localhost/.test(host)) {
		return '';
	} else {
		const server = host.split('.').slice(1).join('.');
		return `domain=.${server}`;
	}
}

export const authApi: FastifyPluginCallback = (fastify, _, done) => {
	fastify.register(formbody);

	fastify.get<{ Params: { ns: string; sessionId: string } }>('/rest/auth/loginByUrl/:ns/:sessionId', async function (req, reply) {
		const domain = getDomain(req.headers['host']);

		req.params.sessionId = decodeURIComponent(req.params.sessionId.replace(/\s/g, '+'));

		// Verify if MetaObject.Namespace have a session expiration metadata config and set
		const cookieMaxAge = get(MetaObject.Namespace, 'sessionExpirationInSeconds', 2592000);

		// Set cookie with session id
		reply.header('set-cookie', `_authTokenNs=${req.params.ns}; _authTokenId=${req.params.sessionId}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);

		// Redirect to system
		return reply.redirect('/');
	});

	/* Login using email and password */
	fastify.post<{
		Body: {
			user: string;
			password: string;
			ns?: string;
			geolocation?: { longitude: number; latitude: number };
			resolution?: { width: number; height: number };
			password_SHA256?: string;
			source?: string;
		};
	}>('/rest/auth/login', async function (req, reply) {
		// Map body parameters
		const { user, password, ns, geolocation, resolution, password_SHA256, source } = req.body;

		const namespace = await MetaObject.MetaObject.findOne({ _id: 'MetaObject.Namespace' } as unknown as any);

		// Verify if MetaObject.Namespace have a session expiration metadata config and set
		const cookieMaxAge = get(namespace, 'sessionExpirationInSeconds', 2592000);

		const userAgent = req.headers['user-agent'];

		const domain = getDomain(req.headers['host']);

		let ip = req.headers['x-forwarded-for'];
		if (isString(ip)) {
			ip = ip.replace(/\s/g, '').split(',')[0];
		}

		const loginResult = await login({
			ip,
			user,
			password,
			password_SHA256,
			geolocation,
			resolution,
			userAgent,
			source,
		});

		if (get(loginResult, 'success', false) === true) {
			// Set cookie with session id
			if (isString(ns)) {
				reply.header('set-cookie', `_authTokenNs=${ns}; _authTokenId=${loginResult.authId}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);
			} else {
				reply.header('set-cookie', `_authTokenId=${loginResult.authId}; ${domain} Version=1; Path=/; Max-Age=${cookieMaxAge.toString()}`);
			}

			return reply.send({ ...loginResult, cookieMaxAge });
		} else {
			if (has(loginResult, 'errors')) {
				return reply.status(401).send(loginResult);
			} else {
				return reply.send({ ...loginResult, cookieMaxAge });
			}
		}
	});

	/* Logout currently session */
	fastify.get<{ Reply: KonectyResult }>('/rest/auth/logout', async (req, reply) => {
		try {
			const authTokenId = getAuthTokenIdFromReq(req);
			const result = await logout(authTokenId);

			const origin = req.headers['origin'];

			if (origin) {
				const suffix = origin.match(/(\.dev|\.com)(\.br)?/g)?.[0];

				const domainNoSuffix = origin
					.replace(/https?:\/\//, '')
					.replace(/:\d+/, '')
					.replace(/(\.dev|\.com)(\.br)?/g, '')
					.split('.')
					.reverse()[0];

				reply.header('set-cookie', `_authTokenId=; Domain=${domainNoSuffix}${suffix}; Version=1; Path=/; Max-Age=0`);
			}

			reply.header('set-cookie', `_authTokenId=; Version=1; Path=/; Max-Age=0`);
			return reply.send(result as KonectyResult);
		} catch (error) {
			return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ success: false, errors: [{ message: (error as Error).message }] });
		}
	});
	/* Reset password */

	fastify.post<{
		Body: {
			user: string;
			ns?: string;
		};
	}>('/rest/auth/reset', async function (req, reply) {
		const { user, ns } = req.body;

		const result = await resetPassword({ user, ns: ns ?? '', host: req.headers['host'] ?? '' });

		return reply.send(result);
	});

	/* Set geolocation for current session */
	fastify.post<{
		Body: {
			longitude: number;
			latitude: number;
		};
	}>('/rest/auth/setgeolocation', async function (req, reply) {
		try {
			const { longitude, latitude } = req.body;

			const userAgent = req.headers['user-agent'];

			let ip = req.headers['x-forwarded-for'];
			if (isString(ip)) {
				ip = ip.replace(/\s/g, '').split(',')[0];
			}

			const authTokenId = getAuthTokenIdFromReq(req);

			const result = await saveGeoLocation({ authTokenId, longitude, latitude, userAgent, ip });

			return reply.send(result);
		} catch (error) {
			return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ success: false, errors: [{ message: (error as Error).message }] });
		}
	});

	/* Get information from current session*/
	fastify.get('/rest/auth/info', async function (req, reply) {
		try {
			const authTokenId = getAuthTokenIdFromReq(req);
			const result = await userInfo(authTokenId);
			return reply.send(result);
		} catch (error) {
			return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ success: false, errors: [{ message: (error as Error).message }] });
		}
	});

	/* Set User password */
	fastify.get<{
		Params: {
			userId: string;
			password: string;
		};
	}>('/rest/auth/setpassword/:userId/:password', async function (req, reply) {
		const authTokenId = getAuthTokenIdFromReq(req);
		const result = await setPassword({ authTokenId, userId: req.params.userId, password: req.params.password });
		return reply.send(result);
	});

	/* Set a random password for User and send by email */
	fastify.post<{ Body: string[] }>('/rest/auth/setRandomPasswordAndSendByEmail', async function (req, reply) {
		const authTokenId = getAuthTokenIdFromReq(req);
		const result = await setRandomPasswordAndSendByEmail({ authTokenId, userIds: req.body, host: req.headers['host'] });
		return reply.send(result);
	});

	done();
};

export default fp(authApi);
