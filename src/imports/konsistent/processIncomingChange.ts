import { logger } from '@imports/utils/logger';
import createHistory from './createHistory';
import processReverseLookups from './processReverseLookups';
import * as References from './updateReferences';

import { DataDocument } from '@imports/types/data';

type Action = 'create' | 'update' | 'delete';

const logTimeSpent = (startTime: [number, number], message: string) => {
	const totalTime = process.hrtime(startTime);
	logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => ${message}`);
};

export default async function processIncomingChange(metaName: string, incomingChange: DataDocument, action: Action, user: object, changedProps: Record<string, any>) {
	try {
		let startTime = process.hrtime();

		if (action === 'update') {
			await References.updateLookups(metaName, incomingChange._id, changedProps);
			logTimeSpent(startTime, `Updated lookup references for ${metaName}`);
		}

		await processReverseLookups(metaName, incomingChange._id, incomingChange, action);
		logTimeSpent(startTime, `Process'd reverse lookups for ${metaName}`);

		await References.updateRelations(metaName, action, incomingChange._id, incomingChange);
		logTimeSpent(startTime, `Updated relation references for ${metaName}`);

		await createHistory(metaName, action, incomingChange._id, incomingChange, user, new Date(), changedProps);
		logTimeSpent(startTime, `Created history for ${metaName}`);
	} catch (err) {
		const error = err as Error;
		logger.error(`Error processing incoming change for ${metaName}: ${error.message}`);
	}
}
