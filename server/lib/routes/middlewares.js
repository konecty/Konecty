/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
global.middlewares = {};

// Middleware to get user and populate into request
middlewares.user = function(req, res, next) {
	const token = req.cookies['_authTokenId'] || req.cookies['authTokenId'];
	const hashedToken = Accounts._hashLoginToken(token);

	// Find User from session
	req.user = Meteor.users.findOne({'services.resume.loginTokens.hashedToken': {$in: [ token, hashedToken ]}});

	// If no user was found return error
	if ((req.user == null)) {
		return res.send(new Meteor.Error('internal-error', 'Token doesn\'t exists'));
	}

	if (req.user.active !== true) {
		return res.send(new Meteor.Error('internal-error', 'User inactive'));
	}

	// If everithing is awesome go to next step
	return next();
};

// Middleware to get access of user and document
middlewares.getAccessFor = documentParamName =>
	function(req, res, next) {
		const documentName = req.params[documentParamName];

		// If no param was found with document name return 401 (Unauthorized)
		if ((documentName == null)) {
			return res.send(401);
		}

		// Find access
		const access = accessUtils.getAccessFor(documentName, req.user);

		// If return is false no access was found then return 401 (Unauthorized)
		if (access === false) {
			return res.send(401);
		}

		// If return is object then set access into requrest
		if (_.isObject(access)) {
			req.access = access;
			return next();
		}

		// Return 401 (Unauthorized) if no access was found
		return res.send(401);
	}
;

// Middleware to get session, user and access
middlewares.sessionUserAndGetAccessFor = documentParamName =>
	(req, res, next) =>
		middlewares.user(req, res, function() {
			const fn = middlewares.getAccessFor(documentParamName);
			return fn(req, res, next);
		})
	
;