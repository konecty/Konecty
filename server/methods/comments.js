/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/* Get a list of comments of one record
	@param authTokenId
	@param document
	@param dataId
*/
Meteor.registerMethod('comments:find', 'withUser', 'withAccessForDocument', function(request) {
	// Get comment model
	const modelComment = Models[`${request.document}.Comment`];
	if ((modelComment == null)) {
		return new Meteor.Error('internal-error', `Document ${field.document}.Comment does not exists`);
	}

	// Validate param dataId
	if (!_.isString(request.dataId)) {
		return new Meteor.Error('internal-error', "Param dataId must be a valid string id");
	}

	const data = modelComment.find({dataId: request.dataId}, {sort: {_createdAt: 1}}).fetch();

	return {success: true, data};
});

/* Create a new commento for given record
	@param authTokenId
	@param document
	@param dataId
	@param text
*/
Meteor.registerMethod('comments:create', 'withUser', 'withAccessForDocument', function(request) {
	// Validate text field
	if (!_.isString(request.text) || (request.text.length === 0)) {
		return new Meteor.Error('internal-error', "Comment must be a string with one or more characters");
	}

	// Get data model
	const model = Models[request.document];
	if ((model == null)) {
		return new Meteor.Error('internal-error', `Document ${request.document} does not exists`);
	}

	// Get comment model
	const modelComment = Models[`${request.document}.Comment`];
	if ((modelComment == null)) {
		return new Meteor.Error('internal-error', `Document ${request.document}.Comment does not exists`);
	}

	// Validate param dataId
	if (!_.isString(request.dataId)) {
		return new Meteor.Error('internal-error', "Param dataId must be a valid string id");
	}

	// If no record exists with passed ID return error
	const record = model.findOne(request.dataId);
	if ((record == null)) {
		return new Meteor.Error('internal-error', `Record not found using id ${request.dataId}`);
	}

	const data = {
		dataId: request.dataId,
		_createdAt: new Date,
		_createdBy: {
			_id: this.user._id,
			group: this.user.group,
			name: this.user.name
		},
		text: request.text
	};

	try {
		modelComment.insert(data);
	} catch (e) {
		console.log(e);
		this.notifyError('Comment - Insert Error', e);
	}

	return {success: true, data: [data]};
});

