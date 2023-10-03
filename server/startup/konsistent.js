import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

import { setupKonsistent } from '/imports/konsistent';
import { logger } from '/imports/utils/logger';
import { start as startSendMail } from '/imports/mailConsumer';
import { db } from '/imports/database';

Accounts.config({ forbidClientAccountCreation: true });

Meteor.startup(function () {
	if (/true|1|enabled/i.test(process.env.DISABLE_SENDMAIL) === true) {
		logger.warn('[sendmail] Sendmail is disabled');
	} else {
		logger.info('[sendmail] Starting up');
		startSendMail();
	}

	if (/true|1|enabled/i.test(process.env.DISABLE_KONSISTENT)) {
		logger.warn('[konsistent] Konsistent is disabled');
	} else {
		logger.info(`[konsistent]  === ${db.databaseName} === Starting up`);

		setupKonsistent().catch(err => {
			logger.error(err, `[konsistent]  === ${db.databaseName} === Error while setting up`);
		});
	}
});
