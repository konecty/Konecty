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
				this.logger.error(err, '[kueue] RabbitMQ connection error');
			});

			this.connection.on('close', () => {
				this.logger.warn('[kueue] RabbitMQ connection closed');
			});

			this.logger.info('[kueue] Connected to RabbitMQ');
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
			this.logger.info('[kueue] Disconnected from RabbitMQ');
		} catch (error) {
			await this.handleError(error as Error, 'disconnect');
		}
	}

	async createQueue(name: string, driverParams?: Record<string, any>) {
		await this.channel?.assertQueue(name, driverParams);
	}

	async sendMessage(queue: string, message: string) {
		const success = this.channel?.sendToQueue(queue, Buffer.from(message), { appId: 'konecty' });
		return success ? successReturn('Message sent') : errorReturn('Failed to send message');
	}
}
