app.get '/rest/auth/loginByUrl/:ns/:sessionId', (req, res, next) ->
	if Meteor.absoluteUrl().indexOf('localhost') isnt -1
		domain = ''
	else
		domain = 'domain=.konecty.com;'

	req.params.sessionId = decodeURIComponent req.params.sessionId.replace /\s/g, '+'

	namespace = MetaObject.findOne _id: 'Namespace'
	
	# Verify if Namespace have a session expiration metadata config and set
	cookieMaxAge = if namespace.sessionExpirationInSeconds? then namespace.sessionExpirationInSeconds else 2592000
	
	# Set cookie with session id
	res.set 'set-cookie', "_authTokenId=#{req.params.sessionId}; #{domain} Version=1; Path=/; Max-Age=#{cookieMaxAge.toString()}"
	res.set 'set-cookie', "_authTokenNs=#{req.params.ns}; #{domain} Version=1; Path=/; Max-Age=#{cookieMaxAge.toString()}"

	# Redirect to system
	res.redirect '/'


### Login using email and password ###
app.post '/rest/auth/login', (req, res, next) ->
	# Map body parameters
	{user, password, ns, geolocation, resolution, password_SHA256} = req.body
	
	namespace = MetaObject.findOne _id: 'Namespace'

	# Verify if Namespace have a session expiration metadata config and set
	cookieMaxAge = if namespace.sessionExpirationInSeconds? then namespace.sessionExpirationInSeconds else 2592000

	userAgent = req.headers['user-agent']

	if Meteor.absoluteUrl().indexOf('localhost') isnt -1
		domain = ''
	else
		domain = 'domain=.konecty.com;'

	ip = req.get 'x-forwarded-for'
	if _.isString ip
		ip = ip.replace(/\s/g, '').split(',')[0]

	loginResult = Meteor.call 'auth:login',
		ns: ns
		ip: ip
		user: user
		password: password
		password_SHA256: password_SHA256
		geolocation: geolocation
		resolution: resolution
		userAgent: userAgent

	if loginResult?.success is true
		# Set cookie with session id
		res.set 'set-cookie', "_authTokenId=#{loginResult.authId}; #{domain} Version=1; Path=/; Max-Age=#{cookieMaxAge.toString()}"
		if _.isString ns
			res.set 'set-cookie', "_authTokenNs=#{ns}; #{domain} Version=1; Path=/; Max-Age=#{cookieMaxAge.toString()}"

		res.send loginResult
	else
		if loginResult?.errors?
			res.send 401, loginResult
		else
			res.send loginResult


### Logout currently session ###
app.get '/rest/auth/logout', (req, res, next) ->
	res.send Meteor.call 'auth:logout',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req


### Reset password ###
app.post '/rest/auth/reset', (req, res, next) ->
	# Map body parameters
	{user, ns} = req.body

	ip = req.get 'x-forwarded-for'
	if _.isString ip
		ip = ip.replace(/\s/g, '').split(',')[0]

	res.send Meteor.call 'auth:resetPassword',
		user: user
		ns: ns
		ip: ip
		host: req.get('Host')


### Set geolocation for current session ###
app.post '/rest/auth/setgeolocation', (req, res, next) ->
	# Map body parameters
	{longitude, latitude} = req.body

	userAgent = req.headers['user-agent']

	ip = req.get 'x-forwarded-for'
	if _.isString ip
		ip = ip.replace(/\s/g, '').split(',')[0]

	res.send Meteor.call 'auth:setGeolocation',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		longitude: longitude
		latitude: latitude
		userAgent: userAgent
		ip: ip


### Get information from current session###
app.get '/rest/auth/info', (req, res, next) ->
	res.send Meteor.call 'auth:info',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req


### Set User password ###
app.get '/rest/auth/setPassword/:userId/:password', (req, res, next) ->
	res.send Meteor.call 'auth:setPassword',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		userId: req.params.userId
		password: req.params.password


### Set a random password for User and send by email ###
app.post '/rest/auth/setRandomPasswordAndSendByEmail', (req, res, next) ->
	res.send Meteor.call 'auth:setRandomPasswordAndSendByEmail',
		authTokenId: sessionUtils.getAuthTokenIdFromReq req
		userIds: req.body
