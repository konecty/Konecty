

import { MetaObject } from '@imports/model/MetaObject';

import { logger } from '../utils/logger';

export async function setupKonsistent() {
	logger.info(`Using external Konsistent? ${Boolean(MetaObject.Namespace.plan?.useExternalKonsistent)}`);
}



