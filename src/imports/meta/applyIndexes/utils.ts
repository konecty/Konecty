import BluebirdPromise from 'bluebird';

import { Field } from '@imports/model/Field';
import { MetaObject } from '@imports/model/MetaObject';
import { MetaObjectType } from '@imports/types/metadata';
import { logger } from '@imports/utils/logger';
import { CreateIndexesOptions as MongoCreateIndexOpts, MongoServerError } from 'mongodb';

export type CreateIndexesOptions = {
	[key in keyof MongoCreateIndexOpts]: MongoCreateIndexOpts[key] extends boolean | undefined ? boolean | 0 | 1 | undefined : MongoCreateIndexOpts[key];
};

interface TryEnsureIndexParams {
	collection: (typeof MetaObject.Collections)[string];
	fields: Record<string, 1 | 0 | -1>;
	options: CreateIndexesOptions;
}

export async function tryEnsureIndex({ collection, fields, options }: TryEnsureIndexParams) {
	try {
		await collection.createIndex(fields, options as MongoCreateIndexOpts);
		return true;
	} catch (e) {
		if (e instanceof MongoServerError && e.code === 85) {
			logger.trace("Index already exists: '%s'", options.name);
		} else {
			logger.error('Index Error: %s', (e as Error).message);
		}
		return false;
	}
}

export async function createHistoryIndexFor(meta: MetaObjectType) {
	const historyIndexes = ['dataId', 'createdAt'];

	return BluebirdPromise.each(historyIndexes, async historyIndex => {
		await tryEnsureIndex({
			collection: MetaObject.Collections[`${meta.name}.History`],
			fields: { [historyIndex]: 1 },
			options: { name: historyIndex },
		});
	});
}

export async function createCommentsIndexFor(meta: MetaObjectType) {
	const commentIndexes = ['dataId', '_createdAt'];

	return BluebirdPromise.each(commentIndexes, async commentIndex => {
		await tryEnsureIndex({
			collection: MetaObject.Collections[`${meta.name}.Comment`],
			fields: { [commentIndex]: 1 },
			options: { name: commentIndex },
		});
	});
}

export async function createInternalFieldsIndexFor(meta: MetaObjectType) {
	const metaDefaultIndexes = ['_user._id', '_user.group._id', '_updatedAt', '_updatedBy._id', '_createdAt', '_createdBy._id'];

	return BluebirdPromise.each(metaDefaultIndexes, async metaDefaultIndex =>
		tryEnsureIndex({
			collection: MetaObject.Collections[meta.name],
			fields: { [metaDefaultIndex]: 1 },
			options: { name: metaDefaultIndex },
		}),
	);
}

export function getFieldsToIndex(field: Field) {
	const subfieldsConfig: Record<string, (field: Field) => string[]> = {
		lookup: (field: Field) => (field.detailFields ?? []).concat('_id'),
		email: (field: Field) => ['address'],
		money: (field: Field) => ['value'],
		personName: (field: Field) => ['full'],
		phone: (field: Field) => ['phoneNumber', 'countryCode'],
		address: (field: Field) => ['country', 'state', 'city', 'district', 'place', 'number', 'complement', 'postalCode', 'placeType'],
	};

	const subFields = subfieldsConfig[field.type]?.(field);
	if (subFields == null) {
		return [field.name];
	}

	return subFields.map(subField => `${field.name}.${subField}`);
}
