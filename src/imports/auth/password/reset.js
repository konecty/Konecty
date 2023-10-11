import get from 'lodash/get';

import { MetaObject } from '../..//model/MetaObject';
import { generateStampedLoginToken } from '../..//auth/login/token';

export async function resetPassword({ user, ns, host }) {
	const userRecord = await MetaObject.Collections.User.findOne({ $and: [{ active: true }, { $or: [{ username: user }, { 'emails.address': user }] }] });

	if (userRecord == null) {
		return {
			success: false,
			errors: [{ message: 'User not found' }],
		};
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

	const now = new Date();
	const expireAt = new Date(now.setMinutes(now.getMinutes() + 360));

	const token = encodeURIComponent(hashStampedToken.hashedToken);
	const emailData = {
		from: 'Konecty Alerts <alerts@konecty.com>',
		to: get(userRecord, 'emails.0.address'),
		subject: '[Konecty] Password Reset',
		template: 'resetPassword.html',
		type: 'Email',
		status: 'Send',
		discard: true,
		data: {
			name: userRecord.name,
			expireAt,
			url: `https://${host}/rest/auth/loginByUrl/${ns}/${token}`,
		},
	};

	await MetaObject.Collections.Message.insertOne(emailData);

	return { success: true };
}
