import { Meteor } from 'meteor/meteor';
import { get } from 'lodash';
import { logger } from '/imports/utils/logger';

import { parse } from 'mongodb-uri';
const uriObject = parse(process.env.MONGO_URL);
process.env.dbName = uriObject.database;

export class KonectyError extends Error {
	constructor(msg, options) {
		super(msg);
		if (options === null) {
			options = {};
		}
		this.message = msg;
		for (let key in options) {
			const value = options[key];
			this[key] = value;
		}
	}
}

export class ErrorWithCode extends Error {
	constructor(code, msg) {
		super(msg);
		this.message = msg;
		this.code = code;
	}
}

export const NotifyErrors = {
	notify(type, message, options) {
		if (type instanceof Error && options === null) {
			options = message;
			message = type;
			type = undefined;
		}

		options = options || {};

		if (get(message, 'details.notify') === false) {
			return;
		}

		const reportError = new Error(type);
		const reportOptions = {
			...options,
			errorName: `[${process.env.dbName}] ${type}`,
			metadata: {
				...options.metadata,
				errorDetais: message,
			},
		};

		logger.error({ reportError, reportOptions }, message);
	},
};
