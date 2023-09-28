/*
 * @TODO analize Meteor.Error(500, 'Internal server error')
 */
import { Picker } from 'meteor/meteorhacks:picker';
import { EJSON } from 'meteor/ejson';

import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'body-parser';
import { parse } from 'mongodb-uri';
import { isArray, isObject, each, isString, isNumber, get, isBuffer } from 'lodash';
import cors from 'cors';

import { utils } from '/imports/utils/konutils/utils';
import { logger } from '/imports/utils/logger';

// const RES_TIMEOUT = 1000 * 300;
// const REQ_TIMEOUT = 1000 * 300;

const uriObject = parse(process.env.MONGO_URL);
process.env.dbName = uriObject.database;
logger.info(`[kondata] === ${process.env.dbName} ===`);

global.logAllRequests = /true|1|enable/i.test(process.env.LOG_REQUEST);

Picker.middleware(cookieParser());

var convertObjectIdsToOid = function (values) {
	if (isArray(values)) {
		values.forEach((item, index) => (values[index] = convertObjectIdsToOid(item)));
		return values;
	}

	if (isObject(values)) {
		if (values instanceof Date) {
			return { $date: values.toISOString(), pog: undefined };
		}

		each(values, (value, key) => (values[key] = convertObjectIdsToOid(value)));
		return values;
	}

	return values;
};

// WebApp.httpServer.setTimeout REQ_TIMEOUT

// ### Helpers
// Add res.send method and res.headers object to be sent on res.send
// Add res.set and res.get to handle response headers
Picker.middleware(function (req, res, next) {
	req.startTime = process.hrtime();

	req.set = (header, value) => (req.headers[header.toLowerCase()] = value);

	req.get = header => req.headers[header.toLowerCase()];

	res.set = (header, value) => res.setHeader(header, value);

	res.get = header => res.getHeader(header);

	res.location = function (url) {
		// "back" is an alias for the referrer
		if ('back' === url) {
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
		// req.setTimeout REQ_TIMEOUT
		// res.removeAllListeners 'finish'
		// res.setTimeout RES_TIMEOUT
		// res.on 'finish', ->
		// 	res.setTimeout RES_TIMEOUT

		res.hasErrors = false;

		if (!isNumber(status)) {
			response = status;
			status = 200;
		}

		if (response instanceof Error) {
			logger.error(response, `Error: ${response.message}`);
			response = {
				success: false,
				errors: [
					{
						message: response.message,
					},
				],
			};

			// status = 200;
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

				response = EJSON.stringify(convertObjectIdsToOid(response));
			}
		}

		if ([200, 204, 304].includes(status) !== true || res.hasErrors === true) {
			logger.error({ status, response }, `Response: ${status} ${req.method} ${req.url}`);
		}

		res.statusCode = status;

		if (!response) {
			res.end();
		}

		res.end(response);
	};

	const resEnd = res.end;

	res.end = function () {
		resEnd.apply(res, arguments);

		if (!res.statusCode) {
			res.statusCode = 200;
		}

		// Log API Calls
		const totalTime = process.hrtime(req.startTime);

		let log = `${totalTime[0]}s ${totalTime[1] / 1000000}ms =>  ${res.statusCode} ${utils.rpad(req.method, 4).bold} ${req.url}  ${
			req.headers.host != null ? `${req.headers.host}` : ''
		} ${req.headers.referer != null ? `${req.headers.referer}` : ''}`;

		if (res.statusCode === 401 && req.user) {
			log += ` ${req.user._id}`;
		}

		if (res.statusCode === 200 && res.hasErrors !== true) {
			log = `${log}`;
		} else if (res.statusCode === 500) {
			log = `${log}`;
		} else {
			log = `${log}`;
		}
		logger.trace(log);
	};

	next();
});

// register Picker filters based on HTTP methods
const pickerGet = Picker.filter(req => req.method === 'GET');
const pickerPost = Picker.filter(req => req.method === 'POST');
const pickerPut = Picker.filter(req => req.method === 'PUT');
const pickerDel = Picker.filter(req => req.method === 'DELETE' || req.method === 'DEL');

Picker.middleware(json({ limit: '20mb' }));
Picker.middleware(urlencoded({ extended: true }));

// Add CORS allowing any origin
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split('|');
const corsOptions = {
	origin: function (origin, callback) {
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
	optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

Picker.middleware(cors(corsOptions));

// global helper to register REST endpoints
export const app = {
	get(path, cb) {
		pickerGet.route(path, function (params, req, res, next) {
			for (let k in params) {
				const v = params[k];
				params[k] = isString(v) ? decodeURI(v) : v;
			}
			if (!req.query) {
				req.query = params.query;
			}
			req.params = params;
			cb(req, res, next);
		});
	},
	post(path, cb) {
		pickerPost.route(path, function (params, req, res, next) {
			if (!req.query) {
				req.query = params.query;
			}
			req.params = params;
			cb(req, res, next);
		});
	},
	put(path, cb) {
		pickerPut.route(path, function (params, req, res, next) {
			if (!req.query) {
				req.query = params.query;
			}
			req.params = params;
			cb(req, res, next);
		});
	},
	del(path, cb) {
		pickerDel.route(path, function (params, req, res, next) {
			if (!req.query) {
				req.query = params.query;
			}
			req.params = params;
			cb(req, res, next);
		});
	},
};

global.app = app;
