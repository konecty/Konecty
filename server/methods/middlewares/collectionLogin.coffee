# 
### @DEPENDS_ON_META ###
Meteor.registerMiddleware 'processCollectionLogin', (request) ->
	if not @meta.login?
		return

	if @meta.login.allow isnt true
		return

	if @__methodName__ is 'data:update'
		data = request.data.data
	else
		data = request.data

	# If no data for process login or if already have lookup record, return
	if not data[@meta.login.field]? or data[@meta.login.field]._id?
		return

	# If no password, return error
	if not data[@meta.login.field].password?
		return new Meteor.Error 'internal-error', "#{@meta.login.field}.password is required"

	# If no username or email, return error
	if not data[@meta.login.field].username? and not data[@meta.login.field].email?
		return new Meteor.Error 'internal-error', "#{@meta.login.field}.username or #{@meta.login.field}.email is required"

	# If is an multiple update, return error
	if @__methodName__ is 'data:update' and request.data.ids.length isnt 1
		return new Meteor.Error 'internal-error', 'Only can process login for single updates'

	userRecord = {}

	if @__methodName__ is 'data:create' and not data._id?
		data._id = Random.id()
		userRecord._id = data._id
	else
		userRecord._id = request.data.ids[0]._id

	if _.isObject @meta.login.defaultValues
		userRecord[key] = value for key, value of @meta.login.defaultValues

	if data[@meta.login.field].username?
		userRecord.username = data[@meta.login.field].username

	if data[@meta.login.field].email?
		userRecord.emails = [{
			address: data[@meta.login.field].email
		}]

	userResult = Meteor.call 'data:create',
		authTokenId: request.authTokenId
		document: 'User'
		data: userRecord

	if userResult instanceof Error or userResult?.success isnt true
		return userResult

	if userResult?.success is true and userResult.data.length is 1
		Accounts.setPassword userRecord._id, data[@meta.login.field].password
		data[@meta.login.field] = userResult.data[0]

	return