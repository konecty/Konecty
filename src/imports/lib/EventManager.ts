import { DocumentEvent } from '@imports/model/Document/DocumentEvents';
import { MetaObject } from '@imports/model/MetaObject';
import queueManager from '@imports/queue/QueueManager';
import getMissingParams from '@imports/utils/getMissingParams';
import { logger } from '@imports/utils/logger';
import { Engine } from 'json-rules-engine';
import get from 'lodash/get';
import { createEngine } from './jsonEngine';

type CustomRuleEvent = {
	type: string;
	params: DocumentEvent['event'] & { name: string };
};

type SendEventParams = {
	data: object;
	original?: object;
	full?: object;
};

class EventManager {
	private jsonEngine!: Engine;

	rebuildEvents() {
		logger.info('[konevents] Rebuilding events');
		const allEvents: DocumentEvent[] = [];

		for (const metaName in MetaObject.Meta) {
			const document = MetaObject.Meta[metaName];
			if (document.events == null) continue;

			const parsedEvents = document.events.map(event => addMetaConditionToEvent(event, metaName));
			allEvents.push(...parsedEvents);
		}

		this.jsonEngine = createEngine(allEvents);
	}

	async sendEvent(metaName: string, operation: string, { data, original, full }: SendEventParams): Promise<void> {
		const commonEventData = { metaName, operation, data, original, full };

		const { events } = await this.jsonEngine.run(commonEventData);
		if (events.length === 0) return;

		await Promise.all(
			(events as CustomRuleEvent[]).map(async event => {
				logger.debug(`Triggered event ${event.params.name}`);
				const eventData = Object.assign({}, { metaName, operation, data }, event.params.sendOriginal ? { original } : null, event.params.sendFull ? { full } : null);

				switch (event.type) {
					case 'queue':
						return await this._sendQueueEvent(event, eventData);
					case 'webhook':
						return await this._sendWebhookEvent(event, eventData);
					default:
						logger.warn(`Unknown event type: ${event.type}`);
				}
			}),
		);
	}

	private async _sendQueueEvent(event: CustomRuleEvent, eventData: object) {
		if (event.params == null || event.params.type !== 'queue') return;

		const missingParams = getMissingParams(event.params, ['resource', 'queue']);
		if (missingParams.length > 0) {
			logger.warn(`Missing params for queue event: ${missingParams.join(', ')}`);
			return;
		}

		// Queue can be a string or a string array
		await Promise.all(
			// eslint-disable-next-line @typescript-eslint/no-array-constructor
			Array()
				.concat(event.params.queue)
				.map(queueName => queueManager.sendMessage(get(event.params, 'resource', ''), queueName, eventData, event.params)),
		);
	}

	private async _sendWebhookEvent(event: CustomRuleEvent, eventData: object) {
		if (event.params == null || event.params.type !== 'webhook') return;

		const missingParams = getMissingParams(event.params, ['url']);
		if (missingParams.length > 0) {
			logger.warn(`Missing params for webhook event: ${missingParams.join(', ')}`);
			return;
		}

		try {
			const hasBody = ['GET', 'HEAD'].includes(event.params.method ?? 'GET') === false;
			await fetch(event.params.url, {
				method: event.params.method ?? 'GET',
				headers: event.params.headers ?? {},
				body: hasBody ? JSON.stringify(eventData) : undefined,
			});
		} catch (e) {
			logger.error(e, `Error sending webhook event: ${(e as Error).message}`);
		}
	}
}

function addMetaConditionToEvent(eventCfg: DocumentEvent, metaName: string) {
	return {
		name: eventCfg.name ?? `${eventCfg.event.type}:${metaName}`,
		...eventCfg,
		conditions: {
			all: [{ fact: 'metaName', operator: 'equal', value: metaName }, { ...eventCfg.conditions }],
		},
	};
}

const eventManager = new EventManager();

export default eventManager;
