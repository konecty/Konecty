import { KonectyResult } from '@imports/types/result';
import { logger } from '@imports/utils/logger';

export abstract class QueueResource {
	// Config to handle casual connection errors, tolerating only MAX_ATTEMPTS in ATTEMPTS_TIMEFRAME_SEC to prevent infinite loops
	// The delay ATTEMPT_DELAY_MS increases exponentially and reset after the timeframe
	private attempt: number = 1;
	private MAX_ATTEMPTS: number = 10;
	private ATTEMPTS_TIMEFRAME_SEC: number = 40;
	private ATTEMPT_DELAY_MS: number = 500;
	private ATTEMPT_TIMEOUT: NodeJS.Timeout | null = null;

	protected logger = logger;

	abstract connect(url: string): Promise<void>;
	abstract disconnect(): Promise<void>;

	abstract createQueue(name: string, driverParams?: Record<string, any>): Promise<void>;

	abstract sendMessage(queue: string, message: unknown, retries: number, headers?: Record<string, any>): Promise<KonectyResult>;

	protected async handleError(error: Error, context: string): Promise<never> {
		this.logger.error(error, `Queue error in ${context}`);
		throw error;
	}

	protected async handleConnectionError(error: Error, retryCb: () => Promise<void>): Promise<void> {
		this.logger.error(error, 'Queue connection error');
		if (this.attempt > this.MAX_ATTEMPTS) {
			this.logger.error('Max attempts reached, stopping');
			this.ATTEMPT_TIMEOUT && clearTimeout(this.ATTEMPT_TIMEOUT);
			this.ATTEMPT_TIMEOUT = null;
			return;
		}

		if (this.attempt === 0) {
			this.ATTEMPT_TIMEOUT = setTimeout(() => {
				this.attempt = 0;
				this.ATTEMPT_DELAY_MS = 500;
			}, this.ATTEMPTS_TIMEFRAME_SEC * 1000);
		}

		this.attempt++;
		this.ATTEMPT_DELAY_MS *= 1.5;
		await new Promise(resolve => setTimeout(resolve, this.ATTEMPT_DELAY_MS));
		await retryCb();
	}
}
