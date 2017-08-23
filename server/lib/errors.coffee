bugsnag = require 'bugsnag'

global.NotifyErrors = {}

NotifyErrors.notify = (type, message, options) ->
	if type instanceof Error and not options?
		options = message
		message = type
		type = undefined

	options = options or {}

	if _.isString message
		message = new Meteor.Error type, message

	if message instanceof Meteor.Error
		if not type? and message.error?
			type = message.error

		if _.isObject message.details
			options[key] = value for key, value of message.details
		else
			options.errorDetail = message.details

	options.errorName = "[#{process.env.dbName}] #{type}"

	if message?.details?.bugsnag is false
		return

	# Kadira.trackError type, message.message, stacks: message.stack
	bugsnag.notify message, options


process.on 'uncaughtException', (error) ->
	NotifyErrors.notify 'uncaughtException', error


originalMeteorDebug = Meteor._debug
Meteor._debug = (message, stack) ->
	if typeof stack is 'string'
		message += ' ' + stack

	error = new Meteor.Error 'internal-error', message
	error.stack = stack

	NotifyErrors.notify 'Meteor._debug', error

	return originalMeteorDebug.apply this, arguments
