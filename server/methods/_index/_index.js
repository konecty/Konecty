/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Meteor.registerLogs = false;
Meteor.registerDoneLogs = false;
Meteor.registerVerboseLogs = false;

Meteor.registerBeforeMethod('startTime', function() {
	this.startTime = new Date;
});


Meteor.registerBeforeMethod('bugsnag', function() {
	const context = this;

	this.notifyError = function(type, message, options) {
		if (type instanceof Error && (options == null)) {
			options = message;
			message = type;
			type = undefined;
		}

		options = options || {};
		options.url = context.__methodName__;

		options.user = {
			_id: __guard__(context.user != null ? context.user._id : undefined, x => x.valueOf()),
			name: (context.user != null ? context.user.name : undefined),
			login: (context.user != null ? context.user.username : undefined),
			email: (context.user != null ? context.user.emails : undefined),
			access: (context.user != null ? context.user.access : undefined),
			lastLogin: (context.user != null ? context.user.lastLogin : undefined)
		};

		return NotifyErrors.notify(type, message, options);
	};
});


Meteor.registerAfterMethod('catchErrors', function(params) {
	const notifyError = function(error) {
		console.log('DDPCatchErrors'.red, error);

		return this.notifyError('DDPCatchErrors', error, {
			errorDetail: error,
			methodResult: params.result,
			methodArguments: _.toArray(params.arguments)
		});
	}.bind(this);

	if (params.result instanceof Error) {
		notifyError(params.result);
		params.result = {
			success: false,
			errors: [
				{message: params.result.message}
			]
		};

	} else if (_.isObject(params.result) && _.isArray(params.result.errors)) {
		for (let error of Array.from(params.result.errors)) {
			notifyError(error);
		}
	}

});


Meteor.registerAfterMethod('totalTime', function(params) {
	if (_.isObject(params.result) && this.startTime instanceof Date) {
		const endTime = new Date;
		this.time = endTime.getTime() - this.startTime.getTime();
		params.result.time = this.time;
	}
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}