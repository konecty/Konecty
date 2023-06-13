import { Meteor } from 'meteor/meteor';

import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import get from 'lodash/get';

import { logger } from '/imports/utils/logger';

Meteor.registerLogs = false;
Meteor.registerDoneLogs = false;
Meteor.registerVerboseLogs = false;

Meteor.registerBeforeMethod('startTime', function () {
	this.startTime = new Date();
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
