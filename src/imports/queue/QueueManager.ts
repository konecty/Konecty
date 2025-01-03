import ShutdownManager from '@imports/lib/ShutdownManager';
import { MetaObject } from '@imports/model/MetaObject';
import { QueueResourceConfig } from '@imports/model/Namespace/QueueConfig';
import { logger } from '@imports/utils/logger';
import { QueueResource } from './QueueResource';
import { RabbitMQResource } from './RabbitMQResource';

class QueueManager {
	private resources: Record<string, QueueResource> = {};

	private resourcesCfg: string | null = null;

	public async restartResources() {
		const resources = MetaObject.Namespace.QueueConfig?.resources;
		if (resources == null) return;

		const resourcesCfg = JSON.stringify(resources);
		if (this.resourcesCfg === resourcesCfg) return;

		this.resourcesCfg = resourcesCfg;

		logger.info('[QueueManager] (Re)Starting resources');

		if (Object.keys(this.resources).length > 0) {
			await Promise.all(Object.values(this.resources).map(resource => resource.disconnect()));
			this.resources = {};
		}

		await Promise.all(
			Object.entries(resources).map(async ([resourceName, resourceConfig]) => {
				try {
					const resource = createResourcefromType(resourceConfig.type);
					await resource.connect(resourceConfig.url);

					await Promise.all(resourceConfig.queues.map(async queue => resource.createQueue(queue.name, queue.driverParams)));

					this.resources[resourceName] = resource;
				} catch (error) {
					logger.error(error, `Failed to connect to resource ${resourceName}`);
				}
			}),
		);
	}

	public async sendMessage(resourceName: string, queueName: string, message: unknown) {
		const resource = this.resources[resourceName];
		if (resource == null) {
			logger.warn(`Resource ${resourceName} not found`);
			return;
		}

		logger.debug(`Sending queue message to ${resourceName} - ${queueName}`);
		return await resource.sendMessage(queueName, message);
	}

	public async disconnectAllResources() {
		await Promise.all(Object.values(this.resources).map(resource => resource.disconnect()));
		this.resources = {};
	}
}

function createResourcefromType(type: QueueResourceConfig['type']): QueueResource {
	switch (type) {
		case 'rabbitmq':
			return new RabbitMQResource();
		default:
			throw new Error(`Unknown resource type: ${type}`);
	}
}

const queueManager = new QueueManager();

ShutdownManager.addHandler(async () => queueManager.disconnectAllResources());

export default queueManager;
