import express from 'express';

import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';

import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import each from 'lodash/each';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import get from 'lodash/get';
import isBuffer from 'lodash/isBuffer';

import { rpad } from 'utils';

const convertObjectIdsToOid = function (values) {
	if (isArray(values)) {
		values.forEach((item, index) => (values[index] = convertObjectIdsToOid(item)));
		return values;
	}

	if (isObject(values)) {
		// if (values instanceof Date) {
		// 	return { $date: values.toISOString(), pog: undefined };
		// }

		each(values, (value, key) => (values[key] = convertObjectIdsToOid(value)));
		return values;
	}

	return values;
};

const expressApp = express();

const init = () => {
	const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split('|');
	const corsOptions = {
		origin(origin, callback) {
			if (origin) {
				if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
					callback(null, true);
				} else {
					console.error(`${origin} Not allowed by CORS`);
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
	expressApp.use(bodyParser.json({ limit: '20mb' }));
	expressApp.use(bodyParser.urlencoded({ extended: true }));
	expressApp.use((req, res, next) => {
		req.startTime = process.hrtime();

		req.notifyError = function (type, message, options) {
			options = options || {};
			options.url = req.url;
			options.req = req;

			options.user = {
				_id: get(req, 'user._id', { valueOf: () => undefined }).valueOf(),
				name: get(req, 'user.name'),
				login: get(req, 'user.username'),
				email: get(req, 'user.emails'),
				access: get(req, 'user.access'),
				lastLogin: get(req, 'user.lastLogin'),
			};
			options.session = {
				_id: get(req, 'session._id', { valueOf: () => undefined }).valueOf(),
				_createdAt: get(req, 'session._createdAt'),
				ip: get(req, 'session.ip'),
				geolocation: get(req, 'session.geolocation'),
				expireAt: get(req, 'session.expireAt'),
			};

			return NotifyErrors.notify(type, message, options);
		};

		req.set = (header, value) => (req.headers[header.toLowerCase()] = value);

		req.get = header => req.headers[header.toLowerCase()];

		res.set = (header, value) => res.setHeader(header, value);

		res.get = header => res.getHeader(header);

		res.location = function (url) {
			// "back" is an alias for the referrer
			if (url === 'back') {
				url = req.get('Referrer') || '/';
			}

			// Respond
			res.set('Location', url);
		};

		res.redirect = function (statusCode, url) {
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

		res.send = function (status, response) {
			res.hasErrors = false;

			if (!isNumber(status)) {
				response = status;
				status = 200;
			}

			if (response instanceof Error) {
				console.error(`Error: ${response.message}`.red);
				response = {
					success: false,
					errors: [
						{
							message: response.message,
							bugsnag: false,
						},
					],
				};
			}

			if (!isBuffer(response)) {
				if (isObject(response) || isArray(response)) {
					res.set('Content-Type', 'application/json');

					if (response.errors) {
						res.hasErrors = true;
						if (isArray(response.errors)) {
							for (let index = 0; index < response.errors.length; index++) {
								const error = response.errors[index];
								response.errors[index] = { message: error.message };
							}
						}
					}

					if (response.time) {
						req.time = response.time;
					}

					response = JSON.stringify(convertObjectIdsToOid(response));
				}
			}

			if ([200, 204, 304].includes(status) !== true || res.hasErrors === true) {
				console.info(status, response);
			}

			res.statusCode = status;

			if (!response) {
				res.end();
			}

			res.end(response);
		};

		res.render = function (templateName, data) {
			const tmpl = compileFile(join(tplPath, templateName));

			const renderedHtml = tmpl(data);

			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(renderedHtml);
		};

		const resEnd = res.end;

		res.end = function () {
			resEnd.apply(res, arguments);

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
					log += ` ${req.user._id}`;
				}

				if (res.statusCode === 200 && res.hasErrors !== true) {
					log = `${log}`.grey;
				} else if (res.statusCode === 500) {
					log = `${log}`.red;
				} else {
					log = `${log}`.yellow;
				}
				console.log(log);
			}
		};

		next();
	});
};

const app = {
	rawApp: expressApp,
	listen(port, cb) {
		return expressApp.listen(port, cb);
	},
	get(path, cb) {
		expressApp.get(path, (req, res, next) => {
			for (const k in req?.params) {
				const v = req.params[k];
				req.params[k] = isString(v) ? decodeURI(v) : v;
			}
			if (req.query == null) {
				req.query = req.query;
			}
			cb(req, res, next);
		});
	},
	post(path, cb) {
		expressApp.post(path, (req, res, next) => {
			if (req.query == null && req?.params?.query != null) {
				req.query = req.query;
			}
			cb(req, res, next);
		});
	},
	put(path, cb) {
		expressApp.put(path, (req, res, next) => {
			if (req.query == null && req?.params?.query != null) {
				req.query = req.query;
			}
			cb(req, res, next);
		});
	},
	del(path, cb) {
		expressApp.delete(path, (req, res, next) => {
			if (req.query == null && req?.params?.query != null) {
				req.query = req.query;
			}
			cb(req, res, next);
		});
	},
};

export { init, app };
