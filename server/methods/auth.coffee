ua = require 'ua-parser'
bcrypt = require 'bcrypt'
bcryptHash = Meteor.wrapAsync bcrypt.hash
bcryptCompare = Meteor.wrapAsync bcrypt.compare

SSR.compileTemplate 'resetPassword', Assets.getText('templates/email/resetPassword.html')

injectRequestInformation = (userAgent, session) ->
	r = ua.parse userAgent

	session.browser = r.ua.family
	session.browserVersion = r.ua.toVersionString()
	session.os = r.os.toString()
	session.platform = r.device.family

	if _.isString resolution
		resolution = JSON.parse resolution
		session.resolution = resolution

	return session


### Login using email and password
	@param user
	@param password
	@param ns
	@param geolocation
	@param resolution
	@param ip
	@param userAgent
###
Meteor.registerMethod 'auth:login', (request) ->
	{user, password, ns, geolocation, resolution, userAgent, ip, password_SHA256} = request

	# Define a session with arguments based on java version
	accessLog =
		_createdAt: new Date
		_updatedAt: new Date
		ip: ip
		login: user

	namespace = MetaObject.findOne _id: 'Namespace'

	# If there is a geolocation store it with session
	if _.isString geolocation
		geolocation = JSON.parse geolocation
		accessLog.geolocation = [geolocation.lng, geolocation.lat]
	else if namespace.trackUserGeolocation is true
		accessLog.reason = 'Geolocation required'
		injectRequestInformation userAgent, accessLog
		Models.AccessFailedLog.insert accessLog

		return new Meteor.Error 'internal-error', 'O Konecty exige que você habilite a geolocalização do seu navegador.'

	userRecord = Meteor.users.findOne {$or: [{username: user}, {'emails.address': user}]}

	if not userRecord
		accessLog.reason = "User not found [#{user}]"
		injectRequestInformation userAgent, accessLog
		Models.AccessFailedLog.insert accessLog

		return new Meteor.Error 'internal-error', 'Usuário ou senha inválidos.'

	accessLog._user = [
		_id: userRecord._id
		name: userRecord.name
		group: userRecord.group
	]

	p = password_SHA256 or password
	p = algorithm: 'sha-256', digest: p

	logged = Accounts._checkPassword userRecord, p

	if logged.error?
		accessLog.reason = logged.error.reason
		injectRequestInformation userAgent, accessLog
		Models.AccessFailedLog.insert accessLog

		return new Meteor.Error 'internal-error', 'Usuário ou senha inválidos.'

	if userRecord.active isnt true
		accessLog.reason = "User inactive [#{user}]"
		injectRequestInformation userAgent, accessLog
		Models.AccessFailedLog.insert accessLog
		return new Meteor.Error 'internal-error', 'Usuário inativo.', {bugsnag: false}

	stampedToken = Accounts._generateStampedLoginToken()
	hashStampedToken = Accounts._hashStampedToken(stampedToken)

	updateObj =
		$set:
			lastLogin: new Date
		$push:
			'services.resume.loginTokens': hashStampedToken

	Meteor.users.update {_id: userRecord._id}, updateObj

	injectRequestInformation userAgent, accessLog
	Models.AccessLog?.insert accessLog

	return {
		success: true
		logged: true
		authId: hashStampedToken.hashedToken
		user:
			_id: userRecord._id
			access: userRecord.access
			admin: userRecord.admin
			email: userRecord.emails?[0]?.address
			group: userRecord.group
			locale: userRecord.locale
			login: userRecord.username
			name: userRecord.name
			namespace: userRecord.namespace
			role: userRecord.role
	}


### Logout currently session
	@param authTokenId
###
Meteor.registerMethod 'auth:logout', 'withUser', (request) ->
	updateObj =
		$pull:
			'services.resume.loginTokens': hashedToken: @hashedToken

	Meteor.users.update {_id: @user._id}, updateObj

	return success: true


### Get information from current session
	@param authTokenId
###
Meteor.registerMethod 'auth:info', 'withUser', (request) ->
	# Get namespace information
	namespace = MetaObject.findOne _id: 'Namespace'

	# TODO Remove
	namespace._id = namespace.ns
	delete namespace.ns
	delete namespace.parents
	delete namespace.type

	# If no namespace was found return error
	if not namespace?
		return new Meteor.Error 'internal-error', 'Namespace not found'

	# Mount namespace with Java format
	response =
		authId: null # TODO Remove
		logged: true
		user:
			_id: @user._id
			access: @user.access
			admin: @user.admin
			email: @user.emails?[0]?.address
			group: @user.group
			locale: @user.locale
			login: @user.username
			name: @user.name
			namespace: namespace
			role: @user.role

	return response


### Verify if user is logged
	@param authTokenId
###
Meteor.registerMethod 'auth:logged', 'withUser', (request) ->
	return true


### Get publlic user info
	@param authTokenId
###
Meteor.registerMethod 'auth:getUser', 'withUser', (request) ->
	return {
		_id: @user._id
		access: @user.access
		admin: @user.admin
		emails: @user.emails
		group: @user.group
		locale: @user.locale
		username: @user.username
		name: @user.name
		role: @user.role
		lastLogin: @user.lastLogin
	}


### Reset password
	@param user
	@param ns
	@param ip
	@param host
###
Meteor.registerMethod 'auth:resetPassword', (request) ->
	# Map body parameters
	{user, ns, ip, host} = request

	userRecord = Meteor.users.findOne { $and: [ { active: true }, { $or: [{username: user}, {'emails.address': user}]} ] }

	if not userRecord
		return new Meteor.Error 'internal-error', 'Usuário não encontrado.'

	stampedToken = Accounts._generateStampedLoginToken()
	hashStampedToken = Accounts._hashStampedToken(stampedToken)

	updateObj =
		$set:
			lastLogin: new Date
		$push:
			'services.resume.loginTokens': hashStampedToken

	Meteor.users.update {_id: userRecord._id}, updateObj

	expireAt = new Date
	expireAt = new Date expireAt.setMinutes expireAt.getMinutes() + 360

	token = encodeURIComponent hashStampedToken.hashedToken

	emailData =
		from: 'Konecty Alerts <alerts@konecty.com>'
		to: userRecord.emails?[0]?.address
		subject: '[Konecty] Password Reset'
		template: 'resetPassword.html'
		type: 'Email'
		status: 'Send'
		discard: true
		data:
			name: userRecord.name
			expireAt: expireAt
			url: "http://#{host}/rest/auth/loginByUrl/#{ns}/#{token}"

	Models['Message'].insert emailData

	# Respond to reset
	return success: true


### Set User password
	@param userId
	@param password
###
Meteor.registerMethod 'auth:setPassword', 'withUser', (request) ->
	# Map body parameters
	{userId, password} = request

	access = accessUtils.getAccessFor 'User', @user

	# If return is false no access was found then return 401 (Unauthorized)
	if not _.isObject access
		return new Meteor.Error 'internal-error', 'Permissão negada.'

	userRecord = Meteor.users.findOne {$or: [{_id: userId}, {username: userId}, {'emails.address': userId}]}

	if not userRecord
		return new Meteor.Error 'internal-error', 'Usuário não encontrado.'

	if @user.admin isnt true and @user._id isnt userRecord._id and access.changePassword isnt true
		return new Meteor.Error 'internal-error', 'Permissão negada.'

	Accounts.setPassword userRecord._id, password

	return success: true


### Set a random password for User and send by email
	@param userIds
###
Meteor.registerMethod 'auth:setRandomPasswordAndSendByEmail', 'withUser', (request) ->
	# Map body parameters
	{userIds} = request

	check userIds, [String]

	access = accessUtils.getAccessFor 'User', @user

	# If return is false no access was found then return 401 (Unauthorized)
	if not _.isObject access
		return new Meteor.Error 'internal-error', 'Permissão negada.'

	userRecords = Meteor.users.find {$or: [
		{_id: {$in: userIds}}
		{username: {$in: userIds}}
		{'emails.address': {$in: userIds}}
	]}

	userRecords = userRecords.fetch()

	if userRecords.length is 0
		return new Meteor.Error 'internal-error', 'Nenhum usuário encontrado.'

	errors = []

	for userRecord in userRecords
		if not userRecord.emails?[0]?.address?
			errors.push new Meteor.Error 'internal-error', "Usuário [#{userRecord.username}] sem email definido."
			continue

		if @user.admin isnt true and @user._id isnt userRecord._id and access.changePassword isnt true
			errors.push new Meteor.Error 'internal-error', "Permissão negada para alterar a senha do usuário [#{userRecord.username}]."
			continue

		password = Random.id(6).toLowerCase()

		Accounts.setPassword userRecord._id, password

		html = SSR.render 'resetPassword',
			password: password

		Models['Message'].insert
			from: 'Konecty <support@konecty.com>'
			to: userRecord.emails?[0]?.address
			subject: '[Konecty] Sua nova senha'
			body: html
			type: 'Email'
			status: 'Send'
			discard: true

	if errors.length > 0
		return {
			success: false
			errors: errors
		}

	return success: true


### Set geolocation for current session
	@param longitude
	@param latitude
	@param userAgent
	@param ip
###
Meteor.registerMethod 'auth:setGeolocation', 'withUser', (request) ->
	if not Models.AccessLog?
		return new Meteor.Error 'internal-error', 'Models.AccessLog not defined.'

	{longitude, latitude, userAgent, ip} = request

	if not longitude? or not latitude?
		return new Meteor.Error 'internal-error', 'Longitude or Latitude not defined'

	accessLog =
		_createdAt: new Date
		_updatedAt: new Date
		ip: ip
		login: @user.username
		geolocation: [longitude, latitude]
		_user: [
			_id: @user._id
			name: @user.name
			group: @user.group
		]

	injectRequestInformation userAgent, accessLog
	Models.AccessLog.insert accessLog

	return {
		success: true
	}


Accounts.onCreateUser (options, user) ->
	if not user.code?
		user.code = metaUtils.getNextCode 'User', 'code'
	return user
