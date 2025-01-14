import { KonectyResult } from '@imports/types/result';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Channel, connect, Connection } from 'amqplib';
import { QueueResource } from './QueueResource';

export class RabbitMQResource extends QueueResource {
	private connection: Connection | null = null;
	private channel: Channel | null = null;
	private connectionUrl: string = '';

	async connect(url: string): Promise<void> {
		try {
			this.connectionUrl = url;
			this.connection = await connect(url);
			this.channel = await this.connection.createChannel();

			// Handle connection events
			this.connection.on('error', err => {
				this.handleConnectionError(err, () => this.connect(url));
			});

			this.logger.info('Connected to RabbitMQ');
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
			this.logger.info('Disconnected from RabbitMQ');
		} catch (error) {
			await this.handleError(error as Error, 'disconnect');
		}
	}

	async createQueue(name: string, driverParams?: Record<string, any>) {
		await this.channel?.assertQueue(name, driverParams);
	}

	async sendMessage(queue: string, message: unknown, retries: number = 0): Promise<KonectyResult> {
		try {
			const strMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);
			const success = this.channel?.sendToQueue(queue, Buffer.from(strMessage), { appId: 'konecty', persistent: true, deliveryMode: 2 });

			return success ? successReturn('Message sent') : errorReturn('Failed to send message');
		} catch (error) {
			if (retries > 2) {
				await this.handleError(error as Error, 'sendMessage');
				return errorReturn('Failed to send message');
			}

			await this.disconnect();
			await this.handleConnectionError(error as Error, () => this.connect(this.connectionUrl));
			return this.sendMessage(queue, message, retries + 1);
		}
	}
}
