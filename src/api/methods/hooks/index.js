import toArray from 'lodash/toArray';
import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import get from 'lodash/get';

import { registerBeforeMethod, registerAfterMethod } from 'utils/methods';

import * as NotifyErrors from 'utils/errors';

const init = () => {
	registerBeforeMethod('startTime', function () {
		this.startTime = new Date();
	});

	registerBeforeMethod('bugsnag', function () {
		const context = this;

		this.notifyError = function (type, message, options) {
			if (type instanceof Error && !options) {
				options = message;
				message = type;
				type = undefined;
			}

			options = options || {};
			options.url = context.__methodName__;

			options.user = {
				_id: get(context, 'user._id', { valueOf: () => undefined }).valueOf(),
				name: get(context, 'user.name :'),
				login: get(context, 'user.username'),
				email: get(context, 'user.emails'),
				access: get(context, 'user.access'),
				lastLogin: get(context, 'user.lastLogin'),
			};

			return NotifyErrors.notify(type, message, options);
		};
	});

	registerAfterMethod('catchErrors', function (params) {
		const notifyError = function (error) {
			return this.notifyError('DDPCatchErrors', error, {
				errorDetail: error,
				methodResult: params.result,
				methodArguments: toArray(params.arguments),
			});
		}.bind(this);

		if (params.result instanceof Error) {
			notifyError(params.result);
			params.result = {
				success: false,
				errors: [{ message: params.result.message }],
			};
		} else if (isObject(params.result) && isArray(params.result.errors)) {
			for (let error of params.result.errors) {
				notifyError(error);
			}
		}
	});

	registerAfterMethod('totalTime', function (params) {
		if (isObject(params.result) && this.startTime instanceof Date) {
			const endTime = new Date();
			this.time = endTime.getTime() - this.startTime.getTime();
			params.result.time = this.time;
		}
	});
};

export { init };
