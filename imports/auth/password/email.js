import path from 'path';
import has from 'lodash/has';
import get from 'lodash/get';
import Handlebars from 'handlebars';
import fs from 'fs/promises';

import { getUser } from '/imports/auth/getUser';
import { Collections, Namespace } from '/imports/model/MetaObject';
import { getAccessFor } from '/imports/utils/accessUtils';
import { generateStampedLoginToken } from '/imports/auth/login/token';
import { randomId, randomPassword } from '/imports/utils/random';
import { GENERATED_PASSOWRD_LENGTH } from '/imports/auth/consts';
import { setPassword } from '/imports/auth/password';
import { templatePath } from '/imports/utils/templatesPath';
import { logger } from '/imports/utils/logger';

export async function setRandomPasswordAndSendByEmail({ authTokenId, userIds, host }) {
	if (Array.isArray(userIds) === false) {
		return {
			success: false,
			errors: [{ message: 'userIds must be an array' }],
		};
	}

	try {
		const user = await getUser(authTokenId);

		const access = getAccessFor('User', user);

		if (access === false) {
			return {
				success: false,
				errors: [{ message: 'Unauthorized' }],
			};
		}

		const userRecords = await Collections.User.find({
			$or: [{ _id: { $in: userIds } }, { username: { $in: userIds } }, { 'emails.address': { $in: userIds } }],
		}).toArray();

		if (userRecords.length === 0) {
			return {
				success: false,
				errors: [{ message: 'User(s) not found' }],
			};
		}

		const { ns } = Namespace;
		const errors = await Promise.all(
			userRecords.map(async userRecord => {
				if (!has(userRecord, 'emails.0.address')) {
					return { message: `User [${userRecord.username}] has no email.` };
				}

				if (user.admin !== true && user._id !== userRecord._id && access.changePassword !== true) {
					return { message: `Unauthorized to change password for user [${userRecord.username}].` };
				}

				const hashStampedToken = generateStampedLoginToken();
				const updateObj = {
					$set: {
						lastLogin: new Date(),
					},
					$push: {
						'services.resume.loginTokens': hashStampedToken,
					},
				};

				await Collections.User.updateOne({ _id: userRecord._id }, updateObj);

				const token = encodeURIComponent(hashStampedToken.hashedToken);

				const loginUrl = `https://${host}/rest/auth/loginByUrl/${ns}/${token}`;

				const password = randomPassword(Namespace.passwordPolicy?.minLength ?? GENERATED_PASSOWRD_LENGTH);

				const result = await setPassword({ authTokenId, userId: userRecord._id, password });

				if (result.success === false) {
					return { message: `Error setting password for user [${userRecord.username}].` };
				}

				const data = {
					username: userRecord.username,
					password,
					name: userRecord.name,
					url: loginUrl,
				};

				const resetPasswordTemplatePath = path.join(templatePath(), 'email/resetPassword.html');

				const resetPasswordTemplate = await fs.readFile(resetPasswordTemplatePath, 'utf8');

				const template = Handlebars.compile(resetPasswordTemplate);

				const html = template({
					password,
					data,
				});

				await Collections.Message.insertOne({
					_id: randomId(),
					from: 'Konecty <support@konecty.com>',
					to: get(userRecord, 'emails.0.address'),
					subject: '[Konecty] Sua nova senha',
					body: html,
					type: 'Email',
					status: 'Send',
					discard: true,
				});
				return;
			}),
		);

		if (errors.filter(e => e).length > 0) {
			return {
				success: false,
				errors: errors.filter(e => e),
			};
		}

		return { success: true };
	} catch (error) {
		if (/^\[get-user\]/.test(error.message)) {
			return {
				success: false,
				errors: [{ message: 'Unauthorized' }],
			};
		}
		logger.error(error, 'Error setting random password and sending by email');
		return {
			success: false,
			errors: [{ message: error.message }],
		};
	}
}
