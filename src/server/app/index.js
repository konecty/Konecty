import express from 'express';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import pino from 'express-pino-logger';

import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import get from 'lodash/get';
import isBuffer from 'lodash/isBuffer';

import { rpad } from 'utils';

import logger from 'utils/logger';

const convertObjectIdsToOid = values => {
	if (isArray(values)) {
		return values.map(item => convertObjectIdsToOid(item));
	}

	if (isObject(values)) {
		return Object.keys(values).reduce((acc, key) => Object.assign(acc, { [key]: convertObjectIdsToOid(values[key]) }), {});
	}

	return values;
};

const expressApp = express();

export default () => {
	const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split('|');
	const corsOptions = {
		origin(origin, callback) {
			if (origin) {
				if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
					callback(null, true);
				} else {
					logger.error(`${origin} Not allowed by CORS`);
					callback(new Error(`Not allowed by CORS`));
				}
			} else {
				callback(null, true);
			}
		},
		allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
		credentials: true,
	};

	expressApp.use(cors(corsOptions));

	expressApp.use(cookieParser());
	expressApp.use(express.json({ limit: '20mb' }));
	expressApp.use(express.urlencoded({ extended: true }));
	expressApp.use(pino());
	expressApp.use((req, res, next) => {
		req.startTime = process.hrtime();

		req.notifyError = (type, message, options) => {
			const errorData = { ...options, type, message };
			errorData.url = req.url;
			errorData.req = req;

			errorData.user = {
				_id: get(req, 'user._id', { valueOf: () => undefined }).valueOf(),
				name: get(req, 'user.name'),
				login: get(req, 'user.username'),
				email: get(req, 'user.emails'),
				access: get(req, 'user.access'),
				lastLogin: get(req, 'user.lastLogin'),
			};
			errorData.session = {
				_id: get(req, 'session._id', { valueOf: () => undefined }).valueOf(),
				_createdAt: get(req, 'session._createdAt'),
				ip: get(req, 'session.ip'),
				geolocation: get(req, 'session.geolocation'),
				expireAt: get(req, 'session.expireAt'),
			};

			return req.error(errorData, message);
		};

		req.set = (header, value) => (req.headers[header.toLowerCase()] = value);

		req.get = header => req.headers[header.toLowerCase()];

		res.set = (header, value) => res.setHeader(header, value);

		res.get = header => res.getHeader(header);

		res.location = url => {
			// "back" is an alias for the referrer
			if (url === 'back') {
				return res.set('Location', req.get('Referrer') || '/');
			}

			// Respond
			return res.set('Location', url);
		};

		res.redirect = (statusCode, url) => {
			if (isNumber(statusCode)) {
				res.location(url);
				res.statusCode = statusCode;
				res.end();
			}
			// Set location header
			res.location(statusCode);
			res.statusCode = 302;
			res.end();
		};

		res.send = (status, response) => {
			res.hasErrors = false;

			let result = response;
			let resultStatus = status;

			if (!isNumber(status)) {
				result = status;
				resultStatus = 200;
			}

			if (result instanceof Error) {
				req.log.error(result, `Error: ${result.message}`);
				result = {
					success: false,
					errors: [
						{
							message: result.message,
							bugsnag: false,
						},
					],
				};
			}

			if (!isBuffer(result)) {
				if (isObject(result) || isArray(result)) {
					res.set('Content-Type', 'application/json');

					if (result.errors) {
						res.hasErrors = true;
						if (isArray(result.errors)) {
							result.errors = result.errors.map(({ message }) => message);
						}
					}

					if (result.time) {
						req.time = result.time;
					}

					result = JSON.stringify(convertObjectIdsToOid(result));
				}
			}

			if ([200, 204, 304].includes(resultStatus) !== true || res.hasErrors === true) {
				req.log.info({ resultStatus, result });
			}

			if (result == null) {
				res.status(resultStatus).end();
			}

			res.status(resultStatus).end(result);
		};

		// TODO: Template render
		// res.render = function (templateName, data) {
		// 	const tmpl = compileFile(join(tplPath, templateName));

		// 	const renderedHtml = tmpl(data);

		// 	res.writeHead(200, { 'Content-Type': 'text/html' });
		// 	res.end(renderedHtml);
		// };

		const resEnd = res.end;

		res.end = (...args) => {
			resEnd.apply(res, args);

			if (!res.statusCode) {
				res.statusCode = 200;
			}

			if (global.logAllRequests === true || [200, 204, 304].includes(res.statusCode) !== true || res.hasErrors === true) {
				// Log API Calls
				const totalTime = process.hrtime(req.startTime);

				let log = `${totalTime[0]}s ${totalTime[1] / 1000000}ms =>  ${res.statusCode} ${rpad(req.method, 4).bold} ${req.url}  ${
					req.headers.host != null ? `${req.headers.host}` : ''
				} ${req.headers.referer != null ? `${req.headers.referer}` : ''}`;

				if (res.statusCode === 401 && req.user) {
					// eslint-disable-next-line no-underscore-dangle
					log += ` ${req.user._id}`;
				}

				if (res.statusCode === 200 && res.hasErrors !== true) {
					log = `${log}`;
				} else if (res.statusCode === 500) {
					log = `${log}`;
				} else {
					log = `${log}`;
				}
				req.log.debug(log);
			}
		};

		next();
	});
};

export const app = {
	rawApp: expressApp,
	listen(port, cb) {
		return expressApp.listen(port, cb);
	},
	get(path, cb) {
		expressApp.get(path, (req, res, next) => {
			req.params = (req.params ?? []).map(v => (isString(v) ? decodeURI(v) : v));

			if (req.query == null && req.params?.query != null) {
				req.query = req.params.query;
			}
			cb(req, res, next);
		});
	},
	post(path, cb) {
		expressApp.post(path, (req, res, next) => {
			if (req.query == null && req?.params?.query != null) {
				req.query = req.params.query;
			}
			cb(req, res, next);
		});
	},
	put(path, cb) {
		expressApp.put(path, (req, res, next) => {
			if (req.query == null && req?.params?.query != null) {
				req.query = req.params.query;
			}
			cb(req, res, next);
		});
	},
	del(path, cb) {
		expressApp.delete(path, (req, res, next) => {
			if (req.query == null && req?.params?.query != null) {
				req.query = req.params.query;
			}
			cb(req, res, next);
		});
	},
};
