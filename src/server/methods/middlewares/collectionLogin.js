import isObject from 'lodash/isObject';
import get from 'lodash/get';

import { callMethod, registerMiddleware } from 'utils/methods';
import { randomId } from 'utils';
import { setPassword } from 'utils/password';

const init = () => {
	registerMiddleware('processCollectionLogin', async function (request) {
		let data;
		if (!this.meta.login) {
			return;
		}

		if (this.meta.login.allow !== true) {
			return;
		}

		if (this.__methodName__ === 'data:update') {
			({ data } = request.data);
		} else {
			({ data } = request);
		}

		// If no data for process login or if already have lookup record, return
		if (!data[this.meta.login.field] || data[this.meta.login.field]._id) {
			return;
		}

		// If no password, return error
		if (!data[this.meta.login.field].password) {
			return new Error(`[internal-error] ${this.meta.login.field}.password is required`);
		}

		// If no username or email, return error
		if (!data[this.meta.login.field].username && !data[this.meta.login.field].email) {
			return new Error(`[internal-error] ${this.meta.login.field}.username or ${this.meta.login.field}.email is required`);
		}

		// If is an multiple update, return error
		if (this.__methodName__ === 'data:update' && request.data.ids.length !== 1) {
			return new Error('[internal-error] Only can process login for single updates');
		}

		const userRecord = {};

		if (this.__methodName__ === 'data:create' && !data._id) {
			data._id = randomId();
			userRecord._id = data._id;
		} else {
			userRecord._id = request.data.ids[0]._id;
		}

		if (isObject(this.meta.login.defaultValues)) {
			for (const key in this.meta.login.defaultValues) {
				const value = this.meta.login.defaultValues[key];
				userRecord[key] = value;
			}
		}

		if (data[this.meta.login.field].username) {
			userRecord.username = data[this.meta.login.field].username;
		}

		if (data[this.meta.login.field].email) {
			userRecord.emails = [
				{
					address: data[this.meta.login.field].email,
				},
			];
		}

		const userResult = await callMethod('data:create', {
			authTokenId: request.authTokenId,
			document: 'User',
			data: userRecord,
		});

		if (userResult instanceof Error || get(userResult, 'success') !== true) {
			return userResult;
		}

		if (get(userResult, 'success') === true && userResult.data.length === 1) {
			setPassword(userRecord._id, data[this.meta.login.field].password);
			data[this.meta.login.field] = userResult.data[0];
		}
	});
};

export { init };
