import { logger } from '@imports/utils/logger';
import processReverseLookups from './processReverseLookups';
import * as References from './updateReferences';

import { DataDocument } from '@imports/types/data';
import { ClientSession, MongoServerError } from 'mongodb';

type Action = 'create' | 'update' | 'delete';

const logTimeSpent = (startTime: [number, number], message: string) => {
	const totalTime = process.hrtime(startTime);
	logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => ${message}`);
};

export default async function processIncomingChange(
	metaName: string,
	incomingChange: DataDocument,
	action: Action,
	user: object,
	changedProps: Record<string, any>,
	dbSession?: ClientSession,
) {
	let startTime = process.hrtime();

	try {
		if (action === 'update') {
			await References.updateLookups(metaName, incomingChange._id, changedProps, dbSession);
			logTimeSpent(startTime, `Updated lookup references for ${metaName}`);
		}

		await processReverseLookups(metaName, incomingChange._id, incomingChange, action);
		logTimeSpent(startTime, `Process'd reverse lookups for ${metaName}`);

		await References.updateRelations(metaName, action, incomingChange._id, incomingChange, dbSession);
		logTimeSpent(startTime, `Updated relation references for ${metaName}`);
	} catch (e) {
		if ((e as MongoServerError).codeName === 'NoSuchTransaction') {
			logger.trace('Transaction was already closed');
			return;
		}

		throw e;
	}
}
