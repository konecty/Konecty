import get from 'lodash/get';
import has from 'lodash/has';
import _isNaN from 'lodash/isNaN';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

import { clearProjectionPathCollision, filterConditionToFn, parseFilterObject } from '@imports/data/filterUtils';
import { parseSortArray } from '@imports/data/sortUtils';
import { MetaObject } from '@imports/model/MetaObject';
import { getAccessFor, getFieldConditions, getFieldPermissions } from '@imports/utils/accessUtils';

import { getUserSafe } from '@imports/auth/getUser';
import { DEFAULT_PAGE_SIZE } from '@imports/consts';
import { applyIfMongoVersionGreaterThanOrEqual } from '@imports/database/versioning';
import { KonFilter } from '@imports/model/Filter';
import { User } from '@imports/model/User';
import { DataDocument } from '@imports/types/data';
import { AggregatePipeline } from '@imports/types/mongo';
import { KonectyResult, KonectyResultError } from '@imports/types/result';
import { convertStringOfFieldsSeparatedByCommaIntoObjectToFind } from '@imports/utils/convertStringOfFieldsSeparatedByCommaIntoObjectToFind';
import { errorReturn, successReturn } from '@imports/utils/return';
import { Span } from '@opentelemetry/api';
import { Collection, Document, Filter, FindOptions } from 'mongodb';
import addDetailFieldsIntoAggregate from '../populateDetailFields/intoAggregate';

function buildSortOptions(
	metaObject: typeof MetaObject.Meta[string],
	sortArray: unknown,
	fieldsObject: Record<string, number | { $meta: string }>,
): Record<string, number | { $meta: string }> {
	const sortResult = parseSortArray(sortArray);

	return Object.keys(sortResult.data).reduce<Record<string, number | { $meta: string }>>((acc, key) => {
		const sortValue = typeof sortResult.data[key] === 'number' ? sortResult.data[key] : (sortResult.data[key] === 'asc' ? 1 : -1);

		if (get(metaObject, `fields.${key}.type`) === 'money') {
			acc[`${key}.value`] = sortValue;
		}

		if (get(metaObject, `fields.${key}.type`) === 'personName') {
			acc[`${key}.full`] = sortValue;
		}

		if (key === '$textScore') {
			if (fieldsObject.$textScore) {
				acc.$textScore = { $meta: 'textScore' };
			}
		}

		acc[key] = sortValue;
		return acc;
	}, {});
}

function buildAccessConditionsForField(
	fieldName: string,
	metaObject: typeof MetaObject.Meta[string],
	access: ReturnType<typeof getAccessFor>,
	fieldsObject: Record<string, number | { $meta: string }>,
	emptyFields: boolean,
	user: User,
): KonectyResult<{ fieldName: string; condition: Function } | null> {
	if (access === false) {
		return successReturn(null);
	}

	const accessField = getFieldPermissions(access, fieldName);
	if (accessField.isReadable === true) {
		const accessFieldConditions = getFieldConditions(access, fieldName);
		if (accessFieldConditions.READ != null) {
			const condition = filterConditionToFn(accessFieldConditions.READ, metaObject, { user });
			if (condition.success === false) {
				return condition;
			}
			if ((emptyFields === true && fieldsObject[fieldName] === 0) || (emptyFields !== true && fieldsObject[fieldName] === 1)) {
				Object.keys(condition.data).reduce((acc, conditionField) => {
					if (emptyFields === true) {
						delete acc[conditionField];
					} else {
						acc[conditionField] = 1;
					}
					return acc;
				}, fieldsObject);
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
}

function buildAccessConditionsMap(
	accessConditionsResult: KonectyResult<{ fieldName: string; condition: Function } | null>[],
	access: ReturnType<typeof getAccessFor>,
	queryOptions: FindOptions & { projection: Document },
	emptyFields: boolean,
): Record<string, Function> {
	if (access === false) {
		return {};
	}

	return accessConditionsResult.reduce<Record<string, Function>>((acc, result) => {
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
}

function calculateConditionsKeys(
	accessConditions: Record<string, Function>,
	projection: Record<string, unknown>,
	emptyFields: boolean,
): string[] {
	const allKeys = Object.keys(accessConditions);

	if (Object.keys(projection).length === 0) {
		return allKeys;
	}

	if (emptyFields) {
		return allKeys.filter(key => !projection[key]);
	}

	return allKeys.filter(key => projection[key]);
}

export type BuildFindQueryParams = {
	authTokenId?: string;
	document: string;
	displayName?: string;
	displayType?: string;
	fields?: string;
	filter?: KonFilter;
	sort?: object | string;
	limit?: number | string;
	start?: number | string;
	withDetailFields?: 'true' | any;
	contextUser?: User;
	tracingSpan?: Span;
};

export type BuildFindQueryResult = {
	query: Filter<DataDocument>;
	aggregateStages: AggregatePipeline;
	accessConditions: Record<string, Function>;
	conditionsKeys: string[];
	queryOptions: FindOptions & { projection: Document };
	metaObject: typeof MetaObject.Meta[string];
	user: User;
	access: ReturnType<typeof getAccessFor>;
	collection: Collection<DataDocument>;
	emptyFields: boolean;
};

export async function buildFindQuery({
	authTokenId,
	document,
	displayName,
	displayType,
	fields,
	filter,
	sort,
	limit,
	start,
	withDetailFields,
	contextUser,
	tracingSpan,
}: BuildFindQueryParams): Promise<KonectyResult<BuildFindQueryResult>> {
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
		const readFilter = parseFilterObject(queryFilter, metaObject, { user });
		if (readFilter.success === false) {
			return readFilter as KonectyResultError;
		}

		// Match the behavior of find.ts (line 129) - use readFilter directly if it's an object with keys
		// This ensures consistency with the original find endpoint behavior
		// Note: This replicates a bug in find.ts where it uses the KonectyResult object instead of readFilter.data
		// but we need to match the behavior for consistency
		const query = (isObject(readFilter) && Object.keys(readFilter).length > 0 ? readFilter : {}) as Filter<DataDocument> & { $text?: { $search: string } };

		if (isObject(filter) && isString(filter.textSearch)) {
			query.$text = { $search: filter.textSearch };
		}

		const emptyFields = Object.keys(fieldsObject).length === 0;

		const queryOptions: FindOptions & { projection: Document } = {
			limit: _isNaN(limit) || limit == null || Number(limit) <= 0 ? DEFAULT_PAGE_SIZE : parseInt(String(limit), 10),
			skip: parseInt(String(start ?? 0), 10),
			projection: {},
			...applyIfMongoVersionGreaterThanOrEqual(6, () => ({ allowDiskUse: true })),
		};

		if (sort != null) {
			const sortArray = isString(sort) ? JSON.parse(sort) : sort;
			const sortOptions = buildSortOptions(metaObject, sortArray, fieldsObject as Record<string, number | { $meta: string }>);
			queryOptions.sort = sortOptions as Document;
		}

		// Apply default sort for consistency when no sort is specified
		// This ensures consistent ordering across different executions, especially with secondaryPreferred read preference
		if (!queryOptions.sort || Object.keys(queryOptions.sort).length === 0) {
			queryOptions.sort = { _id: 1 };
		}

		if ((queryOptions.limit ?? DEFAULT_PAGE_SIZE) > 1000) {
			queryOptions.sort = { _id: 1 };
		}

		tracingSpan?.addEvent('Calculating field permissions');
		const accessConditionsResult = Object.keys(metaObject.fields).map<KonectyResult<{ fieldName: string; condition: Function } | null>>(
			fieldName => buildAccessConditionsForField(fieldName, metaObject, access, fieldsObject as Record<string, number | { $meta: string }>, emptyFields, user),
		);

		queryOptions.projection = clearProjectionPathCollision(fieldsObject);

		if (accessConditionsResult.some(result => result.success === false)) {
			return accessConditionsResult.find(result => result.success === false) as KonectyResultError;
		}

		tracingSpan?.addEvent('Applying permissions to projection');
		const accessConditions = buildAccessConditionsMap(accessConditionsResult, access, queryOptions, emptyFields);

		tracingSpan?.addEvent('Executing find query', { queryOptions: JSON.stringify(queryOptions) });
		const aggregateStages: AggregatePipeline = [{ $match: query }];
		if (queryOptions.sort && Object.keys(queryOptions.sort).length > 0) {
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

		const conditionsKeys = calculateConditionsKeys(accessConditions, queryOptions.projection, emptyFields);

		return successReturn({
			query,
			aggregateStages,
			accessConditions,
			conditionsKeys,
			queryOptions,
			metaObject,
			user,
			access,
			collection,
			emptyFields,
		});
	} catch (err) {
		const error = err as Error;
		tracingSpan?.setAttribute('error', error.message);

		return {
			success: false,
			errors: [
				{
					message: error.message || 'Error building find query',
				},
			],
		};
	}
}

