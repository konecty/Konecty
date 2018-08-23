/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Middleware to get user and populate into request
Meteor.registerMiddleware('withUser', function(request) {
	if (this.user != null) {
		return;
	}

	if ((request != null ? request.authTokenId : undefined) != null) {
		this.hashedToken = request.authTokenId;


		// @TODO: In the future, use only @hashedToken = Accounts._hashLoginToken request.authTokenId as it should always receive client loginToken
		if ((request.authTokenId.toLowerCase != null) && (request.authTokenId.length === 24)) {
			this.hashedToken = request.authTokenId.toLowerCase();
		}

		if (request.authTokenId.length === 43) {
			this.hashedToken = Accounts._hashLoginToken(request.authTokenId);
		}

		this.user = Meteor.users.findOne({'services.resume.loginTokens.hashedToken': this.hashedToken});

		// If no user was found return error
		if ((this.user == null)) {
			console.log(`[withUser] User not found using token ${this.hashedToken}`);
			return 401;
		}

		this.userId = this.user._id;

	} else if (this.userId != null) {
		this.user = Meteor.users.findOne({_id: this.userId});

	} else {
		console.log('[withUser] No authTokenId or user was passed');
		return 401;
	}

	if (this.user.active !== true) {
		console.log(`[withUser] User inactive for token ${this.hashedToken}`);
		return 401;
	}

	// Set lastLogin if no lastLogin or is older than 1h
	if ((request == null) || (request.dontSetLastLogin !== true)) {
		if ((this.user.lastLogin == null) || !_.isDate(this.user.lastLogin) || ((Date.now() - this.user.lastLogin.getTime()) > 3600000)) {
			Meteor.defer(() => {
				return Meteor.users.update(this.user._id, {$set: {lastLogin: new Date}});
			});
		}
	}

});


// Middleware to get access from document as parameter 'document'
Meteor.registerMiddleware('withAccessForDocument', function(request) {
	if (this.access != null) {
		return;
	}

	const documentName = request.document;

	// If no param was found with document name return 401 (Unauthorized)
	if ((documentName == null)) {
		console.log('[withAccessForDocument] No documentName was passaed');
		return 401;
	}

	// Find access
	const access = accessUtils.getAccessFor(documentName, this.user);

	// If return is false no access was found then return 401 (Unauthorized)
	if (access === false) {
		console.log('[withAccessForDocument] User have no access');
		return 401;
	}

	// If return is object then set access into requrest
	if (_.isObject(access)) {
		this.access = access;
		return;
	}

	// Return 401 (Unauthorized) if no access was found
	console.log('[withAccessForDocument] No access found');
	return 401;
});


// Middleware to get meta from document as parameter 'document'
Meteor.registerMiddleware('withMetaForDocument', function(request) {
	const documentName = request.document;

	// If no param was found with document name return 401 (Unauthorized)
	if ((documentName == null)) {
		return new Meteor.Error('internal-error', '[withMetaForDocument] No documentName was passaed', {request});
	}

	// Try to get metadata
	const meta = Meta[request.document];
	if ((meta == null)) {
		return new Meteor.Error('internal-error', `[withMetaForDocument] Document [${request.document}] does not exists`, {request});
	}

	this.meta = meta;
});


// Middleware to get model from document as parameter 'document'
Meteor.registerMiddleware('withModelForDocument', function(request) {
	const documentName = request.document;

	// If no param was found with document name return 401 (Unauthorized)
	if ((documentName == null)) {
		return new Meteor.Error('internal-error', '[withModelForDocument] No documentName was passaed', {request});
	}

	// Try to get model of document
	const model = Models[request.document];
	if ((model == null)) {
		return new Meteor.Error('internal-error', `[withModelForDocument] Document [${request.document}] does not exists`, {request});
	}

	this.model = model;
});
