import get from 'lodash/get';

import { MetaObject } from '@imports/model/MetaObject';
import { logger } from '../../utils/logger';
import { Filter } from 'mongodb';

const GENERATE_CODE_MAX_DEPTH = 1000;

export async function getNextCode(documentName: string, fieldName: string) {
	if (!fieldName) {
		fieldName = 'code';
	}

	const autoNumberCollection = MetaObject.Collections[`${documentName}.AutoNumber`];
	const documentCollection = MetaObject.Collections[documentName];

	// Mount query, sort, update, and options
	const query: Filter<{ _id: string }> = { _id: fieldName };

	const update = {
		$inc: {
			next_val: 1,
		},
	};

	const options = {
		upsert: true,
		returnNewDocument: true,
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
			const existingCodes = await documentCollection.countDocuments({ [fieldName]: nextVal });
			if (existingCodes === 0) {
				return {
					success: true,
					data: nextVal,
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
