/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
 * @TODO analize Meteor.Error(500, 'Internal server error')
 */
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const swig = require('swig');
const path = require('path');
const bugsnag = require('bugsnag');
const mongodbUri = require('mongodb-uri');

const REQ_TIMEOUT = 1000 * 300;
const RES_TIMEOUT = 1000 * 300;

const uriObject = mongodbUri.parse(process.env.MONGO_URL);
process.env.dbName = uriObject.database;
console.log(`[kondata] === ${process.env.dbName} ===`.green);

bugsnag.register('3aff690ae2254498bb9a88dcf8bbb211');

const basePath = path.resolve('.').split('.meteor')[0];
let tplPath = 'assets/app/templates';
if (basePath.indexOf('bundle/programs/server') > 0) {
	tplPath = '../../programs/server/assets/app/templates';
}

global.logAllRequests = false;

process.on("SIGUSR2", function() {
	global.logAllRequests = !global.logAllRequests;
	if (global.logAllRequests === true) {
		return console.log('Log all requests ENABLED'.green);
	} else {
		return console.log('Log all requests DISABLED'.red);
	}
});

Picker.middleware(function(req, res, next) {
	let data = '';
	req.on('data', chunk => data += chunk);
	req.on('end', () => req.rawBody = data);
	return next();
});

Picker.middleware(cookieParser());

var convertObjectIdsToOid = function(values) {
	if (_.isArray(values)) {
		values.forEach((item, index) => values[index] = convertObjectIdsToOid(item));
		return values;
	}

	if (_.isObject(values)) {
		if (values instanceof Date) {
			return {$date: values.toISOString(), pog: undefined};
		}

		_.each(values, (value, key) => values[key] = convertObjectIdsToOid(value));
		return values;
	}

	return values;
};

// WebApp.httpServer.setTimeout REQ_TIMEOUT

// ### Helpers
// Add res.send method and res.headers object to be sent on res.send
// Add res.set and res.get to handle response headers
Picker.middleware(function(req, res, next) {
	req.notifyError = function(type, message, options) {
		options = options || {};
		options.url = req.url;
		options.req = req;

		if (_.isString(req.rawBody)) {
			options.rawBody = JSON.parse(req.rawBody);
		}

		options.user = {
			_id: __guard__(req.user != null ? req.user._id : undefined, x => x.valueOf()),
			name: (req.user != null ? req.user.name : undefined),
			login: (req.user != null ? req.user.username : undefined),
			email: (req.user != null ? req.user.emails : undefined),
			access: (req.user != null ? req.user.access : undefined),
			lastLogin: (req.user != null ? req.user.lastLogin : undefined)
		};
		options.session = {
			_id: __guard__(req.session != null ? req.session._id : undefined, x1 => x1.valueOf()),
			_createdAt: (req.session != null ? req.session._createdAt : undefined),
			ip: (req.session != null ? req.session.ip : undefined),
			geolocation: (req.session != null ? req.session.geolocation : undefined),
			expireAt: (req.session != null ? req.session.expireAt : undefined)
		};

		return NotifyErrors.notify(type, message, options);
	};

	req.set = (header, value) => req.headers[header.toLowerCase()] = value;

	req.get = header => req.headers[header.toLowerCase()];

	res.set = (header, value) => res.setHeader(header, value);

	res.get = header => res.getHeader(header);

	res.location = function(url) {
		// "back" is an alias for the referrer
		if ('back' === url) {
			url = req.get('Referrer') || '/';
		}

		// Respond
		return res.set('Location', url);
	};

	res.redirect = function(url) {
		// Set location header
		res.location(url);
		res.statusCode = 302;
		return res.end();
	};

	res.send = function(status, response) {
		// req.setTimeout REQ_TIMEOUT
		// res.removeAllListeners 'finish'
		// res.setTimeout RES_TIMEOUT
		// res.on 'finish', ->
		// 	res.setTimeout RES_TIMEOUT

		res.hasErrors = false;

		if (!_.isNumber(status)) {
			response = status;
			status = 200;
		}

		if (response instanceof Error) {
			console.log(`Error: ${response.message}`.red);
			console.log(response);

			response = {
				success: false,
				errors: [{
					message: response.message,
					bugsnag: false
				}
				]
			};

			status = 200;
		}

		if (_.isObject(response) || _.isArray(response)) {
			res.set('Content-Type', 'application/json');

			if (response.errors != null) {
				res.hasErrors = true;
				if (_.isArray(response.errors)) {
					for (let index = 0; index < response.errors.length; index++) {
						const error = response.errors[index];
						response.errors[index] =
							{message: error.message};
					}
				}
			}

			if (response.time != null) {
				req.time = response.time;
			}

			response = EJSON.stringify(convertObjectIdsToOid(response));
		}

		if ((status !== 200) || (res.hasErrors === true)) {
			console.log(status, response);
		}

		res.statusCode = status;

		if ((response == null)) {
			return res.end();
		}

		return res.end(response);
	};

	res.render = function(templateName, data) {
		const tmpl = swig.compileFile(path.join(tplPath, templateName));

		const renderedHtml = tmpl(data);

		res.writeHead(200, {'Content-Type': 'text/html'});
		return res.end(renderedHtml);
	};

	const resEnd = res.end;

	res.end = function() {
		resEnd.apply(res, arguments);

		if (res.statusCode == null) { res.statusCode = 200; }

		// Log API Calls
		let log = `-> ${res.statusCode} ${utils.rpad(req.method, 4).bold} ${req.url} (${req.time}) ${(req.headers.host != null ? req.headers.host.grey : undefined)} ${(req.headers.referer != null ? req.headers.referer.grey : undefined)}`;

		if ((res.statusCode === 401) && (req.user != null)) {
			log += ` ${req.user._id}`;
		}

		if ((res.statusCode === 200) && (res.hasErrors !== true)) {
			log = log.cyan;
		} else if (res.statusCode === 500) {
			log = log.red;
		} else {
			log = log.yellow;
		}

		if ((global.logAllRequests === true) || (res.statusCode !== 200) || (res.hasErrors === true)) {
			console.log(log);
			return console.log(JSON.stringify(req.headers));
		}
	};

	return next();
});

// register Picker filters based on HTTP methods
const pickerGet = Picker.filter((req, res) => req.method === 'GET');
const pickerPost = Picker.filter((req, res) => req.method === 'POST');
const pickerPut = Picker.filter((req, res) => req.method === 'PUT');
const pickerDel = Picker.filter((req, res) => (req.method === 'DELETE') || (req.method === 'DEL'));

Picker.middleware( bodyParser.json() );
Picker.middleware( bodyParser.urlencoded( { extended: true } ) );

// Add CORS allowing any origin
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split('|');
Picker.middleware(function(req, res, next) {
	if (ALLOWED_ORIGINS.includes(req.headers.origin)) {
		res.setHeader('Access-Control-Allow-Credentials', 'true');
		res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
	}

	return next();
});

// global helper to register REST endpoints
global.app = {
	get(path, cb) {
		return pickerGet.route(path, function(params, req, res, next) {
			for (let k in params) {
				const v = params[k];
				params[k] = _.isString(v) ? decodeURI(v) : v;
			}
			if (req.query == null) { req.query = params.query; }
			req.params = params;
			return cb(req, res, next);
		});
	},
	post(path, cb) { 
		return pickerPost.route(path, function(params, req, res, next) {
			if (req.query == null) { req.query = params.query; }
			req.params = params;
			return cb(req, res, next);
		});
	},
	put(path, cb) {
		return pickerPut.route(path, function(params, req, res, next) {
			if (req.query == null) { req.query = params.query; }
			req.params = params;
			return cb(req, res, next);
		});
	},
	del(path, cb) {
		return pickerDel.route(path, function(params, req, res, next) {
			if (req.query == null) { req.query = params.query; }
			req.params = params;
			return cb(req, res, next);
		});
	}
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}