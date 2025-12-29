import { logger } from '@imports/utils/logger';

import { buildFindQuery, BuildFindQueryParams } from './findUtils';
import { ApplyDateToStringTransform, ApplyFieldPermissionsTransform, ObjectToJsonTransform } from './streamTransforms';
import { KonectyResult, KonectyResultError, KonectyResultSuccess } from '@imports/types/result';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Span } from '@opentelemetry/api';
import { Readable } from 'node:stream';
import { DataDocument } from '@imports/types/data';
import { NANOSECONDS_TO_MILLISECONDS } from './streamConstants';

function buildStreamPipeline(
	mongoStream: Readable,
	accessConditions: Record<string, Function>,
	conditionsKeys: string[],
	transformDatesToString: boolean,
	tracingSpan?: Span,
): Readable {
	// Build pipeline step by step
	const streamAfterPermissions = conditionsKeys.length > 0
		? (() => {
				tracingSpan?.addEvent('Applying field permissions transform');
				const permissionsTransform = new ApplyFieldPermissionsTransform(accessConditions);
				return mongoStream.pipe(permissionsTransform);
			})()
		: mongoStream;

	const streamAfterDates = transformDatesToString
		? (() => {
				tracingSpan?.addEvent('Applying date to string transform');
				const dateTransform = new ApplyDateToStringTransform();
				return streamAfterPermissions.pipe(dateTransform);
			})()
		: streamAfterPermissions;

	// Convert objects to JSON strings for HTTP streaming
	// This transform converts from objectMode to string/buffer mode
	tracingSpan?.addEvent('Converting objects to JSON');
	const jsonTransform = new ObjectToJsonTransform();
	return streamAfterDates.pipe(jsonTransform);
}

export type FindStreamParams = BuildFindQueryParams & {
	getTotal?: boolean;
	transformDatesToString?: boolean;
};

export type FindStreamResult = KonectyResultSuccess<Readable> & {
	total?: number;
};

export default async function findStream({
	getTotal,
	transformDatesToString = true,
	tracingSpan,
	...params
}: FindStreamParams): Promise<FindStreamResult | KonectyResultError> {
	try {
		const startTime = process.hrtime();

		tracingSpan?.addEvent('Building find query');
		const queryResult = await buildFindQuery({ ...params, tracingSpan });
		if (queryResult.success === false) {
			return queryResult;
		}

		const { query, aggregateStages, accessConditions, conditionsKeys, collection } = queryResult.data;

		tracingSpan?.addEvent('Creating MongoDB cursor stream');
		const cursor = collection.aggregate(aggregateStages, {
			allowDiskUse: true,
			readPreference: 'secondaryPreferred',
		});
		const mongoStream = cursor.stream();

		const totalTime = process.hrtime(startTime);
		const log = `${totalTime[0]}s ${totalTime[1] / NANOSECONDS_TO_MILLISECONDS}ms => FindStream ${params.document}, filter: ${JSON.stringify(query)}`;
		logger.trace(log);

		// Create pipeline with Transform streams
		const stream = buildStreamPipeline(mongoStream, accessConditions, conditionsKeys, transformDatesToString, tracingSpan);

		const result: FindStreamResult = {
			success: true,
			data: stream,
		};

		// Calculate total in parallel if requested (doesn't block stream)
		if (getTotal === true) {
			tracingSpan?.addEvent('Calculating total');
			collection
				.countDocuments(query)
				.then(total => {
					result.total = total;
				})
				.catch((error: Error) => {
					logger.error(error, 'Error calculating total');
				});
		}

		return result;
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);
		logger.error(error, `Error executing findStream: ${error.message}`);

		return {
			success: false,
			errors: [
				{
					message: 'Oops something went wrong, please try again later... if this message persisits, please contact our support',
				},
			],
		};
	}
}

