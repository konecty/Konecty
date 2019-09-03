import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { DateTime } from 'luxon';
import isDate from 'lodash/isDate';

import RED from 'node-red';

import storageModule from './storage';
import { find, save } from './storage/mongodb';

const ensureLoggedIn = next => (req, res) => {
	const authTokenId = sessionUtils.getAuthTokenIdFromReq(req);
	const user = Meteor.call('auth:getUser', {
		authTokenId,
		dontSetLastLogin: true
	});

	if (user === 401) {
		return res.redirect(`/login?redirectURL=${req.originalUrl}`);
	}

	const time = 21600000; // 6h

	if (!user.lastLogin || !isDate(user.lastLogin) || Date.now() - user.lastLogin.getTime() > time) {
		Meteor.call('auth:logout', { authTokenId: sessionUtils.getAuthTokenIdFromReq(req) });
		return res.redirect(`/login?redirectURL=${req.originalUrl}`);
	}

	const { admin } = user;

	if (admin === true) {
		return next(req, res);
	}
	return res.redirect('/');
};

const setupNodered = async () => {
	if (process.env.DISABLE_FLOWS === "true") {
		return;
	}

	const flows = await find('flows', '/', []);

	const { flows: flowsConfig, ns } = MetaObject.findOne({ _id: 'Namespace' });
	if (!flowsConfig || !Object.keys(flowsConfig).length) {
		return;
	}

	const configNode = flows.find(({ id }) => id === 'konecty-embedded-server');

	if (configNode == null) {
		const { user } = flowsConfig;
		const stampedToken = {
			...Accounts._generateStampedLoginToken(),
			when: DateTime.local()
				.plus({ years: 10 })
				.toJSDate()
		};

		const hashStampedToken = Accounts._hashStampedToken(stampedToken);

		Meteor.users.update(
			{ _id: user._id },
			{
				$push: {
					'services.resume.loginTokens': hashStampedToken
				}
			}
		);

		const { hashedToken } = hashStampedToken;
		flows.push({
			id: 'konecty-embedded-server',
			type: 'konecty-server',
			z: '',
			name: `Konecty ${ns}`,
			key: hashedToken,
			host: process.env.ROOT_URL
		});
		save('flows', '/', flows);
	}

	const settings = {
		httpAdminRoot: '/flows',
		httpNodeRoot: '/api',
		storageModule,
		functionGlobalContext: {}
	};
	RED.init(WebApp.httpServer, settings);
	WebApp.connectHandlers.use(settings.httpAdminRoot, ensureLoggedIn(RED.httpAdmin));
	WebApp.connectHandlers.use(settings.httpNodeRoot, RED.httpNode);

	await RED.start();
};

Meteor.startup(() => {
	setupNodered();
});
