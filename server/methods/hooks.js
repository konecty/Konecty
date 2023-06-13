import { Meteor } from 'meteor/meteor';

import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import get from 'lodash/get';

import { NotifyErrors } from '/imports/utils/errors';
import { logger } from '/imports/utils/logger';

Meteor.registerLogs = false;
Meteor.registerDoneLogs = false;
Meteor.registerVerboseLogs = false;

Meteor.registerBeforeMethod('startTime', function () {
	this.startTime = new Date();
});

Meteor.registerBeforeMethod('notify', function () {
	this.notifyError = function (type, message, options) {
		if (type instanceof Error && !options) {
			options = message;
			message = type;
			type = undefined;
		}

		options = options || {};
		options.url = this.__methodName__;

		options.user = {
			_id: get(this, 'user._id', { valueOf: () => undefined }).valueOf(),
			name: get(this, 'user.name :'),
			login: get(this, 'user.username'),
			email: get(this, 'user.emails'),
			access: get(this, 'user.access'),
			lastLogin: get(this, 'user.lastLogin'),
		};

		return NotifyErrors.notify(type, message, options);
	};
});

Meteor.registerAfterMethod('catchErrors', function (params) {
	if (params.result instanceof Error) {
		logger.error(params.result, `Method ${this.__methodName__} error: ${params.result.message}`);

		params.result = {
			success: false,
			errors: [{ message: params.result.message }],
		};
	} else if (isObject(params.result) && isArray(params.result.errors)) {
		for (let error of params.result.errors) {
			logger.error(error, `Method ${this.__methodName__} error: ${error.message}`);
		}
	}
});

Meteor.registerAfterMethod('totalTime', function (params) {
	if (isObject(params.result) && this.startTime instanceof Date) {
		const endTime = new Date();
		this.time = endTime.getTime() - this.startTime.getTime();
		params.result.time = this.time;
	}
});
