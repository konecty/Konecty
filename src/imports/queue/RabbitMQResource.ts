import { KonectyResult } from '@imports/types/result';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Channel, connect, Connection } from 'amqplib';
import { QueueResource } from './QueueResource';

export class RabbitMQResource extends QueueResource {
	private connection: Connection | null = null;
	private channel: Channel | null = null;
	private connectionUrl: string = '';
	private exchanges: Set<string> = new Set();

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

	async createQueue(name: string, driverParams?: Record<string, any>): Promise<void> {
		try {
			if (!this.channel) {
				this.logger.error('Canal não está disponível');
				return;
			}

			// Criar a fila
			await this.channel.assertQueue(name, {
				durable: true,
				...driverParams,
			});

			// Se houver exchange definida, criar e vincular
			if (driverParams?.delayed === 'true' || driverParams?.delayed === true) {
				const exchangeName = driverParams.exchangeName || `${name}-delayed`;
				const exchangeType = driverParams.exchangeType || 'x-delayed-message';
				const routingKey = driverParams.routingKey || name;
				const exchangeOptions = driverParams.exchangeOptions || {
					durable: true,
					arguments: {
						'x-delayed-type': 'direct',
					},
				};

				// Criar exchange se não existir
				if (!this.exchanges.has(exchangeName)) {
					await this.channel.assertExchange(exchangeName, exchangeType, exchangeOptions);
				}

				await this.channel.bindQueue(name, exchangeName, routingKey);
			}

			this.logger.info(`Fila ${name} criada com sucesso`);
		} catch (error) {
			await this.handleError(error as Error, 'createQueue');
			this.logger.error(`Falha ao criar fila ${name}`);
		}
	}

	async sendMessage(queue: string, message: unknown, retries: number = 0, params?: Record<string, any>): Promise<KonectyResult> {
		try {
			const strMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);

			// Verificar se deve usar exchange com delay
			if (params?.delay != null) {
				const delay = parseInt(params.delay);

				if (isNaN(delay)) {
					this.logger.error(`Delay inválido: ${params.delay}`);
					return errorReturn('Delay inválido');
				}

				const routingKey = params.routingKey || queue;
				const exchangeName = params.exchangeName || `${queue}-delayed`;

				const paramsWithoutHeader = { ...params };
				delete paramsWithoutHeader?.headers;

				const publishOptions = {
					appId: 'konecty',
					persistent: true,
					deliveryMode: 2,
					headers: {
						'x-delay': delay,
						...(params?.headers || {}),
					},
					...(paramsWithoutHeader || {}),
				};

				const success = this.channel?.publish(exchangeName, routingKey, Buffer.from(strMessage), publishOptions);

				return success ? successReturn('Mensagem enviada para exchange') : errorReturn('Falha ao enviar mensagem para exchange');
			}

			// Comportamento padrão - enviar diretamente para a fila
			const success = this.channel?.sendToQueue(queue, Buffer.from(strMessage), {
				appId: 'konecty',
				persistent: true,
				deliveryMode: 2,
				...(params || {}),
			});

			return success ? successReturn('Message sent') : errorReturn('Failed to send message');
		} catch (error) {
			if (retries > 2) {
				await this.handleError(error as Error, 'sendMessage');
				return errorReturn('Failed to send message');
			}

			await this.disconnect();
			await this.handleConnectionError(error as Error, () => this.connect(this.connectionUrl));
			return this.sendMessage(queue, message, retries + 1, params);
		}
	}
}
