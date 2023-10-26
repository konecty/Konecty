import crypto from 'crypto';
import { hash as bcryptHash } from 'bcryptjs';

import isObject from 'lodash/isObject';

import { BCRYPT_SALT_ROUNDS, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '../consts';
import { errorReturn, successReturn } from '../utils/return';

export async function processCollectionLogin({ meta, data }) {
	if (meta.login == null) {
		return successReturn();
	}

	if (meta.login.allow == null) {
		return successReturn();
	}

	const loginData = data[meta.login.field];

	if (loginData == null || loginData._id != null) {
		return successReturn();
	}

	if (loginData.password == null) {
		return errorReturn(`${meta.login.field}.password is required`);
	}

	if (loginData.password.length > MAX_PASSWORD_LENGTH) {
		return errorReturn('Password is too long');
	}
	if (loginData.password.length < MIN_PASSWORD_LENGTH) {
		return errorReturn('Password is too short');
	}

	if (loginData.username == null && loginData.email == null) {
		return errorReturn(`${meta.login.field}.username or ${meta.login.field}.email is required`);
	}

	const userRecord = {};
	if (isObject(meta.login.defaultValues)) {
		Object.assign(userRecord, meta.login.defaultValues);
	}
	if (loginData.username != null) {
		userRecord.username = loginData.username;
	}

	if (loginData.email != null) {
		userRecord.emails = [{ address: loginData.email }];
	}

	const hashedPassword = crypto.createHash('sha256').update(loginData.password).digest('hex');

	const hashPassword = await bcryptHash(hashedPassword, BCRYPT_SALT_ROUNDS);

	userRecord.services = {
		password: {
			bcrypt: hashPassword,
		},
	};

	return successReturn(userRecord);
}
