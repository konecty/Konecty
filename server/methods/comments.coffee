### Get a list of comments of one record
	@param authTokenId
	@param document
	@param dataId
###
Meteor.registerMethod 'comments:find', 'withUser', 'withAccessForDocument', (request) ->
	# Get comment model
	modelComment = Models["#{request.document}.Comment"]
	if not modelComment?
		return new Meteor.Error 'internal-error', "Document #{field.document}.Comment does not exists"

	# Validate param dataId
	if not _.isString request.dataId
		return new Meteor.Error 'internal-error', "Param dataId must be a valid string id"

	data = modelComment.find({dataId: request.dataId}, {sort: {_createdAt: 1}}).fetch()

	return success: true, data: data

### Create a new commento for given record
	@param authTokenId
	@param document
	@param dataId
	@param text
###
Meteor.registerMethod 'comments:create', 'withUser', 'withAccessForDocument', (request) ->
	# Validate text field
	if not _.isString(request.text) or request.text.length is 0
		return new Meteor.Error 'internal-error', "Comment must be a string with one or more characters"

	# Get data model
	model = Models[request.document]
	if not model?
		return new Meteor.Error 'internal-error', "Document #{request.document} does not exists"

	# Get comment model
	modelComment = Models["#{request.document}.Comment"]
	if not modelComment?
		return new Meteor.Error 'internal-error', "Document #{request.document}.Comment does not exists"

	# Validate param dataId
	if not _.isString request.dataId
		return new Meteor.Error 'internal-error', "Param dataId must be a valid string id"

	# If no record exists with passed ID return error
	record = model.findOne request.dataId
	if not record?
		return new Meteor.Error 'internal-error', "Record not found using id #{request.dataId}"

	data =
		dataId: request.dataId
		_createdAt: new Date
		_createdBy:
			_id: @user._id
			group: @user.group
			name: @user.name
		text: request.text

	try
		modelComment.insert data
	catch e
		console.log e
		@notifyError 'Comment - Insert Error', e

	return success: true, data: [data]

