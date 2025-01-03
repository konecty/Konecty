

import { MetaObject } from '@imports/model/MetaObject';

import { logger } from '../utils/logger';

export async function setupKonsistent() {
	logger.info(`Using external Konsistent? ${Boolean(MetaObject.Namespace.plan?.useExternalKonsistent)}`);
}

export const Konsistent = {
	queue: {
		resource: process.env.KONSISTENT_QUEUE_RESOURCE ?? 'rabbitmq_default',
		name: process.env.KONSISTENT_QUEUE_NAME ?? 'konsistent',
	},
};
