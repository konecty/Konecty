import { errorReturn, successReturn } from '@imports/utils/return';
import { Channel, connect, Connection } from 'amqplib';
import { QueueResource } from './QueueResource';

export class RabbitMQResource extends QueueResource {
	private connection: Connection | null = null;
	private channel: Channel | null = null;

	async connect(url: string): Promise<void> {
		try {
			this.connection = await connect(url);
			this.channel = await this.connection.createChannel();

			// Handle connection events
			this.connection.on('error', err => {
				this.logger.error(err, '[konqueue] RabbitMQ connection error');
			});

			this.connection.on('close', () => {
				this.logger.warn('[konqueue] RabbitMQ connection closed');
			});

			this.logger.info('[konqueue] Connected to RabbitMQ');
		} catch (error) {
			await this.handleError(error as Error, 'connect');
		}
	}

	async disconnect(): Promise<void> {
		try {
			await this.channel?.close();
			await this.connection?.close();
			this.channel = null;
			this.connection = null;
			this.logger.info('[konqueue] Disconnected from RabbitMQ');
		} catch (error) {
			await this.handleError(error as Error, 'disconnect');
		}
	}

	async createQueue(name: string, driverParams?: Record<string, any>) {
		await this.channel?.assertQueue(name, driverParams);
	}

	async sendMessage(queue: string, message: unknown) {
		const strMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);
		const success = this.channel?.sendToQueue(queue, Buffer.from(strMessage), { appId: 'konecty' });

		return success ? successReturn('Message sent') : errorReturn('Failed to send message');
	}
}
