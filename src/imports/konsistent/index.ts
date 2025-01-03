import { MetaObject } from '@imports/model/MetaObject';

import getMissingParams from '@imports/utils/getMissingParams';
import { logger } from '../utils/logger';

type RunningKonsistent = {
	isQueueEnabled: boolean;
	queue?: {
		resource: string | undefined;
		name: string | undefined;
	};
};

export const Konsistent: RunningKonsistent = {
	isQueueEnabled: false,
};

export async function setupKonsistent() {
	const usingExternalKonsistent = MetaObject.Namespace.plan?.useExternalKonsistent;
	logger.info(`Using external Konsistent? ${usingExternalKonsistent}`);

	if (usingExternalKonsistent) {
		Konsistent.isQueueEnabled = getMissingParams(MetaObject.Namespace.QueueConfig, ['konsistent.0', 'konsistent.1']).length === 0;
		Konsistent.queue = {
			resource: MetaObject.Namespace.QueueConfig?.konsistent?.[0],
			name: MetaObject.Namespace.QueueConfig?.konsistent?.[1],
		};
	}

	if (usingExternalKonsistent && !Konsistent.isQueueEnabled) {
		logger.warn('[konsistent] is set to external but no config found');
	}
}
