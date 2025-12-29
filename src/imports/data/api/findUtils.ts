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
		const readFilter = parseFilterObject(queryFilter, metaObject, { user }) as Filter<DataDocument>;
		if (readFilter.success === false) {
			return readFilter as KonectyResultError;
		}

		const query = isObject(readFilter) && Object.keys(readFilter).length > 0 ? readFilter : {};

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
		let conditionsKeys = Object.keys(accessConditions);

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

			// Only check permissions on fields that are in the projection
			if (emptyFields) {
				conditionsKeys = conditionsKeys.filter(key => !queryOptions.projection[key]);
			} else {
				conditionsKeys = conditionsKeys.filter(key => queryOptions.projection[key]);
			}
		}

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

