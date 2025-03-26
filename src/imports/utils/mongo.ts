import { db } from '@imports/database';
import { getLabel } from '@imports/meta/metaUtils';
import { MetaObject } from '@imports/model/MetaObject';
import { KonectyResult } from '@imports/types/result';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import { MongoServerError, ObjectId } from 'mongodb';
import { logger } from './logger';
import { errorReturn, successReturn } from './return';

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

interface DuplicateKeyError extends MongoServerError {
	keyPattern: Record<string, number>;
	keyValue: Record<string, any>;
}

export function isDuplicateKeyError(error: unknown): error is DuplicateKeyError {
	return error instanceof MongoServerError && error.code === 11000;
}

export function getDuplicateKeyField(error: DuplicateKeyError): string {
	const keyPattern = Object.keys(error.keyPattern)[0];
	const keyValue = error.keyValue[keyPattern];
	return `${keyPattern}: ${keyValue}`;
}

/**
 * Handles common MongoDB errors and converts them into a standardized KonectyResult object.
 * @param error - The error object to handle
 * @returns A KonectyResult object with appropriate error messages for common MongoDB errors
 */
export function handleCommonMongoError(error: unknown, documentName: string): KonectyResult {
	// If not a MongoDB error, return success
	if (!(error instanceof MongoServerError)) {
		return successReturn(null);
	}

	const mongoError = error as MongoServerError;

	try {
		switch (mongoError.code) {
			case 11000:
				const { name, fields } = getIndexInfo(mongoError.message);
				if (fields.length === 1) {
					const indexField = MetaObject.Meta[documentName].fields[fields[0]];
					if (indexField) {
						return errorReturn(`[${documentName}] O campo ${getLabel(indexField)} deve ser único mas já existe com esse valor.`);
					}
				}
				const metaIndexes = MetaObject.Meta[documentName].indexes;
				if (metaIndexes) {
					const index = Object.entries(metaIndexes).find(([idxKey, index]) => [index.options?.name, idxKey].includes(name));
					if (index) {
						const helpText = getLabel(index[1]) || `Validação de dados únicos violada: ${name}`;
						return errorReturn(`[${documentName}] ${helpText}`);
					}
				}
				return errorReturn(`[${documentName}] Validação de dados únicos violada: ${name}`);

			case 50:
				return errorReturn(`[${documentName}] Operação demorou mais que o esperado. Caso o problema persista, contate o suporte.`);

			case 91:
				return errorReturn(`[${documentName}] Servidor desligando. Caso o problema persista, contate o suporte.`);
		}
	} catch (error) {}

	logger.error(error, `Unexpected Mongo operation error: ${mongoError.message}`);
	return errorReturn(`[${documentName}] Erro ao processar a operação. Caso o problema persista, contate o suporte.`);
}

function getIndexInfo(errorMessage: string): { name: string; fields: string[] } {
	const indexRegex = /index:\s+(\w+)\s+dup key:\s+({[^}]+})/;
	const matches = errorMessage.match(indexRegex);

	if (!matches) {
		throw new Error('Could not parse index information from error message');
	}

	const [, indexName, dupKeyStr] = matches;
	const dupKey = JSON.parse(dupKeyStr.replace(/([{,]\s*)([^":\s]+):/g, '$1"$2":'));

	return {
		name: indexName,
		fields: Object.keys(dupKey),
	};
}
