import { logger } from '../utils/logger';

type ShutdownHandler = () => Promise<void> | void;

interface ShutdownOptions {
	timeout?: number;
	signal: NodeJS.Signals;
}

export default class ShutdownManager {
	private static handlers: ShutdownHandler[] = [];
	private static isShuttingDown = false;
	private static readonly DEFAULT_TIMEOUT = 10_000;

	static addHandler(handler: ShutdownHandler): void {
		ShutdownManager.handlers.push(handler);
	}

	static async executeShutdown(options: ShutdownOptions): Promise<void> {
		if (ShutdownManager.isShuttingDown) {
			return;
		}

		ShutdownManager.isShuttingDown = true;
		logger.info(`Shutdown initiated by ${options.signal}`);

		const timeout = options.timeout ?? ShutdownManager.DEFAULT_TIMEOUT;
		const timeoutPromise = new Promise(resolve => setTimeout(resolve, timeout));

		try {
			await Promise.race([
				Promise.all(
					ShutdownManager.handlers.map(async function execShutdownHandler(handler) {
						try {
							return await handler();
						} catch (error) {
							logger.error(error, 'Error executing shutdown handler');
							return null;
						}
					}),
				),
				timeoutPromise,
			]);

			logger.info('Shutdown completed');
		} catch (error) {
			logger.error(error, 'Error during shutdown');
		} finally {
			process.exit(0);
		}
	}

	static initialize(timeout?: number): void {
		const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

		signals.forEach(signal => {
			process.on(signal, () => {
				ShutdownManager.executeShutdown({ signal, timeout });
			});
		});

		process.on('exit', code => {
			logger.info(`Process exit with code: ${code}`);
		});
	}
}
