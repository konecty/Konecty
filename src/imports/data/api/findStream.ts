import { logger } from '@imports/utils/logger';
import { hasSecondaryNodes } from '@imports/utils/mongo';

import { buildFindQuery, BuildFindQueryParams } from './findUtils';
import { ApplyDateToStringTransform, ApplyFieldPermissionsTransform, ObjectToJsonTransform } from './streamTransforms';
import { KonectyResultError, KonectyResultSuccess } from '@imports/types/result';
import { Span } from '@opentelemetry/api';
import { Readable } from 'node:stream';
import { NANOSECONDS_TO_MILLISECONDS, STREAM_BATCH_SIZE, STREAM_MAX_TIME_MS } from './streamConstants';

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

		// Determine read preference: use secondary if available, fallback to secondaryPreferred
		// This ensures we use secondary nodes when possible but don't fail when they're unavailable
		// See ADR-0005 for detailed rationale
		const hasSecondaries = await hasSecondaryNodes();
		const readPreference = hasSecondaries ? 'secondary' : 'secondaryPreferred';

		tracingSpan?.addEvent(`Creating MongoDB cursor stream with ${readPreference} read preference`, {
			hasSecondaries: String(hasSecondaries),
		});

		const cursor = collection.aggregate(aggregateStages, {
			allowDiskUse: true,
			readPreference,
			batchSize: STREAM_BATCH_SIZE,
			maxTimeMS: STREAM_MAX_TIME_MS,
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
		// Also uses secondary nodes (or secondaryPreferred fallback) to maintain consistency
		if (getTotal === true) {
			tracingSpan?.addEvent(`Calculating total with ${readPreference} read preference`);
			// For pivot tables, we need the total synchronously, so await it
			try {
				const total = await collection.countDocuments(query, {
					readPreference,
					maxTimeMS: STREAM_MAX_TIME_MS,
				});
				result.total = total;
				logger.info(`[findStream] Total documents matching query: ${total}`);
			} catch (error) {
				logger.error(error as Error, 'Error calculating total');
				// Don't fail the request if total calculation fails
			}
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

