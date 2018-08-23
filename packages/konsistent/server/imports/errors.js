/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const bugsnag = require('bugsnag');

const mongodbUri = require('mongodb-uri');
const uriObject = mongodbUri.parse(process.env.MONGO_URL);
process.env.dbName = uriObject.database;

bugsnag.register('e6464a5423ceea7cb3b5b7ee8731f0fb');

class KonectyError extends Error {
	constructor(msg, options) {
		{
		  // Hack: trick Babel/TypeScript into allowing this before super.
		  if (false) { super(); }
		  let thisFn = (() => { return this; }).toString();
		  let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
		  eval(`${thisName} = this;`);
		}
		if (options == null) { options = {}; }
		this.message = msg;
		for (let key in options) {
			const value = options[key];
			this[key] = value;
		}
	}
}

global.KonectyError = KonectyError;

class ErrorWithCode extends Error {
	constructor(code, msg) {
		{
		  // Hack: trick Babel/TypeScript into allowing this before super.
		  if (false) { super(); }
		  let thisFn = (() => { return this; }).toString();
		  let thisName = thisFn.slice(thisFn.indexOf('return') + 6 + 1, thisFn.indexOf(';')).trim();
		  eval(`${thisName} = this;`);
		}
		this.message = msg;
		this.code = code;
	}
}

global.ErrorWithCode = ErrorWithCode;

global.NotifyErrors = {};

NotifyErrors.notify = function(type, message, options) {
	options = options || {};
	options.errorName = `[${process.env.dbName}] ${type}`;

	if (_.isString(message)) {
		message = new Error(message);
	}

	options.groupingHash = options.errorName + message.message;

	return bugsnag.notify(message, options);
};


process.on('uncaughtException', error => NotifyErrors.notify('uncaughtException', error));


const originalMeteorDebug = Meteor._debug;
Meteor._debug = function(message, stack) {
	if (typeof stack === 'string') {
		message += ` ${stack}`;
	}

	const error = new Error(message);
	error.stack = stack;

	NotifyErrors.notify('Meteor._debug', error);

	return originalMeteorDebug.apply(this, arguments);
};
