import { ClientSession, MongoServerError } from 'mongodb';
import { logger } from './logger';

const ERROR_CODES = ['TemporarilyUnavailableException', 'WriteConflictException', 'WriteConflict'];

/**
 * Retries a MongoDB transaction after it encounters a write conflict error.
 * https://stackoverflow.com/a/78659965/11068174
 *
 * @param fn - The function to retry.
 * @param retries - The number of retries to attempt.
 * @returns The result of the function.
 */
export async function retryMongoTransaction<T extends (isRetry: boolean) => Promise<any>>(fn: T, retries: number = 13) {
	let lastError: Error | undefined;
	let isRetry = false;

	while (retries-- > 0) {
		try {
			return await fn(isRetry);
		} catch (error) {
			isRetry = true;
			lastError = error as Error;
			const mongoError = error as MongoServerError;
			if (mongoError.type === 'MongoServerError') {
				logger.debug(`MongoServerError ${mongoError.message} - ${mongoError.codeName}`);
			}
			if (ERROR_CODES.includes(mongoError.codeName ?? '')) {
				logger.debug(`${mongoError.codeName}, retrying transaction ${retries}x - ${lastError.message}`);
				await new Promise(resolve => setTimeout(resolve, 1000));
				continue;
			}

			throw error;
		}
	}

	throw lastError;
}

/**
 * Handles error during a transaction. If it is a expected transaction error, throw it so it can be retried, otherwise do nothing.
 * If a session is provided, it will be aborted.
 * @param error - The error to handle.
 * @param session - The session to abort.
 */
export async function handleTransactionError(error: unknown, session?: ClientSession) {
	await session?.abortTransaction();

	if (ERROR_CODES.includes((error as MongoServerError).codeName ?? '')) {
		logger.error(`handleTransaction ${(error as MongoServerError).codeName}`);
		throw error;
	}
}
