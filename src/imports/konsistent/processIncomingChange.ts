import { logger } from '@imports/utils/logger';
import createHistory from './createHistory';
import processReverseLookups from './processReverseLookups';
import * as References from './updateReferences';

import omit from 'lodash/omit';
import { v4 as uuidV4 } from 'uuid';

type Action = 'create' | 'update' | 'delete';

const logTimeSpent = (startTime: [number, number], message: string) => {
	const totalTime = process.hrtime(startTime);
	logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => ${message}`);
};

export default async function processIncomingChange(metaName: string, incomingChange: object, action: Action, user: object) {
	try {
		const keysToIgnore = ['_updatedAt', '_createdAt', '_deletedAt', '_updatedBy', '_createdBy', '_deletedBy'];
		const dataId = uuidV4();

		let startTime = process.hrtime();

		if (action === 'update') {
			await References.updateLookups(metaName, dataId, incomingChange);
			logTimeSpent(startTime, `Updated lookup references for ${metaName}`);
		}

		await processReverseLookups(metaName, dataId, incomingChange, action);
		logTimeSpent(startTime, `Process'd reverse lookups for ${metaName}`);

		await References.updateRelations(metaName, action, dataId, incomingChange);
		logTimeSpent(startTime, `Updated relation references for ${metaName}`);

		await createHistory(metaName, action, dataId, omit(incomingChange, keysToIgnore), user, new Date(), '');
		logTimeSpent(startTime, `Created history for ${metaName}`);
	} catch (err) {
		const error = err as Error;
		logger.error(`Error processing incoming change for ${metaName}: ${error.message}`);
	}
}
