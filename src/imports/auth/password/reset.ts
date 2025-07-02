import { generateStampedLoginToken } from '@imports/auth/login/token';
import { MetaObject } from '@imports/model/MetaObject';
import { type User } from '@imports/model/User';
import { DataDocument } from '@imports/types/data';
import { randomId } from '@imports/utils/random';
import { Collection } from 'mongodb';

type ResetPasswordParams = {
	user: string;
	ns: string;
	host: string;
};

export async function resetPassword({ user, ns, host }: ResetPasswordParams) {
	const UserColl = MetaObject.Collections.User as unknown as Collection<User>;
	const userRecord = await UserColl.findOne({ $and: [{ active: true }, { $or: [{ username: user }, { 'emails.address': user }] }] });

	if (userRecord == null) {
		return {
			success: false,
			errors: [{ message: 'User not found' }],
		};
	}

	const emailAddress = userRecord.emails?.[0]?.address;
	console.log(emailAddress);
	if (emailAddress == null) {
		return {
			success: false,
			errors: [{ message: 'User does not have an email address' }],
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

	await UserColl.updateOne({ _id: userRecord._id }, updateObj);

	const now = new Date();
	const expireAt = new Date(now.setMinutes(now.getMinutes() + 360));

	const token = encodeURIComponent(hashStampedToken.hashedToken);
	const emailData = {
		_id: randomId(),
		from: 'Konecty Alerts <alerts@konecty.com>',
		to: emailAddress,
		subject: '[Konecty] Password Reset',
		template: 'resetPassword.html',
		type: 'Email',
		status: 'Send',
		discard: true,
		_createdAt: new Date(),
		_updatedAt: new Date(),
		data: {
			name: userRecord.name,
			expireAt,
			url: `https://${host}/rest/auth/loginByUrl/${ns}/${token}`,
		},
	};

	const MessageColl = MetaObject.Collections.Message as unknown as Collection<DataDocument>;
	await MessageColl.insertOne(emailData);

	return { success: true };
}
