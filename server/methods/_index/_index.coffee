Meteor.registerLogs = false
Meteor.registerDoneLogs = false
Meteor.registerVerboseLogs = false

Meteor.registerBeforeMethod 'startTime', ->
	@startTime = new Date
	return


Meteor.registerBeforeMethod 'bugsnag', ->
	context = @

	@notifyError = (type, message, options) ->
		if type instanceof Error and not options?
			options = message
			message = type
			type = undefined

		options = options or {}
		options.url = context.__methodName__

		options.user =
			_id: context.user?._id?.valueOf()
			name: context.user?.name
			login: context.user?.username
			email: context.user?.emails
			access: context.user?.access
			lastLogin: context.user?.lastLogin

		NotifyErrors.notify type, message, options
	return


Meteor.registerAfterMethod 'catchErrors', (params) ->
	notifyError = (error) =>
		console.log 'DDPCatchErrors'.red, error

		@notifyError 'DDPCatchErrors', error, {
			errorDetail: error
			methodResult: params.result
			methodArguments: _.toArray params.arguments
		}

	if params.result instanceof Error
		notifyError params.result
		params.result =
			success: false
			errors: [
				message: params.result.message
			]

	else if _.isObject(params.result) and _.isArray(params.result.errors)
		for error in params.result.errors
			notifyError error

	return


Meteor.registerAfterMethod 'totalTime', (params) ->
	if _.isObject(params.result) and @startTime instanceof Date
		endTime = new Date
		@time = endTime.getTime() - @startTime.getTime()
		params.result.time = @time
	return
