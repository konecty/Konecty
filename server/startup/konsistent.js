import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

import { Konsistent } from '/imports/konsistent';
import { logger } from '/imports/utils/logger';

Accounts.config({ forbidClientAccountCreation: true });

Meteor.startup(function () {
	if (/true|1|enabled/i.test(process.env.DISABLE_KONSISTENT)) {
		logger.warn('[konsistent] Konsistent is disabled');
		return;
	}
	logger.info('[konsistent] Starting up');
	Konsistent.start();
});
