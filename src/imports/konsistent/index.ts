import { MetaObject } from '@imports/model/MetaObject';

import { db } from '@imports/database';
import { User } from '@imports/model/User';
import queueManager from '@imports/queue/QueueManager';
import { DataDocument } from '@imports/types/data';
import { LogDocument } from '@imports/types/Konsistent';
import { KonectyResult } from '@imports/types/result';
import getMissingParams from '@imports/utils/getMissingParams';
import objectsDiff from '@imports/utils/objectsDiff';
import { errorReturn, successReturn } from '@imports/utils/return';
import omit from 'lodash/omit';
import { ClientSession, Collection } from 'mongodb';
import { logger } from '../utils/logger';
import createHistory from './createHistory';
import processIncomingChange from './processIncomingChange';

type RunningKonsistent = {
	isQueueEnabled: boolean;
	queue?: {
		resource: string | undefined;
		name: string | undefined;
	};
	LogCollection: Collection<LogDocument>;
	processChangeSync: typeof processChangeSync;
	processChangeAsync: typeof processChangeAsync;
	writeAheadLog: typeof writeAheadLog;
	removeWAL: typeof removeWAL;
};

export type KonsistentWal = {
	_id: string;
	walId?: string;
};

export const Konsistent: RunningKonsistent = {
	isQueueEnabled: false,
	LogCollection: db.collection('Konsistent'),
	processChangeSync,
	processChangeAsync,
	writeAheadLog,
	removeWAL,
};

export async function setupKonsistent() {
	const usingExternalKonsistent = Boolean(MetaObject.Namespace.plan?.useExternalKonsistent);
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

async function processChangeAsync({ walId }: { walId?: string }) {
	if (MetaObject.Namespace.plan?.useExternalKonsistent === true && Konsistent.isQueueEnabled) {
		await queueManager.sendMessage(Konsistent.queue!.resource!, Konsistent.queue!.name!, {
			_id: walId,
		});
	}
}

async function processChangeSync(metaName: string, operation: string, user: object, data: { originalRecord?: DataDocument; newRecord: DataDocument }, dbSession?: ClientSession) {
	const changedProps = data.originalRecord
		? objectsDiff(data.originalRecord, omit(data.newRecord, ['_id', '_createdAt', '_createdBy', '_updatedAt', '_updatedBy']))
		: omit(data.newRecord, ['_id', '_createdAt', '_createdBy', '_updatedAt', '_updatedBy']);

	const historyResult = await createHistory(metaName, operation, data.newRecord._id, user, new Date(), changedProps, dbSession);
	if (historyResult === false) {
		throw new Error(`Error creating history`);
	}

	if (MetaObject.Namespace.plan?.useExternalKonsistent !== true) {
		logger.debug('Processing sync Konsistent');

		return processIncomingChange(metaName, data.newRecord, operation, user, changedProps, dbSession);
	}
}

async function writeAheadLog(metaName: string, operation: string, data: DataDocument, user: User, dbSession: ClientSession): Promise<KonectyResult<KonsistentWal>> {
	if (MetaObject.Namespace.plan?.useExternalKonsistent === true && Konsistent.isQueueEnabled) {
		try {
			const result = await Konsistent.LogCollection.insertOne(
				{
					_id: `${metaName}-${data._id}-${Date.now()}`,
					dataId: data._id,
					metaName: metaName,
					operation: operation,
					data: data,
					userId: user._id,
					ts: new Date(),
				},
				{ session: dbSession },
			);

			return result.insertedId ? successReturn({ _id: data._id, walId: result.insertedId }) : errorReturn('Error on writeAheadLog');
		} catch (e) {
			const message = `Error on writeAheadLog ${metaName}: ${(e as Error).message}`;
			logger.error(e, message);
			return errorReturn(message);
		}
	}

	return successReturn({ _id: data._id });
}

async function removeWAL(payload: Awaited<ReturnType<typeof writeAheadLog>>) {
	if (payload.success === false || payload.data === null) {
		return;
	}

	if (MetaObject.Namespace.plan?.useExternalKonsistent === true && Konsistent.isQueueEnabled) {
		await Konsistent.LogCollection.deleteOne({ _id: payload.data });
	}
}
