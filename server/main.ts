import { Meteor } from 'meteor/meteor';

import '/server/startup/_loadMetaObjects.js';
import '/server/startup/konsistent.js';
import '/server/routes/api';
import '/server/routes/rest';
import { logger } from '/imports/utils/logger';

if (process.env.NODE_ENV !== 'development') {
	process.on('uncaughtException', error => {
		logger.error(error, `uncaughtException ${error.message}`);
	});
}

const originalMeteorDebug = Meteor._debug;

// TODO: remove this when we have a better way to handle errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Meteor._debug = function (message: any, stack: any, ...args: any[]) {
	if (typeof stack === 'string') {
		message += ` ${stack}`;
	}
	logger.error(message, `Meteor._debug`);

	const error = new Error(message);
	error.stack = stack;

	originalMeteorDebug.apply(this, [message, stack, ...args]);
};
