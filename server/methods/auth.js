import { Meteor } from 'meteor/meteor';
import { SSR } from 'meteor/meteorhacks:ssr';
import { Accounts } from 'meteor/accounts-base';
import { Random } from 'meteor/random';
import { check } from 'meteor/check';
import useragent from 'useragent';

import { isObject, get, has, isString } from 'lodash';
import toLower from 'lodash/toLower';
import size from 'lodash/size';

import { getAccessFor } from '/imports/utils/accessUtils';
import { metaUtils } from '/imports/utils/konutils/metaUtils';
import { MetaObject, Models } from '/imports/model/MetaObject';

export const injectRequestInformation = function (userAgent, session) {
    
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

// eslint-disable-next-line no-undef
SSR.compileTemplate('resetPassword', Assets.getText('templates/email/resetPassword.html'));

/* Verify if user is logged
	@param authTokenId
*/
Meteor.registerMethod('auth:logged', 'withUser', () => true);

/* Get publlic user info
	@param authTokenId
*/
Meteor.registerMethod('auth:getUser', 'withUser', function () {
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

/* Set a random password for User and send by email
	@param userIds
*/
Meteor.registerMethod('auth:setRandomPasswordAndSendByEmail', 'withUser', function (request) {
	// Map body parameters
	const { userIds, host } = request;

	check(userIds, [String]);

	const access = getAccessFor('User', this.user);

	// If return is false no access was found then return 401 (Unauthorized)
	if (!isObject(access)) {
		return new Meteor.Error('internal-error', 'Permissão negada.');
	}

	let userRecords = Meteor.users.find({
		$or: [{ _id: { $in: userIds } }, { username: { $in: userIds } }, { 'emails.address': { $in: userIds } }],
	});

	userRecords = userRecords.fetch();

	if (userRecords.length === 0) {
		return new Meteor.Error('internal-error', 'Nenhum usuário encontrado.');
	}

	const { ns } = MetaObject.findOne({ _id: 'Namespace' });
	const errors = [];

	for (let userRecord of userRecords) {
		if (!has(userRecord, 'emails.0.address')) {
			errors.push(new Meteor.Error('internal-error', `Usuário [${userRecord.username}] sem email definido.`));
			continue;
		}

		if (this.user.admin !== true && this.user._id !== userRecord._id && access.changePassword !== true) {
			errors.push(new Meteor.Error('internal-error', `Permissão negada para alterar a senha do usuário [${userRecord.username}].`));
			continue;
		}

		// Create access token and save it on user record
		const stampedToken = Accounts._generateStampedLoginToken();
		const hashStampedToken = Accounts._hashStampedToken(stampedToken);
		const updateObj = {
			$set: {
				lastLogin: new Date(),
			},
			$push: {
				'services.resume.loginTokens': hashStampedToken,
			},
		};

		Meteor.users.update({ _id: userRecord._id }, updateObj);
		const token = encodeURIComponent(hashStampedToken.hashedToken);

		const loginUrl = `http://${host}/rest/auth/loginByUrl/${ns}/${token}`;
		const password = Random.id(6).toLowerCase();
		const data = {
			username: userRecord.username,
			password,
			name: userRecord.name,
			url: loginUrl,
		};

		Accounts.setPassword(userRecord._id, password);

		const html = SSR.render('resetPassword', {
			password,
			data,
		});

		Models['Message'].insert({
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
Meteor.registerMethod('auth:setGeolocation', 'withUser', function (request) {
	if (!Models.AccessLog) {
		return new Meteor.Error('internal-error', 'Models.AccessLog not defined.');
	}

	const { longitude, latitude, userAgent, ip } = request;

	if (!longitude || !latitude) {
		return new Meteor.Error('internal-error', 'Longitude or Latitude not defined');
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
	Models.AccessLog.insert(accessLog);

	return {
		success: true,
	};
});

Accounts.onCreateUser(function (options, user) {
	if (!user.code) {
		user.code = metaUtils.getNextCode('User', 'code');
	}
	return user;
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
Meteor.registerMethod('auth:loginWithToken', function (request) {
	if (this.user) {
		return;
	}

	let { resume = '' } = request;

	this.hashedToken = resume;

	if (resume.length === 24) {
		this.hashedToken = toLower(resume);
	}

	if (size(resume) === 43) {
		this.hashedToken = Accounts._hashLoginToken(resume);
	}

	const userRecord = Meteor.users.findOne({ 'services.resume.loginTokens.hashedToken': this.hashedToken });
	// If no user was found return error
	if (!userRecord) {
		return {
			error: new Meteor.Error(403, '[auth:loginWithToken] User not found using token.'),
		};
	}

	if (userRecord.active !== true) {
		return {
			error: new Meteor.Error(403, '[auth:loginWithToken] User not found using token.'),
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
