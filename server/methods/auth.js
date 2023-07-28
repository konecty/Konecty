import { Meteor } from 'meteor/meteor';
import { SSR } from 'meteor/meteorhacks:ssr';
import { Accounts } from 'meteor/accounts-base';
import useragent from 'useragent';

import get from 'lodash/get';
import isString from 'lodash/isString';
import toLower from 'lodash/toLower';
import size from 'lodash/size';

import { metaUtils } from '/imports/utils/konutils/metaUtils';
import { Models } from '/imports/model/MetaObject';

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
