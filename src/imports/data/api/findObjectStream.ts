import { logger } from '@imports/utils/logger';
import { hasSecondaryNodes } from '@imports/utils/mongo';

import { buildFindQuery, BuildFindQueryParams } from './findUtils';
import { ApplyDateToStringTransform, ApplyFieldPermissionsTransform } from './streamTransforms';
import { KonectyResultError, KonectyResultSuccess } from '@imports/types/result';
import { Span } from '@opentelemetry/api';
import { Readable } from 'node:stream';
import { NANOSECONDS_TO_MILLISECONDS, STREAM_BATCH_SIZE, STREAM_MAX_TIME_MS } from './streamConstants';

/**
 * Build a stream pipeline that returns objects (not JSON strings).
 * Used for export operations where we need objects for CSV/XLSX processing.
 */
function buildObjectStreamPipeline(
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

	// Stream remains in objectMode (unlike findStream which converts to JSON)
	return streamAfterDates;
}

export type FindObjectStreamParams = BuildFindQueryParams & {
	getTotal?: boolean;
	transformDatesToString?: boolean;
};

export type FindObjectStreamResult = KonectyResultSuccess<Readable> & {
	total?: number;
};

/**
 * Create a stream of objects with applied permissions and optional date transformations.
 * Unlike findStream, this stream stays in objectMode for export operations.
 */
export default async function findObjectStream({
	getTotal,
	transformDatesToString = true,
	tracingSpan,
	...params
}: FindObjectStreamParams): Promise<FindObjectStreamResult | KonectyResultError> {
	try {
		const startTime = process.hrtime();

		tracingSpan?.addEvent('Building find query');
		const queryResult = await buildFindQuery({ ...params, tracingSpan });
		if (queryResult.success === false) {
			return queryResult;
		}

		const { query, aggregateStages, accessConditions, conditionsKeys, collection } = queryResult.data;

		// Determine read preference: use secondary if available, fallback to secondaryPreferred
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
		const log = `${totalTime[0]}s ${totalTime[1] / NANOSECONDS_TO_MILLISECONDS}ms => FindObjectStream ${params.document}, filter: ${JSON.stringify(query)}`;
		logger.trace(log);

		// Create pipeline with Transform streams (stays in objectMode)
		const stream = buildObjectStreamPipeline(mongoStream, accessConditions, conditionsKeys, transformDatesToString, tracingSpan);

		const result: FindObjectStreamResult = {
			success: true,
			data: stream,
		};

		// Calculate total in parallel if requested (doesn't block stream)
		if (getTotal === true) {
			collection
				.countDocuments(query)
				.then(total => {
					(result as any).total = total;
				})
				.catch(err => {
					logger.error(`Error counting documents: ${err}`);
				});
		}

		return result;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`[findObjectStream] Error: ${errorMsg}`);
		return {
			success: false,
			errors: [{ message: errorMsg, code: 'FIND_OBJECT_STREAM_ERROR' }],
		} as KonectyResultError;
	}
}
