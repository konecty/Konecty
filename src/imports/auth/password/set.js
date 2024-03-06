import { hash as bcryptHash } from 'bcryptjs';
import crypto from 'crypto';

import { getUser } from '@imports/auth/getUser';
import { MetaObject } from '../../model/MetaObject';
import { getAccessFor } from '../../utils/accessUtils';

import { BCRYPT_SALT_ROUNDS, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../consts';

export async function setPassword({ authTokenId, userId, password }) {
	try {
		const user = await getUser(authTokenId);

		const access = getAccessFor('User', user);

		if (access === false) {
			return {
				success: false,
				errors: [{ message: 'Access denied' }],
			};
		}

		const userRecord = await MetaObject.Collections.User.findOne({ $or: [{ _id: userId }, { username: userId }, { 'emails.address': userId }] });

		if (userRecord == null) {
			return {
				success: false,
				errors: [{ message: 'User not found' }],
			};
		}

		if (user.admin !== true && user._id !== userRecord._id && access.changePassword !== true) {
			return {
				success: false,
				errors: [{ message: 'Access denied' }],
			};
		}

		if (password == null) {
			return {
				success: false,
				errors: [{ message: 'Password is required' }],
			};
		}

		if (password.length > MAX_PASSWORD_LENGTH) {
			return {
				success: false,
				errors: [{ message: 'Password is too long' }],
			};
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			return {
				success: false,
				errors: [{ message: 'Password is too short' }],
			};
		}

		const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

		const hashPassword = await bcryptHash(hashedPassword, BCRYPT_SALT_ROUNDS);

		const update = {
			$unset: {
				'services.password.reset': true,
				'services.resume.loginTokens': true,
			},
			$set: { 'services.password.bcrypt': hashPassword },
		};

		await MetaObject.Collections.User.updateOne({ _id: userRecord._id }, update);

		return { success: true };
	} catch (error) {
		if (/^\[get-user\]/.test(error.message)) {
			return {
				success: false,
				errors: [{ message: 'Access denied' }],
			};
		}
		return {
			success: false,
			errors: [{ message: error.message }],
		};
	}
}
