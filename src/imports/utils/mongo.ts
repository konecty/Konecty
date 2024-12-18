import { db } from '@imports/database';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import { MongoServerError, ObjectId } from 'mongodb';
import { logger } from './logger';

export function convertObjectIds<T>(
	records: T,
): T extends ObjectId
	? string
	: T extends (infer U)[]
		? U[]
		: T extends object
			? { [K in keyof T]: T[K] extends ObjectId ? string : T[K] extends object | object[] ? ReturnType<typeof convertObjectIds<T[K]>> : T[K] }
			: T {
	if (isArray(records)) {
		return records.map(item => convertObjectIds(item)) as any;
	}

	if (isObject(records)) {
		if (records instanceof ObjectId) {
			return records.toString() as any;
		}

		return Object.keys(records).reduce((result, key) => {
			const k = key as keyof T;
			result[k] = convertObjectIds(records[k]);
			return result;
		}, {} as any);
	}

	return records as any;
}

export async function isReplicaSet() {
	try {
		const status = await db.admin().replSetGetStatus();
		return status != null;
	} catch (error) {
		if ((error as MongoServerError).codeName === 'NoReplicationEnabled') {
			return false;
		}
		logger.error('Erro ao verificar status do replica set:', error);
		return false;
	}
}
