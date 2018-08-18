bugsnag = Npm.require 'bugsnag'

mongodbUri = Npm.require 'mongodb-uri'
uriObject = mongodbUri.parse(process.env.MONGO_URL)
process.env.dbName = uriObject.database

bugsnag.register 'e6464a5423ceea7cb3b5b7ee8731f0fb'

class KonectyError extends Error
	constructor: (msg, options={}) ->
		@message = msg
		for key, value of options
			@[key] = value

global.KonectyError = KonectyError

class ErrorWithCode extends Error
	constructor: (code, msg) ->
		@message = msg
		@code = code

global.ErrorWithCode = ErrorWithCode

global.NotifyErrors = {}

NotifyErrors.notify = (type, message, options) ->
	options = options or {}
	options.errorName = "[#{process.env.dbName}] #{type}"

	if _.isString message
		message = new Error(message)

	options.groupingHash = options.errorName + message.message

	bugsnag.notify message, options


process.on 'uncaughtException', (error) ->
	NotifyErrors.notify 'uncaughtException', error


originalMeteorDebug = Meteor._debug
Meteor._debug = (message, stack) ->
	if typeof stack is 'string'
		message += ' ' + stack

	error = new Error message
	error.stack = stack

	NotifyErrors.notify 'Meteor._debug', error

	return originalMeteorDebug.apply this, arguments
