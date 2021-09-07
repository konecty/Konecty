import useragent from 'useragent';

import isArray from 'lodash/isArray';
import every from 'lodash/every';
import isString from 'lodash/isString';
import isObject from 'lodash/isObject';
import get from 'lodash/get';
import has from 'lodash/has';
import toLower from 'lodash/toLower';
import size from 'lodash/size';
import omit from 'lodash/omit';

import { registerMethod } from 'utils/methods';

import { Namespace, Models } from 'metadata';

import { getAccessFor } from 'utils/access';

import { setPassword, checkPassword, generateStampedLoginToken, hashStampedToken as _hashStampedToken, hashLoginToken } from 'utils/password';
import { randomPassword } from 'utils';

import renderTemplate from 'utils/renderTemplate';

const injectRequestInformation = (userAgent, session = {}) => {
	const r = useragent.parse(userAgent);

	return {
		...session,
		browser: r.family,
		browserVersion: r.toVersion(),
		os: r.os.toString(),
		platform: r.device.family,
	};
};

export default () => {
	/* Login using email and password
		@param user
		@param password
		@param ns
		@param geolocation
		@param resolution
		@param ip
		@param userAgent
	*/
	registerMethod('auth:login', async request => {
		// eslint-disable-next-line camelcase
		const { user, password, geolocation, userAgent, ip, password_SHA256 } = request;

		const accessLog = {
			_createdAt: new Date(),
			_updatedAt: new Date(),
			ip,
			login: user,
		};

		// If there is a geolocation store it with session
		if (isString(geolocation)) {
			const coords = JSON.parse(geolocation);
			accessLog.geolocation = [coords.lng, coords.lat];
		} else if (Namespace.trackUserGeolocation === true) {
			accessLog.reason = 'Geolocation required';
			injectRequestInformation(userAgent, accessLog);
			await Models.AccessFailedLog.insertOne(accessLog);

			return new Error('[internal-error] O Konecty exige que você habilite a geolocalização do seu navegador.');
		}

		const userRecord = await Models.User.findOne({ $or: [{ username: user }, { 'emails.address': user }] });

		if (userRecord == null) {
			accessLog.reason = `User not found [${user}]`;
			injectRequestInformation(userAgent, accessLog);
			await Models.AccessFailedLog.insertOne(accessLog);

			return new Error('[internal-error] Usuário ou senha inválidos.');
		}

		// eslint-disable-next-line no-underscore-dangle
		accessLog._user = [
			{
				// eslint-disable-next-line no-underscore-dangle
				_id: userRecord._id,
				name: userRecord.name,
				group: userRecord.group,
			},
		];

		// eslint-disable-next-line camelcase
		const logged = await checkPassword(userRecord, { algorithm: 'sha-256', digest: password_SHA256 || password });

		if (logged.error != null) {
			accessLog.reason = logged.error.message;
			injectRequestInformation(userAgent, accessLog);
			await Models.AccessFailedLog.insertOne(accessLog);

			return new Error('Wrong user or password');
		}

		if (userRecord.active !== true) {
			accessLog.reason = `User inactive [${user}]`;
			injectRequestInformation(userAgent, accessLog);
			await Models.AccessFailedLog.insertOne(accessLog);
			return new Error('Inactive user');
		}

		const stampedToken = generateStampedLoginToken();
		const hashStampedToken = _hashStampedToken(stampedToken);

		const updateObj = {
			$set: {
				lastLogin: new Date(),
			},
			$push: {
				'services.resume.loginTokens': hashStampedToken,
			},
		};

		// eslint-disable-next-line no-underscore-dangle
		await Models.User.updateOne({ _id: userRecord._id }, updateObj);

		injectRequestInformation(userAgent, accessLog);
		if (Models.AccessLog != null) {
			await Models.AccessLog.insertOne(accessLog);
		}

		return {
			success: true,
			logged: true,
			token: hashStampedToken.hashedToken,
			user: {
				// eslint-disable-next-line no-underscore-dangle
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
	});

	/* Logout currently session
		@param authTokenId
	*/
	registerMethod('auth:logout', 'withUser', async function authLogout() {
		const updateObj = {
			$pull: {
				'services.resume.loginTokens': { hashedToken: this.hashedToken },
			},
		};

		// eslint-disable-next-line no-underscore-dangle
		await Models.User.updateOne({ _id: this.user._id }, updateObj);

		return { success: true };
	});

	/* Get information from current session
		@param authTokenId
	*/
	registerMethod('auth:info', 'withUser', function authInfo() {
		// If no namespace was found return error
		if (!Namespace) {
			return new Error('[internal-error] Namespace not found');
		}

		const response = {
			logged: true,
			user: {
				// eslint-disable-next-line no-underscore-dangle
				_id: this.user._id,
				access: this.user.access,
				admin: this.user.admin,
				email: get(this.user, 'emails.0.address'),
				group: this.user.group,
				locale: this.user.locale,
				login: this.user.username,
				name: this.user.name,
				namespace: {
					_id: Namespace.ns,
					...omit(Namespace, ['ns', 'parents', 'type']),
				},
				role: this.user.role,
			},
		};

		return response;
	});

	/* Verify if user is logged
		@param authTokenId
	*/
	registerMethod('auth:logged', 'withUser', () => true);

	/* Get publlic user info
		@param authTokenId
	*/
	registerMethod('auth:getUser', 'withUser', function authGetUser() {
		return {
			// eslint-disable-next-line no-underscore-dangle
			_id: this.user._id,
			access: this.user.access,
			admin: this.user.admin,
			emails: this.user.emails,
			group: this.user.group,
			locale: this.user.locale,
			username: this.user.username,
			name: this.user.name,
			role: this.user.role,
			lastLogin: this.user.lastLogin,
		};
	});

	/* Reset password
		@param user
		@param ns
		@param ip
		@param host
	*/
	registerMethod('auth:resetPassword', async request => {
		// Map body parameters
		const { user, host } = request;

		const userRecord = Models.User.findOne({ $and: [{ active: true }, { $or: [{ username: user }, { 'emails.address': user }] }] });

		if (!userRecord) {
			return new Error('[internal-error] Usuário não encontrado.');
		}

		const stampedToken = generateStampedLoginToken();
		const hashStampedToken = _hashStampedToken(stampedToken);

		const updateObj = {
			$set: {
				lastLogin: new Date(),
			},
			$push: {
				'services.resume.loginTokens': hashStampedToken,
			},
		};

		// eslint-disable-next-line no-underscore-dangle
		await Models.User.updateOne({ _id: userRecord._id }, updateObj);

		let expireAt = new Date();
		expireAt = new Date(expireAt.setMinutes(expireAt.getMinutes() + 360));

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
				url: `https://${host}/api/v1/auth/loginByUrl/${token}`,
			},
		};

		await Models.Message.insertOne(emailData);

		// Respond to reset
		return { success: true };
	});

	/* Set User password
		@param userId
		@param password
	*/
	registerMethod('auth:setPassword', 'withUser', async function authSetPassword(request) {
		// Map body parameters
		const { userId, password } = request;

		const access = getAccessFor('User', this.user);

		// If return is false no access was found then return 401 (Unauthorized)
		if (!isObject(access)) {
			return new Error('[internal-error] Permissão negada.');
		}

		const userRecord = await Models.User.findOne({ $or: [{ _id: userId }, { username: userId }, { 'emails.address': userId }] });

		if (!userRecord) {
			return new Error('[internal-error] Usuário não encontrado.');
		}

		// eslint-disable-next-line no-underscore-dangle
		if (this.user.admin !== true && this.user._id !== userRecord._id && access.changePassword !== true) {
			return new Error('[internal-error] Permissão negada.');
		}

		// eslint-disable-next-line no-underscore-dangle
		setPassword(userRecord._id, password);

		return { success: true };
	});

	/* Set a random password for User and send by email
	@param userIds
*/
	registerMethod('auth:setRandomPasswordAndSendByEmail', 'withUser', async function authSetRandomPasswordAndSendByEmail(request) {
		// Map body parameters
		const { userIds } = request;

		if (!(isArray(userIds) && every(userIds, isString))) {
			throw new Error('[internal-error] you must provide the user ids.');
		}

		const access = getAccessFor('User', this.user);

		// If return is false no access was found then return 401 (Unauthorized)
		if (!isObject(access)) {
			return new Error('[internal-error] Permissão negada.');
		}

		const userRecords = await Models.User.find({
			$or: [{ _id: { $in: userIds } }, { username: { $in: userIds } }, { 'emails.address': { $in: userIds } }],
		}).toArray();

		if (userRecords?.length === 0) {
			return new Error('[internal-error] Nenhum usuário encontrado.');
		}

		const errors = [];
		await Promise.all(
			userRecords.map(async userRecord => {
				if (!has(userRecord, 'emails.0.address')) {
					errors.push(new Error(`[internal-error] Usuário [${userRecord.username}] sem email definido.`));
					return;
				}

				// eslint-disable-next-line no-underscore-dangle
				if (this.user.admin !== true && this.user._id !== userRecord._id && access.changePassword !== true) {
					errors.push(new Error(`[internal-error] Permissão negada para alterar a senha do usuário [${userRecord.username}].`));
					return;
				}

				const password = randomPassword(6).toLowerCase();
				const data = {
					username: userRecord.username,
					password,
					name: userRecord.name,
				};

				// eslint-disable-next-line no-underscore-dangle
				await setPassword(userRecord._id, password);

				const html = renderTemplate('resetPassword', {
					password,
					data,
				});

				await Models.Message.insertOne({
					from: 'Konecty <support@konecty.com>',
					to: get(userRecord, 'emails.0.address'),
					subject: '[Konecty] Sua nova senha',
					body: html,
					type: 'Email',
					status: 'Send',
					discard: true,
				});
			}),
		);

		if (errors.length > 0) {
			return {
				success: false,
				errors,
			};
		}

		return { success: true };
	});

	/* Set geolocation for current session
		@param longitude
		@param latitude
		@param userAgent
		@param ip
	*/
	registerMethod('auth:setGeolocation', 'withUser', async function authSetGeolocation(request) {
		if (!Models.AccessLog) {
			return new Error('[internal-error] Models.AccessLog not defined.');
		}

		const { longitude, latitude, userAgent, ip } = request;

		if (!longitude || !latitude) {
			return new Error('[internal-error] Longitude or Latitude not defined');
		}

		const accessLog = {
			_createdAt: new Date(),
			_updatedAt: new Date(),
			ip,
			login: this.user.username,
			geolocation: [longitude, latitude],
			_user: [
				{
					// eslint-disable-next-line no-underscore-dangle
					_id: this.user._id,
					name: this.user.name,
					group: this.user.group,
				},
			],
		};

		injectRequestInformation(userAgent, accessLog);
		await Models.AccessLog.insertOne(accessLog);

		return {
			success: true,
		};
	});

	/* Login using email and password
		@param user
		@param password
		@param ns
		@param geolocation
		@param resolution
		@param ip
		@param userAgent
	*/
	registerMethod('auth:loginWithToken', async function authLoginWithToken(request) {
		if (this.user) {
			return null;
		}

		const { resume = '' } = request;

		this.hashedToken = resume;

		if (resume.length === 24) {
			this.hashedToken = toLower(resume);
		}

		if (size(resume) === 43) {
			this.hashedToken = hashLoginToken(resume);
		}

		const userRecord = await Models.User.findOne({ 'services.resume.loginTokens.hashedToken': this.hashedToken });
		// If no user was found return error
		if (!userRecord) {
			return {
				error: new Error('[403] [auth:loginWithToken] User not found using token.'),
			};
		}

		if (userRecord.active !== true) {
			return {
				error: new Error('[403] [auth:loginWithToken] User not found using token.'),
			};
		}

		// eslint-disable-next-line no-underscore-dangle
		this.setUserId(userRecord._id);

		return {
			success: true,
			logged: true,
			user: {
				// eslint-disable-next-line no-underscore-dangle
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
	});
};
