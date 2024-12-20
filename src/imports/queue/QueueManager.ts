import { createEngine } from '@imports/lib/jsonEngine';
import { MetaObject } from '@imports/model/MetaObject';
import { QueueConfig, QueueResourceConfig, QueueRuleConfig } from '@imports/model/Namespace/QueueConfig';
import { logger } from '@imports/utils/logger';
import Bluebird from 'bluebird';
import { Engine } from 'json-rules-engine';
import { QueueResource } from './QueueResource';
import { RabbitMQResource } from './RabbitMQResource';

class QueueManagerClass {
	private resources: Record<string, QueueResource> = {};
	private rules: QueueRuleConfig[] = [];

	private jsonEngine!: Engine;

	async init() {
		if (MetaObject.Namespace.QueueConfig == null) {
			logger.debug('[QueueManager] No queue config found');
			return;
		}

		const resources = MetaObject.Namespace.QueueConfig.resources;
		this.rules = MetaObject.Namespace.QueueConfig.rules;

		if (resources == null || Object.keys(resources).length === 0 || this.rules == null || this.rules.length === 0) {
			logger.debug('[QueueManager] No queue config found');
			return;
		}

		await this.startResources(resources);
		this.jsonEngine = createEngine(this.rules);
	}

	private async startResources(resources: QueueConfig['resources']) {
		const self = this;

		await Promise.all(
			Object.entries(resources).map(async ([resourceName, resourceConfig]) => {
				try {
					const resource = createResourcefromType(resourceConfig.type);
					await resource.connect(resourceConfig.url);

					await Promise.all(resourceConfig.queues.map(async queue => resource.createQueue(queue.name, queue.driverParams)));

					self.resources[resourceName] = resource;
				} catch (error) {
					logger.error(error, `Failed to connect to resource ${resourceName}`);
				}
			}),
		);
	}

	public async sendEvent(payload: { operation: string; data: object }) {
		const result = await this.jsonEngine.run(payload);
		if (result.events.length === 0) {
			return;
		}

		await Bluebird.map(result.events, async event => {
			if (event.params == null) {
				return;
			}

			const resource = this.resources[event.params.resource];
			if (resource == null) {
				logger.warn(`Resource ${event.params.resource} not found`);
				return;
			}

			const result = await resource.sendMessage(event.params.queue, JSON.stringify(payload));
			logger.info(result);
		});
	}
}

function createResourcefromType(type: QueueResourceConfig['type']) {
	switch (type) {
		case 'rabbitmq':
			return new RabbitMQResource();
		default:
			throw new Error(`Unknown resource type: ${type}`);
	}
}

export const QueueManager = new QueueManagerClass();
