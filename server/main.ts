import { Meteor } from 'meteor/meteor';
import { NotifyErrors } from '/imports/utils/errors';

import '/server/startup/_loadMetaObjects.js';
import '/server/startup/color.js';
import '/server/startup/konsistent.js';
import '/server/methods/index';
import '/server/routes/api/translation';
import '/server/routes/rest';
import '/server/publications/changeStream';
import { logger } from '/imports/utils/logger';

if (process.env.NODE_ENV !== 'development') {
	process.on('uncaughtException', error => {
		logger.error(error, 'uncaughtException');
		NotifyErrors.notify('uncaughtException', error);
	});
}

const originalMeteorDebug = Meteor._debug;

// TODO: remove this when we have a better way to handle errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Meteor._debug = function (message: any, stack: any, ...args: any[]) {
	if (typeof stack === 'string') {
		message += ` ${stack}`;
	}

	const error = new Error(message);
	error.stack = stack;

	NotifyErrors.notify('Meteor._debug', error);

	originalMeteorDebug.apply(this, [message, stack, ...args]);
};

// Accounts.config({forbidClientAccountCreation: true});
