import { DocumentEvent } from '@imports/model/Document/DocumentEvents';
import { MetaObject } from '@imports/model/MetaObject';
import queueManager from '@imports/queue/QueueManager';
import getMissingParams from '@imports/utils/getMissingParams';
import { logger } from '@imports/utils/logger';
import { Engine } from 'json-rules-engine';
import { createEngine } from './jsonEngine';

type CustomRuleEvent = {
	name: string;
	type: string;
	params: DocumentEvent['event'];
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

	async sendEvent(metaName: string, operation: string, { data, original }: { data: object; original?: object }): Promise<void> {
		const eventData = { metaName, operation, data };

		const { events } = await this.jsonEngine.run(eventData);
		if (events.length === 0) return;

		await Promise.all(
			(events as CustomRuleEvent[]).map(async event => {
				logger.debug(`Triggered event ${event.name}`);

				switch (event.type) {
					case 'queue':
						return await this._sendQueueEvent(event, Object.assign({}, eventData, event.params.sendOriginal ? { original } : {}));
					default:
						logger.warn(`Unknown event type: ${event.type}`);
				}
			}),
		);
	}

	private async _sendQueueEvent(event: CustomRuleEvent, eventData: object) {
		if (event.params == null) return;

		const missingParams = getMissingParams(event.params, ['resource', 'queue']);
		if (missingParams.length > 0) {
			logger.warn(`Missing params for queue event: ${missingParams.join(', ')}`);
			return;
		}

		// Queue can be a string or a string array
		await Promise.all(
			Array()
				.concat(event.params.queue)
				.map(queueName => queueManager.sendMessage(event.params.resource, queueName, eventData)),
		);
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
