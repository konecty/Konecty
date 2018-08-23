/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// 
/* @DEPENDS_ON_META */
Meteor.registerMiddleware('processCollectionLogin', function(request) {
	let data;
	if ((this.meta.login == null)) {
		return;
	}

	if (this.meta.login.allow !== true) {
		return;
	}

	if (this.__methodName__ === 'data:update') {
		({ data } = request.data);
	} else {
		({ data } = request);
	}

	// If no data for process login or if already have lookup record, return
	if ((data[this.meta.login.field] == null) || (data[this.meta.login.field]._id != null)) {
		return;
	}

	// If no password, return error
	if ((data[this.meta.login.field].password == null)) {
		return new Meteor.Error('internal-error', `${this.meta.login.field}.password is required`);
	}

	// If no username or email, return error
	if ((data[this.meta.login.field].username == null) && (data[this.meta.login.field].email == null)) {
		return new Meteor.Error('internal-error', `${this.meta.login.field}.username or ${this.meta.login.field}.email is required`);
	}

	// If is an multiple update, return error
	if ((this.__methodName__ === 'data:update') && (request.data.ids.length !== 1)) {
		return new Meteor.Error('internal-error', 'Only can process login for single updates');
	}

	const userRecord = {};

	if ((this.__methodName__ === 'data:create') && (data._id == null)) {
		data._id = Random.id();
		userRecord._id = data._id;
	} else {
		userRecord._id = request.data.ids[0]._id;
	}

	if (_.isObject(this.meta.login.defaultValues)) {
		for (let key in this.meta.login.defaultValues) { const value = this.meta.login.defaultValues[key]; userRecord[key] = value; }
	}

	if (data[this.meta.login.field].username != null) {
		userRecord.username = data[this.meta.login.field].username;
	}

	if (data[this.meta.login.field].email != null) {
		userRecord.emails = [{
			address: data[this.meta.login.field].email
		}];
	}

	const userResult = Meteor.call('data:create', {
		authTokenId: request.authTokenId,
		document: 'User',
		data: userRecord
	}
	);

	if (userResult instanceof Error || ((userResult != null ? userResult.success : undefined) !== true)) {
		return userResult;
	}

	if (((userResult != null ? userResult.success : undefined) === true) && (userResult.data.length === 1)) {
		Accounts.setPassword(userRecord._id, data[this.meta.login.field].password);
		data[this.meta.login.field] = userResult.data[0];
	}

});