import app from './app';
import { logger } from '@imports/utils/logger';

if (process.env.NODE_ENV !== 'development') {
	process.on('uncaughtException', error => {
		logger.error(error, `uncaughtException ${error.message}`);
	});
}
app();
