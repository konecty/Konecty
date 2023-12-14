import { hash as bcryptHash, compare as bcryptCompare } from 'bcryptjs';
import { UAParser } from 'ua-parser-js';
import get from 'lodash/get';

import { MetaObject } from '@imports/model/MetaObject';
import { BCRYPT_SALT_ROUNDS, DEFAULT_LOGIN_EXPIRATION } from '../../consts';
import { generateStampedLoginToken } from '@imports/auth/login/token';
import { ObjectId } from 'mongodb';

interface LoginParams {
	ip?: string | string[];
	user: string;
	password: string;
	password_SHA256?: string;
	geolocation?: { longitude: number; latitude: number } | string;
	resolution?: { width: number; height: number } | string;
	userAgent?: string;
}

interface accessLog {
	_createdAt: Date;
	_updatedAt: Date;
	ip?: string | string[];
	login: string;
	browser?: string;
	browserVersion?: string;
	os?: string;
	platform?: string;
	geolocation?: [number, number];
	resolution?: { width: number; height: number };
	reason?: string;
	_user?: [
		{
			_id: string;
			name: string;
			group: string;
		},
	];
}

export async function login({ ip, user, password, password_SHA256, geolocation, resolution, userAgent }: LoginParams) {
	const ua = new UAParser(userAgent ?? 'API Call').getResult();

	const accessLog: accessLog = {
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
		if (typeof resolution === 'string') {
			accessLog.resolution = JSON.parse(resolution);
		} else {
			accessLog.resolution = resolution;
		}
	}

	// If there is a geolocation store it with session
	if (geolocation != null) {
		if (typeof geolocation === 'string') {
			const { lng, lat } = JSON.parse(geolocation);
			accessLog.geolocation = [lng, lat];
		} else {
			const { longitude, latitude } = geolocation;
			accessLog.geolocation = [longitude, latitude];
		}
	} else if (MetaObject.Namespace.trackUserGeolocation === true) {
		accessLog.reason = 'Geolocation required';
		await MetaObject.Collections.AccessFailedLog.insertOne(accessLog);
		throw new Error('Geolocation required');
	}

	const userRecord = await MetaObject.Collections.User.findOne({
		'services.password.bcrypt': { $exists: true },
		active: true,
		$or: [{ username: user }, { 'emails.address': user }],
	});

	if (userRecord == null) {
		accessLog.reason = `Active User not found [${user}]`;
		await MetaObject.Collections.AccessFailedLog.insertOne(accessLog);

		return {
			success: false,
			logged: false,
			errors: [{ message: 'Wrong user or password' }],
		};
	}

	accessLog._user = [
		{
			_id: userRecord._id?.toString() || `${userRecord._id}`,
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
		await MetaObject.Collections.AccessFailedLog.insertOne(accessLog);
		return {
			success: false,
			logged: false,
			errors: [{ message: 'Wrong user or password' }],
		};
	}

	if (parseInt(hashRounds, 10) < BCRYPT_SALT_ROUNDS) {
		const newHash = await bcryptHash(passwordText, BCRYPT_SALT_ROUNDS);
		await MetaObject.Collections.User.updateOne({ _id: userRecord._id }, { $set: { 'services.password.bcryptjs': newHash } });
	}

	const hashStampedToken = generateStampedLoginToken();

	await MetaObject.Collections.User.updateOne(
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

	if (MetaObject.Collections.AccessLog != null) {
		await MetaObject.Collections.AccessLog.insertOne(accessLog);
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

export const cleanupSessions = async (userId: ObjectId, all = false) => {
	const oldestValidDate = new Date(Date.now() - (MetaObject.Namespace.loginExpiration ?? DEFAULT_LOGIN_EXPIRATION));

	if (all === true) {
		// Close all sessions, but keep api tokens
		await MetaObject.Collections.User.updateOne(
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
		await MetaObject.Collections.User.updateOne(
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
