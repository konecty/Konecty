/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const bugsnag = require('bugsnag');

global.NotifyErrors = {};

NotifyErrors.notify = function(type, message, options) {
	if (type instanceof Error && (options == null)) {
		options = message;
		message = type;
		type = undefined;
	}

	options = options || {};

	if (_.isString(message)) {
		message = new Meteor.Error(type, message);
	}

	if (message instanceof Meteor.Error) {
		if ((type == null) && (message.error != null)) {
			type = message.error;
		}

		if (_.isObject(message.details)) {
			for (let key in message.details) { const value = message.details[key]; options[key] = value; }
		} else {
			options.errorDetail = message.details;
		}
	}

	options.errorName = `[${process.env.dbName}] ${type}`;

	if (__guard__(message != null ? message.details : undefined, x => x.bugsnag) === false) {
		return;
	}

	return bugsnag.notify(message, options);
};


process.on('uncaughtException', error => NotifyErrors.notify('uncaughtException', error));


const originalMeteorDebug = Meteor._debug;
Meteor._debug = function(message, stack) {
	if (typeof stack === 'string') {
		message += ` ${stack}`;
	}

	const error = new Meteor.Error('internal-error', message);
	error.stack = stack;

	NotifyErrors.notify('Meteor._debug', error);

	return originalMeteorDebug.apply(this, arguments);
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}