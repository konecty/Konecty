import { loadMetaObjects } from '@imports/meta/loadMetaObjects';

import { db } from '@imports/database';
import startDatabaseVersioning from '@imports/database/versioning';
import { setupKonsistent } from '@imports/konsistent';
import ShutdownManager from '@imports/lib/ShutdownManager';
import { start as startSendMail } from '@imports/mailConsumer';
import { logger } from '@imports/utils/logger';
import { serverStart } from './routes';

const app = async () => {
	try {
		ShutdownManager.initialize();

		await loadMetaObjects();

		if (/true|1|enabled/i.test(process.env.DISABLE_SENDMAIL ?? '') === true) {
			logger.warn('[sendmail] Sendmail is disabled');
		} else {
			logger.info('[sendmail] Starting up');
			startSendMail();
		}

		if (/true|1|enabled/i.test(process.env.DISABLE_KONSISTENT ?? '')) {
			logger.warn(`[konsistent] === ${db.databaseName} === Konsistent is disabled`);
		} else {
			logger.info(`[konsistent]  === ${db.databaseName} === Starting up`);

			await setupKonsistent();
		}

		await startDatabaseVersioning();
		await serverStart();
	} catch (error) {
		logger.error(error, 'Error while starting up');
	}
};

export default app;
