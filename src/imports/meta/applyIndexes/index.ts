import BluebirdPromise from 'bluebird';

import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import isNumber from 'lodash/isNumber';
import isObject from 'lodash/isObject';

import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectType } from '@imports/types/metadata';
import { logger } from '@imports/utils/logger';
import { CreateIndexesOptions, createCommentsIndexFor, createHistoryIndexFor, createInternalFieldsIndexFor, getFieldsToIndex, tryEnsureIndex } from './utils';

const dropAllIndexes = process.env.DROP_ALL_INDEXES === 'true' || process.env.DROP_ALL_INDEXES === '1';

export default async function applyIndexes(meta: MetaObjectType) {
	if (isEmpty(process.env.DISABLE_REINDEX) || process.env.DISABLE_REINDEX === 'false' || process.env.DISABLE_REINDEX === '0') {
		logger.debug(`Reindexing meta ${meta.name}`);
		return processIndexes(meta);
	}
}

async function processIndexes(meta: MetaObjectType) {
	if (meta.type !== 'composite' && meta.type !== 'document') {
		return;
	}

	// Drop all indexes of meta
	if (dropAllIndexes) {
		logger.info(`Droping all indexes at ${meta.collection}`);
		await MetaObject.Collections[meta.name].dropIndexes();
		await MetaObject.Collections[`${meta.name}.Comment`].dropIndexes();
		await MetaObject.Collections[`${meta.name}.History`].dropIndexes();
	}

	const iterableMeta = Object.entries(meta.fields).reduce(
		(acc, [fieldName, { type, isUnique }]) => (isUnique || ['lookup', 'address', 'autoNumber'].includes(type) ? [...acc, fieldName] : acc),
		[] as string[],
	);

	// Create indexes for unique or (lookup, address, autoNumber) fields
	await BluebirdPromise.each(iterableMeta, async (fieldName: string) => {
		const field = meta.fields[fieldName];

		const options: CreateIndexesOptions = {
			unique: 0,
			name: fieldName,
		};

		if (field.type === 'autoNumber' || field.isUnique === true) {
			options.unique = 1;
		}

		if (field.isUnique === true && field.isRequired !== true) {
			options.sparse = 1;
		}

		if (['username', 'emails'].includes(field.name) && meta.name === 'User') {
			options.unique = 1;
			options.sparse = 1;
		}

		const fields = getFieldsToIndex(field).reduce((acc, indexField) => ({ ...acc, [indexField]: 1 }), {});

		logger.debug(`Ensure Index at ${meta.collection}: ${fieldName}`);
		await tryEnsureIndex({
			collection: MetaObject.Collections[meta.name],
			fields,
			options,
		});
	});

	logger.debug('Creating indexes for %s, %s, %s', `${meta.collection}.History`, `${meta.collection}.Comment`, `${meta.collection} internal fields`);
	/* prettier-ignore */
	await BluebirdPromise.all([
		createHistoryIndexFor(meta),
		createCommentsIndexFor(meta),
		createInternalFieldsIndexFor(meta)
	]);

	// Create indexes defined in meta
	if (meta.indexes != null && isObject(meta.indexes) && !isArray(meta.indexes) && Object.keys(meta.indexes).length > 0) {
		await BluebirdPromise.each(Object.keys(meta.indexes), async indexName => {
			let index = meta.indexes?.[indexName];

			if (index == null) {
				index = {
					keys: {},
					options: {
						name: indexName,
					},
				};
			}

			if (index.keys == null) {
				index.keys = {};
			}
			if (index.options == null) {
				index.options = {};
			}
			if (index.options.name == null) {
				index.options.name = indexName;
			}

			logger.debug(`Ensure Index at ${meta.collection}: ${index.options.name}`);
			if (Object.keys(index.keys).length > 0) {
				const keys = Object.entries(index.keys).reduce((acc, [key, direction]) => {
					acc[key.replace(/:/g, '.')] = direction;
					return acc;
				}, {} as any);

				await tryEnsureIndex({
					collection: MetaObject.Collections[meta.name],
					fields: keys,
					options: index.options,
				});
			}
		});
	}

	// Create text index
	if (meta.indexText != null && isObject(meta.indexText) && !isArray(meta.indexText) && Object.keys(meta.indexText).length > 0) {
		const options: {
			name: string;
			default_language: string;
			weights: Record<string, number>;
		} = {
			name: 'TextIndex',
			default_language: MetaObject.Namespace.language,
			weights: {},
		};

		logger.debug(`Ensure Index at ${meta.collection}: ${options.name}`);

		const keys = Object.entries(meta.indexText).reduce((acc, [key, weight]) => {
			acc[key.replace(/:/g, '.')] = 'text';
			if (isNumber(weight) && weight > 0) {
				options.weights[key.replace(/:/g, '.')] = weight;
			}
			return acc;
		}, {} as any);

		await tryEnsureIndex({
			collection: MetaObject.Collections[meta.name],
			fields: keys,
			options,
		});
	}
}
