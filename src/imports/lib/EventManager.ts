import { DocumentEvent } from '@imports/model/Document/DocumentEvents';
import { MetaObject } from '@imports/model/MetaObject';
import queueManager from '@imports/queue/QueueManager';
import getMissingParams from '@imports/utils/getMissingParams';
import { logger } from '@imports/utils/logger';
import { Engine, Event as JsonRulesEvent } from 'json-rules-engine';
import { createEngine } from './jsonEngine';

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

	async sendEvent(metaName: string, operation: string, data: object): Promise<void> {
		const result = await this.jsonEngine.run({ metaName, operation, data });
		if (result.events.length === 0) return;

		const eventData = { metaName, operation, data };

		await Promise.all(
			result.events.map(async event => {
				switch (event.type) {
					case 'queue':
						return await this._sendQueueEvent(event, eventData);
					default:
						logger.warn(`Unknown event type: ${event.type}`);
				}
			}),
		);
	}

	private async _sendQueueEvent(event: JsonRulesEvent, eventData: object) {
		if (event.params == null) return;

		const missingParams = getMissingParams(event.params, ['resource', 'queue']);
		if (missingParams.length > 0) {
			logger.warn(`Missing params for queue event: ${missingParams.join(', ')}`);
			return;
		}

		await queueManager.sendMessage(event.params.resource, event.params.queue, eventData);
	}
}

function addMetaConditionToEvent(eventCfg: DocumentEvent, metaName: string) {
	return {
		name: `${eventCfg.event.type}:${metaName}`,
		...eventCfg,
		conditions: {
			all: [{ fact: 'metaName', operator: 'equal', value: metaName }, { ...eventCfg.conditions }],
		},
	};
}

const eventManager = new EventManager();

export default eventManager;
