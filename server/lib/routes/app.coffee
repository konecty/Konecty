###
# @TODO analize Meteor.Error(500, 'Internal server error')
###
cookieParser = require 'cookie-parser'
bodyParser = require 'body-parser'
swig = require 'swig'
path = require 'path'
bugsnag = require 'bugsnag'

REQ_TIMEOUT = 1000 * 300
RES_TIMEOUT = 1000 * 300

process.env.dbName = process.env.MONGO_URL.split('/').pop()
console.log "[kondata] === #{process.env.dbName} ===".green

bugsnag.register '3aff690ae2254498bb9a88dcf8bbb211'

basePath = path.resolve('.').split('.meteor')[0]
tplPath = 'assets/app/templates'
if basePath.indexOf('bundle/programs/server') > 0
	tplPath = '../../programs/server/assets/app/templates'

global.logAllRequests = false

process.on "SIGUSR2", ->
	global.logAllRequests = not global.logAllRequests
	if global.logAllRequests is true
		console.log 'Log all requests ENABLED'.green
	else
		console.log 'Log all requests DISABLED'.red

Picker.middleware (req, res, next) ->
	data = '';
	req.on('data', (chunk) ->
		data += chunk;
	);
	req.on('end', () ->
		req.rawBody = data;
	);
	next();

Picker.middleware cookieParser()

convertObjectIdsToOid = (values) ->
	if _.isArray values
		values.forEach (item, index) ->
			values[index] = convertObjectIdsToOid item
		return values

	if _.isObject values
		if values instanceof Date
			return $date: values.toISOString(), pog: undefined

		_.each values, (value, key) ->
			values[key] = convertObjectIdsToOid value
		return values

	return values

# WebApp.httpServer.setTimeout REQ_TIMEOUT

# ### Helpers
# Add res.send method and res.headers object to be sent on res.send
# Add res.set and res.get to handle response headers
Picker.middleware (req, res, next) ->
	req.notifyError = (type, message, options) ->
		options = options or {}
		options.url = req.url
		options.req = req

		if _.isString req.rawBody
			options.rawBody = JSON.parse req.rawBody

		options.user =
			_id: req.user?._id?.valueOf()
			name: req.user?.name
			login: req.user?.username
			email: req.user?.emails
			access: req.user?.access
			lastLogin: req.user?.lastLogin
		options.session =
			_id: req.session?._id?.valueOf()
			_createdAt: req.session?._createdAt
			ip: req.session?.ip
			geolocation: req.session?.geolocation
			expireAt: req.session?.expireAt

		NotifyErrors.notify type, message, options

	req.set = (header, value) ->
		return req.headers[header.toLowerCase()] = value

	req.get = (header) ->
		return req.headers[header.toLowerCase()]

	res.set = (header, value) ->
		return res.setHeader header, value

	res.get = (header) ->
		return res.getHeader header

	res.location = (url) ->
		# "back" is an alias for the referrer
		if 'back' is url
			url = req.get('Referrer') or '/'

		# Respond
		res.set 'Location', url

	res.redirect = (url) ->
		# Set location header
		res.location url
		res.statusCode = 302
		res.end()

	res.send = (status, response) ->
		# req.setTimeout REQ_TIMEOUT
		# res.removeAllListeners 'finish'
		# res.setTimeout RES_TIMEOUT
		# res.on 'finish', ->
		# 	res.setTimeout RES_TIMEOUT

		res.hasErrors = false

		if not _.isNumber status
			response = status
			status = 200

		if response instanceof Error
			console.log "Error: #{response.message}".red
			console.log response

			response =
				success: false
				errors: [
					message: response.message
					bugsnag: false
				]

			status = 200

		if _.isObject(response) or _.isArray(response)
			res.set 'Content-Type', 'application/json'

			if response.errors?
				res.hasErrors = true
				if _.isArray response.errors
					for error, index in response.errors
						response.errors[index] =
							message: error.message

			if response.time?
				req.time = response.time

			response = EJSON.stringify convertObjectIdsToOid response

		if status isnt 200 or res.hasErrors is true
			console.log status, response

		res.statusCode = status

		if not response?
			return res.end()

		return res.end response

	res.render = (templateName, data) ->
		tmpl = swig.compileFile path.join tplPath, templateName

		renderedHtml = tmpl data

		res.writeHead 200, 'Content-Type': 'text/html'
		res.end renderedHtml

	resEnd = res.end

	res.end = ->
		resEnd.apply res, arguments

		res.statusCode ?= 200

		# Log API Calls
		log = "-> #{res.statusCode} #{utils.rpad(req.method, 4).bold} #{req.url} (#{req.time}) #{req.headers.host?.grey} #{req.headers.referer?.grey}"

		if res.statusCode is 401 and req.user?
			log += " #{req.user._id}"

		if res.statusCode is 200 and res.hasErrors isnt true
			log = log.cyan
		else if res.statusCode is 500
			log = log.red
		else
			log = log.yellow

		if global.logAllRequests is true or res.statusCode isnt 200 or res.hasErrors is true
			console.log log
			console.log JSON.stringify req.headers

	next()

# register Picker filters based on HTTP methods
pickerGet = Picker.filter (req, res) ->
	return req.method == 'GET'
pickerPost = Picker.filter (req, res) ->
	return req.method == 'POST'
pickerPut = Picker.filter (req, res) ->
	return req.method == 'PUT'
pickerDel = Picker.filter (req, res) ->
	return req.method == 'DELETE' || req.method == 'DEL'

Picker.middleware( bodyParser.json() );
Picker.middleware( bodyParser.urlencoded( { extended: true } ) );

# Add CORS allowing any origin
ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS or '').split '|'
Picker.middleware (req, res, next) ->
	if ALLOWED_ORIGINS.includes req.headers.origin
		res.setHeader 'Access-Control-Allow-Credentials', 'true'
		res.setHeader 'Access-Control-Allow-Origin', req.headers.origin

	next()

# global helper to register REST endpoints
global.app =
	get: (path, cb) ->
		pickerGet.route path, (params, req, res, next) ->
			for k, v of params
				params[k] = if _.isString v then decodeURI(v) else v
			req.query ?= params.query
			req.params = params
			cb(req, res, next)
	post: (path, cb) -> 
		pickerPost.route path, (params, req, res, next) ->
			req.query ?= params.query
			req.params = params
			cb(req, res, next)
	put: (path, cb) ->
		pickerPut.route path, (params, req, res, next) ->
			req.query ?= params.query
			req.params = params
			cb(req, res, next)
	del: (path, cb) ->
		pickerDel.route path, (params, req, res, next) ->
			req.query ?= params.query
			req.params = params
			cb(req, res, next)
