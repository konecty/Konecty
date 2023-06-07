import { Meteor } from 'meteor/meteor';
import { NotifyErrors } from '/imports/utils/errors';

import '/server/startup/_loadMetaObjects.js';
import '/server/startup/color.js';
import '/server/startup/konsistent.js';
import '/server/routes/api/translation';
import '/server/routes/rest';

process.on('uncaughtException', error => NotifyErrors.notify('uncaughtException', error));

const originalMeteorDebug = Meteor._debug;
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
