import get from 'lodash/get';
import has from 'lodash/has';
import _isNaN from 'lodash/isNaN';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

import { clearProjectionPathCollision, filterConditionToFn, parseFilterObject } from '@imports/data/filterUtils';
import { parseSortArray } from '@imports/data/sortUtils';
import { MetaObject } from '@imports/model/MetaObject';
import { getAccessFor, getFieldConditions, getFieldPermissions } from '@imports/utils/accessUtils';
import { logger } from '@imports/utils/logger';

import { getUserSafe } from '@imports/auth/getUser';
import { DEFAULT_PAGE_SIZE } from '@imports/consts';
import { dateToString } from '@imports/data/dateParser';
import { applyIfMongoVersionGreaterThanOrEqual } from '@imports/database/versioning';
import { KonFilter } from '@imports/model/Filter';
import { User } from '@imports/model/User';
import { DataDocument } from '@imports/types/data';
import { AggregatePipeline } from '@imports/types/mongo';
import { KonectyResult, KonectyResultError, KonectyResultSuccess } from '@imports/types/result';
import { convertStringOfFieldsSeparatedByCommaIntoObjectToFind } from '@imports/utils/convertStringOfFieldsSeparatedByCommaIntoObjectToFind';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Span } from '@opentelemetry/api';
import { Collection, Filter, FindOptions } from 'mongodb';
import { Readable } from 'node:stream';
import addDetailFieldsIntoAggregate from '../populateDetailFields/intoAggregate';

const STREAM_CONCURRENCY = 10;

type FindParams<AsStream> = {
	document: string;
	displayName?: string;
	displayType?: string;

	fields?: string;
	filter?: KonFilter;
	sort?: object | string;
	limit?: number | string;
	start?: number | string;

	getTotal?: boolean;
	withDetailFields?: 'true' | any;
	contextUser?: User;
	transformDatesToString?: boolean;
	tracingSpan?: Span;
	asStream?: AsStream;
} & ({ authTokenId: string; contextUser?: User } | { authTokenId?: string; contextUser: User });

type FindReturnType<AsStream> = KonectyResult<AsStream extends true ? Readable : DataDocument[]>;

export default async function find<AsStream extends boolean = false>({
	authTokenId,
	document,
	displayName,
	displayType,
	fields,
	filter,
	sort,
	limit,
	start,
	getTotal,
	withDetailFields,
	contextUser,
	transformDatesToString = true,
	tracingSpan,
	asStream,
}: FindParams<AsStream>): Promise<FindReturnType<AsStream>> {
	try {
		tracingSpan?.setAttribute('document', document);

		tracingSpan?.addEvent('Get User', { authTokenId, contextUser: contextUser?._id });
		const userResponse = await getUserSafe(authTokenId, contextUser);
		if (userResponse.success === false) {
			return errorReturn(userResponse.errors);
		}

		const user = userResponse.data;
		const access = getAccessFor(document, user);

		if (access === false || access.isReadable !== true) {
			return errorReturn(`[${document}] You don't have permission read records`);
		}

		const collection = MetaObject.Collections[document] as unknown as Collection<DataDocument>;
		if (collection == null) {
			return errorReturn(`[${document}] Collection not found`);
		}

		const metaObject = MetaObject.Meta[document];
		if (metaObject == null) {
			return errorReturn(`[${document}] Document not found`);
		}

		const fieldsObject = convertStringOfFieldsSeparatedByCommaIntoObjectToFind(fields);

		if (has(fieldsObject, '$textScore')) {
			fieldsObject.$textScore = { $meta: 'textScore' };
		}

		const queryFilter: KonFilter = {
			match: 'and',
			filters: [],
		};

		// If filter is not given, apply meta default filters
		if (!isObject(filter) && displayName != null && displayType != null) {
			const displayMeta = MetaObject.DisplayMeta[`${document}:${displayType}:${displayName}`];
			if ('filter' in displayMeta && displayMeta.filter) {
				queryFilter.filters?.push(displayMeta.filter);
			}
		}

		if (isObject(access.readFilter)) {
			queryFilter.filters?.push(access.readFilter);
		}

		if (isObject(filter)) {
			queryFilter.filters?.push(filter);
		}

		// Parse filters
		tracingSpan?.addEvent('Parsing filter');
		const readFilter = parseFilterObject(queryFilter, metaObject, { user }) as Filter<DataDocument>;
		const query = isObject(readFilter) && Object.keys(readFilter).length > 0 ? readFilter : {};

		if (isObject(filter) && isString(filter.textSearch)) {
			query.$text = { $search: filter.textSearch };
		}

		const emptyFields = Object.keys(fieldsObject).length === 0;

		const queryOptions: FindOptions = {
			limit: _isNaN(limit) || limit == null || Number(limit) <= 0 ? DEFAULT_PAGE_SIZE : parseInt(String(limit), 10),
			skip: parseInt(String(start ?? 0), 10),
			...applyIfMongoVersionGreaterThanOrEqual(6, () => ({ allowDiskUse: true })),
		};

		if (sort != null) {
			const sortArray = isString(sort) ? JSON.parse(sort) : sort;

			const sortResult = parseSortArray(sortArray);

			queryOptions.sort = Object.keys(sortResult.data).reduce<typeof sortResult.data>((acc, key) => {
				if (get(metaObject, `fields.${key}.type`) === 'money') {
					acc[`${key}.value`] = sortResult.data[key];
				}

				if (get(metaObject, `fields.${key}.type`) === 'personName') {
					acc[`${key}.full`] = sortResult.data[key];
				}

				if (key === '$textScore') {
					if (fieldsObject.$textScore) {
						acc.$textScore = { $meta: 'textScore' };
					}
				}

				acc[key] = sortResult.data[key];
				return acc;
			}, {});
		}

		if ((queryOptions.limit ?? DEFAULT_PAGE_SIZE) > 1000) {
			queryOptions.sort = { _id: 1 };
		}

		tracingSpan?.addEvent('Calculating field permissions');
		const accessConditionsResult = Object.keys(metaObject.fields).map<KonectyResult<{ fieldName: string; condition: Function } | null>>(fieldName => {
			const accessField = getFieldPermissions(access, fieldName);
			if (accessField.isReadable === true) {
				const accessFieldConditions = getFieldConditions(access, fieldName);
				if (accessFieldConditions.READ != null) {
					const condition = filterConditionToFn(accessFieldConditions.READ, metaObject, { user });
					if (condition.success === false) {
						return condition;
					}
					if ((emptyFields === true && fieldsObject[fieldName] === 0) || (emptyFields !== true && fieldsObject[fieldName] === 1)) {
						Object.keys(condition.data).forEach(conditionField => {
							if (emptyFields === true) {
								delete fieldsObject[conditionField];
							} else {
								fieldsObject[conditionField] = 1;
							}
						});
					}
					return successReturn({
						fieldName,
						condition: condition.data,
					});
				}
			} else {
				if (emptyFields === true) {
					fieldsObject[fieldName] = 0;
				} else {
					delete fieldsObject[fieldName];
				}
			}
			return successReturn(null);
		});

		queryOptions.projection = clearProjectionPathCollision(fieldsObject);

		if (accessConditionsResult.some(result => result.success === false)) {
			return accessConditionsResult.find(result => result.success === false) as KonectyResultError;
		}

		tracingSpan?.addEvent('Applying permissions to projection');
		const accessConditions = accessConditionsResult.reduce<Record<string, Function>>((acc, result) => {
			if (result.success === false || result.data == null) {
				return acc;
			}
			acc[result.data.fieldName] = result.data.condition;

			// Add the fields with conditions to the query, so we can compare later
			const fieldUsedInCondition = getFieldConditions(access, result.data.fieldName).READ?.term?.split('.')?.[0];
			if (fieldUsedInCondition != null && queryOptions.projection) {
				if (emptyFields) {
					delete queryOptions.projection[fieldUsedInCondition];
				} else {
					queryOptions.projection[fieldUsedInCondition] = 1;
				}
			}

			return acc;
		}, {});

		const startTime = process.hrtime();

		tracingSpan?.addEvent('Executing find query', { queryOptions: JSON.stringify(queryOptions) });
		const aggregateStages: AggregatePipeline = [{ $match: query }];
		if (queryOptions.sort) {
			aggregateStages.push({ $sort: queryOptions.sort });
		}
		if (queryOptions.skip) {
			aggregateStages.push({ $skip: queryOptions.skip });
		}
		if (queryOptions.limit) {
			aggregateStages.push({ $limit: queryOptions.limit });
		}

		if (withDetailFields === 'true') {
			const lookupStages = addDetailFieldsIntoAggregate(document, queryOptions.projection);

			if (lookupStages.length > 0) {
				aggregateStages.push(...lookupStages);
			}
		}

		if (Object.keys(queryOptions.projection).length > 0) {
			aggregateStages.push({ $project: queryOptions.projection });
		}

		const cursor = collection.aggregate(aggregateStages, { allowDiskUse: true });
		const recordStream = cursor.stream();

		const totalTime = process.hrtime(startTime);
		const log = `${totalTime[0]}s ${totalTime[1] / 1000000}ms => Find ${document}, filter: ${JSON.stringify(query)}, options: ${JSON.stringify(queryOptions)}`;
		logger.trace(log);

		const result: KonectyResultSuccess<typeof recordStream> = {
			success: true,
			data: recordStream,
		};

		const conditionsKeys = Object.keys(accessConditions);
		if (conditionsKeys.length > 0) {
			tracingSpan?.addEvent('Removing unauthorized fields from records');
			result.data = result.data.map(
				(record: DataDocument) =>
					conditionsKeys.reduce<typeof record>((acc, key) => {
						if (accessConditions[key](record) === false) {
							delete acc[key];
						}

						return acc;
					}, record),
				{ concurrency: STREAM_CONCURRENCY },
			);
		}

		if (getTotal === true) {
			tracingSpan?.addEvent('Calculating total');
			result.total = await collection.countDocuments(query);
		}

		if (transformDatesToString) {
			result.data = result.data.map((record: DataDocument) => dateToString(record), { concurrency: STREAM_CONCURRENCY });
		}

		if (asStream) {
			return result as FindReturnType<AsStream>;
		}

		const arrayResult = Object.assign({}, result, { data: await result.data.toArray() });
		return arrayResult;
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);
		logger.error(error, `Error executing query: ${error.message}`);

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
