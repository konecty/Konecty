import { loadMetaObjects } from '@imports/meta/loadMetaObjects';

import { serverStart } from './routes';
import { logger } from '@imports/utils/logger';
import { setupKonsistent } from '@imports/konsistent';
import { start as startSendMail } from '@imports/mailConsumer';
import { db } from '@imports/database';

if (process.env.NODE_ENV !== 'development') {
	process.on('uncaughtException', error => {
		logger.error(error, `uncaughtException ${error.message}`);
	});
}

void (async () => {
	try {
		await loadMetaObjects();
		if (/true|1|enabled/i.test(process.env.DISABLE_SENDMAIL ?? '') === true) {
			logger.warn('[sendmail] Sendmail is disabled');
		} else {
			logger.info('[sendmail] Starting up');
			startSendMail();
		}

		if (/true|1|enabled/i.test(process.env.DISABLE_KONSISTENT ?? '')) {
			logger.warn('[konsistent] Konsistent is disabled');
		} else {
			logger.info(`[konsistent]  === ${db.databaseName} === Starting up`);

			await setupKonsistent();
		}

		await serverStart();
	} catch (error) {
		logger.error(error, 'Error while starting up');
	}
})();
