import get from 'lodash/get';

import { MetaObject } from '@imports/model/MetaObject';
import { DataDocument } from '@imports/types/data';
import { logger } from '@imports/utils/logger';
import { ClientSession, Filter, FindOneAndUpdateOptions, UpdateFilter } from 'mongodb';

const GENERATE_CODE_MAX_DEPTH = 1000;

export async function getNextCode(documentName: string, fieldName: string, dbSession?: ClientSession) {
	if (!fieldName) {
		fieldName = 'code';
	}

	const autoNumberCollection = MetaObject.Collections[`${documentName}.AutoNumber`];
	const documentCollection = MetaObject.Collections[documentName];

	// Mount query, sort, update, and options
	const query: Filter<DataDocument> = { _id: fieldName };

	const update: UpdateFilter<DataDocument<{}>> = {
		$inc: {
			next_val: 1,
		},
	};

	const options: FindOneAndUpdateOptions = {
		upsert: true,
		returnDocument: 'after',
		session: dbSession,
	};

	// Try to get next code
	try {
		const getNextCodeFunc = async (
			depth = 0,
		): Promise<{
			success: boolean;
			data?: number;
			errors?: { message: string }[];
		}> => {
			const autoNumberResult = await autoNumberCollection.findOneAndUpdate(query as any, update, options);
			const nextVal = get(autoNumberResult, 'next_val', 1);
			const existingCodes = await documentCollection.countDocuments({ [fieldName]: nextVal }, { session: dbSession });
			if (existingCodes === 0) {
				return {
					success: true,
					data: nextVal as number,
				};
			}

			if (depth > GENERATE_CODE_MAX_DEPTH) {
				return {
					success: false,
					errors: [
						{
							message: `Error creating new ${fieldName} value from ${documentName}: Timeout exceed!`,
						},
					],
				};
			}

			return getNextCodeFunc();
		};

		const result = await getNextCodeFunc();

		if (result.success === false) {
			logger.error(`Duplicated key found on ${documentName}.${fieldName}: ${result.data}`);
		}
		return result;
	} catch (e: any) {
		logger.error(e, `Error creating new ${fieldName} value from ${documentName}: ${e.message}`);
		return {
			success: false,
			errors: [
				{
					message: `Error creating new ${fieldName} value from ${documentName}: ${e.message}`,
				},
			],
		};
	}
}
