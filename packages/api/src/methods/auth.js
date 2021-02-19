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

import { registerMethod } from '@konecty/utils/methods';

import { Namespace, Models } from '@konecty/metadata';

import { getAccessFor } from '@konecty/utils/access';

import { setPassword, randomPassword, checkPassword, generateStampedLoginToken, hashStampedToken as _hashStampedToken, hashLoginToken } from '@konecty/utils/password';

import { renderTemplate } from '@konecty/utils/renderTemplate';

const injectRequestInformation = function (userAgent, session) {
	const r = useragent.parse(userAgent);

	session.browser = r.family;
	session.browserVersion = r.toVersion();
	session.os = r.os.toString();
	session.platform = r.device.family;

	if (isString(resolution)) {
		var resolution = JSON.parse(resolution);
		session.resolution = resolution;
	}

	return session;
};

const init = () => {
	/* Login using email and password
		@param user
		@param password
		@param ns
		@param geolocation
		@param resolution
		@param ip
		@param userAgent
	*/
	registerMethod('auth:login', async function (request) {
		let { user, password, geolocation, userAgent, ip, password_SHA256 } = request;

		const accessLog = {
			_createdAt: new Date(),
			_updatedAt: new Date(),
			ip,
			login: user,
		};

		// If there is a geolocation store it with session
		if (isString(geolocation)) {
			geolocation = JSON.parse(geolocation);
			accessLog.geolocation = [geolocation.lng, geolocation.lat];
		} else if (Namespace.trackUserGeolocation === true) {
			accessLog.reason = 'Geolocation required';
			injectRequestInformation(userAgent, accessLog);
			await Models.AccessFailedLog.insert(accessLog);

			return new Error('[internal-error] O Konecty exige que você habilite a geolocalização do seu navegador.');
		}

		const userRecord = Models.User.findOne({ $or: [{ username: user }, { 'emails.address': user }] });

		if (!userRecord) {
			accessLog.reason = `User not found [${user}]`;
			injectRequestInformation(userAgent, accessLog);
			await Models.AccessFailedLog.insert(accessLog);

			return new Error('[internal-error] Usuário ou senha inválidos.');
		}

		accessLog._user = [
			{
				_id: userRecord._id,
				name: userRecord.name,
				group: userRecord.group,
			},
		];

		let p = password_SHA256 || password;
		p = { algorithm: 'sha-256', digest: p };

		const logged = checkPassword(userRecord, p);

		if (logged.error) {
			accessLog.reason = logged.error.reason;
			injectRequestInformation(userAgent, accessLog);
			await Models.AccessFailedLog.insert(accessLog);

			return new Error('[internal-error] Usuário ou senha inválidos.');
		}

		if (userRecord.active !== true) {
			accessLog.reason = `User inactive [${user}]`;
			injectRequestInformation(userAgent, accessLog);
			await Models.AccessFailedLog.insert(accessLog);
			return new Error('[internal-error] Usuário inativo.', { bugsnag: false });
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

		await Models.User.update({ _id: userRecord._id }, updateObj);

		injectRequestInformation(userAgent, accessLog);
		if (Models.AccessLog != null) {
			await Models.AccessLog.insert(accessLog);
		}

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
	});

	/* Logout currently session
		@param authTokenId
	*/
	registerMethod('auth:logout', 'withUser', async function (request) {
		const updateObj = {
			$pull: {
				'services.resume.loginTokens': { hashedToken: this.hashedToken },
			},
		};

		await Models.User.update({ _id: this.user._id }, updateObj);

		return { success: true };
	});

	/* Get information from current session
		@param authTokenId
	*/
	registerMethod('auth:info', 'withUser', function (request) {
		// If no namespace was found return error
		if (!Namespace) {
			return new Error('[internal-error] Namespace not found');
		}

		const response = {
			logged: true,
			user: {
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
	registerMethod('auth:logged', 'withUser', request => true);

	/* Get publlic user info
		@param authTokenId
	*/
	registerMethod('auth:getUser', 'withUser', function (request) {
		return {
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
	registerMethod('auth:resetPassword', async function (request) {
		// Map body parameters
		const { user, ns, ip, host } = request;

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

		await Models.User.update({ _id: userRecord._id }, updateObj);

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
				url: `https://${host}/rest/auth/loginByUrl/${ns}/${token}`,
			},
		};

		await Models['Message'].insert(emailData);

		// Respond to reset
		return { success: true };
	});

	/* Set User password
		@param userId
		@param password
	*/
	registerMethod('auth:setPassword', 'withUser', async function (request) {
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

		if (this.user.admin !== true && this.user._id !== userRecord._id && access.changePassword !== true) {
			return new Error('[internal-error] Permissão negada.');
		}

		setPassword(userRecord._id, password);

		return { success: true };
	});

	/* Set a random password for User and send by email
	@param userIds
*/
	registerMethod('auth:setRandomPasswordAndSendByEmail', 'withUser', async function (request) {
		// Map body parameters
		const { userIds } = request;

		if (!(isArray(userIds) && every(userIds, isString))) {
			throw new Error('[internal-error] you must provide the user ids.')
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

		for (let userRecord of userRecords) {
			if (!has(userRecord, 'emails.0.address')) {
				errors.push(new Error(`[internal-error] Usuário [${userRecord.username}] sem email definido.`));
				continue;
			}

			if (this.user.admin !== true && this.user._id !== userRecord._id && access.changePassword !== true) {
				errors.push(new Error(`[internal-error] Permissão negada para alterar a senha do usuário [${userRecord.username}].`));
				continue;
			}

			const password = randomPassword(6).toLowerCase();
			const data = {
				username: userRecord.username,
				password,
				name: userRecord.name,
			};

			await setPassword(userRecord._id, password);

			const html = renderTemplate('resetPassword', {
				password,
				data,
			});

			await Models['Message'].insert({
				from: 'Konecty <support@konecty.com>',
				to: get(userRecord, 'emails.0.address'),
				subject: '[Konecty] Sua nova senha',
				body: html,
				type: 'Email',
				status: 'Send',
				discard: true,
			});
		}

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
	registerMethod('auth:setGeolocation', 'withUser', async function (request) {
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
					_id: this.user._id,
					name: this.user.name,
					group: this.user.group,
				},
			],
		};

		injectRequestInformation(userAgent, accessLog);
		await Models.AccessLog.insert(accessLog);

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
	registerMethod('auth:loginWithToken', async function (request) {
		if (this.user) {
			return;
		}

		let { resume = '' } = request;

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

		this.setUserId(userRecord._id);

		return {
			success: true,
			logged: true,
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
	});
};

export { init };
