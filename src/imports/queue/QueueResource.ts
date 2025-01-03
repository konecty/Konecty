import { KonectyResult } from '@imports/types/result';
import { logger } from '@imports/utils/logger';

export abstract class QueueResource {
	protected logger = logger;

	abstract connect(url: string): Promise<void>;
	abstract disconnect(): Promise<void>;

	abstract createQueue(name: string, driverParams?: Record<string, any>): Promise<void>;

	abstract sendMessage(queue: string, message: unknown): Promise<KonectyResult>;

	protected async handleError(error: Error, context: string): Promise<never> {
		this.logger.error(error, `Queue error in ${context}`);
		throw error;
	}
}
