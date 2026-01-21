import path from 'path';
import has from 'lodash/has';
import get from 'lodash/get';
import Handlebars from 'handlebars';
import fs from 'fs/promises';

import { getUser } from '@imports/auth/getUser';
import { MetaObject } from '../../model/MetaObject';
import { getAccessFor } from '../../utils/accessUtils';
import { generateStampedLoginToken } from '@imports/auth/login/token';
import { randomId, randomPassword } from '../../utils/random';
import { GENERATED_PASSOWRD_LENGTH } from '../../consts';
import { setPassword } from '@imports/auth/password';
import { templatePath } from '../../utils/templatesPath';
import { logger } from '../../utils/logger';

export async function setRandomPasswordAndSendByEmail({ authTokenId, userIds, host, isNewUser = false }) {
	logger.debug(`[setRandomPasswordAndSendByEmail] isNewUser: ${isNewUser}, host: ${host}`);
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

		const userRecords = await MetaObject.Collections.User.find({
			$or: [{ _id: { $in: userIds } }, { username: { $in: userIds } }, { 'emails.address': { $in: userIds } }],
		}).toArray();

		if (userRecords.length === 0) {
			return {
				success: false,
				errors: [{ message: 'User(s) not found' }],
			};
		}

		const { ns } = MetaObject.Namespace;
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

				await MetaObject.Collections.User.updateOne({ _id: userRecord._id }, updateObj);

				const token = encodeURIComponent(hashStampedToken.hashedToken);

				const loginUrl = `https://${host}/rest/auth/loginByUrl/${ns}/${token}`;

				const password = randomPassword(MetaObject.Namespace.passwordPolicy?.minLength ?? GENERATED_PASSOWRD_LENGTH);

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

				// Seleciona o template apropriado baseado no contexto
				const templateName = isNewUser ? 'email/newUserPassword.html' : 'email/resetPassword.html';
				const emailSubject = isNewUser ? '[Auxiliadora Predial] Bem-vindo! Sua senha de acesso' : '[Konecty] Sua nova senha';
				
				logger.debug(`[setRandomPasswordAndSendByEmail] Template: ${templateName}, Subject: ${emailSubject}, isNewUser: ${isNewUser}`);

				const passwordTemplatePath = path.join(templatePath(), templateName);

				const passwordTemplate = await fs.readFile(passwordTemplatePath, 'utf8');

				const template = Handlebars.compile(passwordTemplate);

				const html = template({
					password,
					data,
				});

				await MetaObject.Collections.Message.insertOne({
					_id: randomId(),
					from: 'Konecty <support@konecty.com>',
					to: get(userRecord, 'emails.0.address'),
					subject: emailSubject,
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
