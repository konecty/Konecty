import { hash as bcryptHash, compare as bcryptCompare } from 'bcrypt';
import { UAParser } from 'ua-parser-js';
import get from 'lodash/get';

import { Namespace, Collections } from '/imports/model/MetaObject';
import { BCRYPT_SALT_ROUNDS, DEFAULT_LOGIN_EXPIRATION } from '/imports/consts';
import { generateStampedLoginToken } from '/imports/auth/login/token';

export async function login({ ip, user, password, password_SHA256, geolocation, resolution, userAgent }) {
	const ua = new UAParser(userAgent ?? 'API Call').getResult();

	const accessLog = {
		_createdAt: new Date(),
		_updatedAt: new Date(),
		ip,
		login: user,
		browser: ua.browser.name,
		browserVersion: ua.browser.version,
		os: ua.os.name,
		platform: ua.device.type,
	};

	if (resolution != null) {
		accessLog.resolution = JSON.parse(resolution);
	}

	// If there is a geolocation store it with session
	if (geolocation != null) {
		const { lng, lat } = JSON.parse(geolocation);
		accessLog.geolocation = [lng, lat];
	} else if (Namespace.trackUserGeolocation === true) {
		accessLog.reason = 'Geolocation required';
		await Collections.AccessFailedLog.insertOne(accessLog);
		throw new Error('Geolocation required');
	}

	const userRecord = await Collections.User.findOne({ 'services.password.bcrypt': { $exists: true }, active: true, $or: [{ username: user }, { 'emails.address': user }] });

	if (userRecord == null) {
		accessLog.reason = `Active User not found [${user}]`;
		await Collections.AccessFailedLog.insertOne(accessLog);

		return {
			success: false,
			logged: false,
			errors: [{ message: 'Wrong user or password' }],
		};
	}

	accessLog._user = [
		{
			_id: userRecord._id,
			name: userRecord.name,
			group: userRecord.group,
		},
	];

	const passwordText = password_SHA256 || password;
	const hash = userRecord.services.password.bcrypt;
	const [, , hashRounds] = hash.split('$');

	const logged = await bcryptCompare(passwordText, hash);

	if (logged === false) {
		accessLog.reason = `Active User not found [${user}]`;
		await Collections.AccessFailedLog.insertOne(accessLog);
		return {
			success: false,
			logged: false,
			errors: [{ message: 'Wrong user or password' }],
		};
	}

	if (parseInt(hashRounds, 10) < BCRYPT_SALT_ROUNDS) {
		const newHash = await bcryptHash(passwordText, BCRYPT_SALT_ROUNDS);
		await Collections.User.updateOne({ _id: userRecord._id }, { $set: { 'services.password.bcrypt': newHash } });
	}

	const hashStampedToken = generateStampedLoginToken();

	await Collections.User.updateOne(
		{ _id: userRecord._id },
		{
			$set: {
				lastLogin: new Date(),
			},
			$push: {
				'services.resume.loginTokens': hashStampedToken,
			},
		},
	);

	if (Collections.AccessLog != null) {
		await Collections.AccessLog.insertOne(accessLog);
	}

	// clean up old sessions
	await cleanupSessions(userRecord._id);

	return {
		success: true,
		logged: true,
		authId: hashStampedToken.hashedToken,
		user: {
			_id: userRecord._id,
			access: userRecord.access,
			admin: userRecord.admin,
			email: get(userRecord, 'emails.0.address'),
			group: userRecord.group,
			locale: userRecord.locale,
			login: userRecord.username,
			name: userRecord.name,
			namespace: userRecord.namespace,
			role: userRecord.role,
		},
	};
}

export const cleanupSessions = async (userId, all = false) => {
	const oldestValidDate = new Date(Date.now() - (Namespace.loginExpiration ?? DEFAULT_LOGIN_EXPIRATION));

	if (all === true) {
		// Close all sessions, but keep api tokens
		await Collections.User.updateOne(
			{ _id: userId },
			{
				$pull: {
					'services.resume.loginTokens': {
						$or: [{ when: { $exists: true } }],
					},
				},
			},
		);
	} else {
		// Close all sessions older than expiration, but keep api tokens
		await Collections.User.updateOne(
			{ _id: userId, $or: [{ 'services.resume.loginTokens.when': { $lt: oldestValidDate } }, { 'services.resume.loginTokens.when': { $lt: +oldestValidDate } }] },
			{
				$pull: {
					'services.resume.loginTokens': {
						$or: [{ when: { $lt: oldestValidDate } }, { when: { $lt: +oldestValidDate } }],
					},
				},
			},
		);
	}
};
