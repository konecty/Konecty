import BluebirdPromise from 'bluebird';

import get from 'lodash/get';
import has from 'lodash/has';
import intersection from 'lodash/intersection';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import uniq from 'lodash/uniq';

import { getFirstPartOfArrayOfPaths, getTermsOfFilter } from '@imports/konsistent/utils';
import { MetaObject } from '@imports/model/MetaObject';
import type { Relation } from '@imports/model/Relation';
import { DataDocument, HistoryDocument } from '@imports/types/data';
import { logger } from '@imports/utils/logger';
import { Collection, FindOptions } from 'mongodb';
import updateRelationReference from './relationReference';

type Action = 'update' | 'create' | 'delete';

export default async function updateRelationReferences(metaName: string, action: Action, id: string, data: Record<string, any>) {
	// Get references from meta
	let relation, relations, relationsFromDocumentName;
	const references = MetaObject.References[metaName];

	// Verify if exists reverse relations
	if (!isObject(references) || !isObject(references.relationsFrom) || Object.keys(references.relationsFrom).length === 0) {
		return;
	}

	// Get model
	let collection = MetaObject.Collections[metaName];

	// If action is delete then get collection trash
	if (action === 'delete') {
		collection = MetaObject.Collections[`${metaName}.Trash`];
	}

	const referencesToUpdate: Record<string, Relation[]> = {};

	// If action is create or delete then update all records with data related in this record
	if (action !== 'update') {
		for (relationsFromDocumentName in references.relationsFrom) {
			relations = references.relationsFrom[relationsFromDocumentName];
			referencesToUpdate[relationsFromDocumentName] = relations;
		}
		// Else update only data when changes in this document affects related aggregation
	} else {
		// Get all keys that was updated
		const updatedKeys = Object.keys(data);

		// Iterate over all relations to verify if each relation has filter's terms or aggregate's fields in updatedKeys
		for (relationsFromDocumentName in references.relationsFrom) {
			relations = references.relationsFrom[relationsFromDocumentName];
			for (relation of relations) {
				let referencedKeys = [];

				if (isString(relation.lookup)) {
					referencedKeys.push(relation.lookup);
				}

				referencedKeys = referencedKeys.concat(getFirstPartOfArrayOfPaths(getTermsOfFilter(relation.filter)));

				for (let fieldName in relation.aggregators) {
					const aggregator = relation.aggregators[fieldName];
					if (aggregator.field) {
						referencedKeys.push(aggregator.field.split('.')[0]);
					}
				}

				// Remove duplicated fields, can exists because we splited paths to get only first part
				referencedKeys = uniq(referencedKeys);
				// Get only keys that exists in references and list of updated keys
				referencedKeys = intersection(referencedKeys, updatedKeys);

				// If there are common fields, add relation to list of relations to be processed
				if (referencedKeys.length > 0) {
					if (!referencesToUpdate[relationsFromDocumentName]) {
						referencesToUpdate[relationsFromDocumentName] = [];
					}
					referencesToUpdate[relationsFromDocumentName].push(relation);
				}
			}
		}
	}

	// If there are 0 references to process then abort
	if (Object.keys(referencesToUpdate).length === 0) {
		return;
	}

	// Find record with all information, not only udpated data, to calc aggregations
	const record = await (collection as unknown as Collection<DataDocument>).findOne({ _id: id });

	// If no record was found log error and abort
	if (!record) {
		return logger.error(`Can't find record ${id} from ${metaName}`);
	}

	// # Iterate over relations to process
	await BluebirdPromise.mapSeries(Object.keys(referencesToUpdate), async referenceDocumentName => {
		relations = referencesToUpdate[referenceDocumentName];
		await BluebirdPromise.mapSeries(relations, async relation => {
			var value;
			const relationLookupMeta = MetaObject.Meta[relation.document];
			// Get lookup id from record
			const lookupId: string[] = [];
			if (has(record, `${relation.lookup}._id`)) {
				lookupId.push(get(record, `${relation.lookup}._id`, '') as string);
			} else if (get(relationLookupMeta, `fields.${relation.lookup}.isList`) === true && Array.isArray(record[relation.lookup])) {
				for (value of record[relation.lookup] as Array<Record<string, string>>) {
					if (value != null && value._id != null) {
						lookupId.push(value._id);
					}
				}
			}

			// If action is update and the lookup field of relation was updated go to hitory to update old relation
			if (lookupId.length > 0 && action === 'update' && has(data, `${relation.lookup}._id`)) {
				// Try to get history model
				const historyCollection = MetaObject.Collections[`${metaName}.History`];

				if (historyCollection == null) {
					logger.error(`Can't get model for document ${metaName}.History`);
				}

				// Define query of history with data id
				const historyQuery: Record<string, unknown> = { dataId: id.toString() };

				// Add condition to get aonly data with changes on lookup field
				historyQuery[`data.${relation.lookup}`] = { $exists: true };

				// And sort DESC to get only last data
				const historyOptions: FindOptions<HistoryDocument> = { sort: { createdAt: -1 } };

				// User findOne to get only one data
				const historyRecord = await historyCollection.findOne<HistoryDocument>(historyQuery, historyOptions);

				// If there are record
				if (historyRecord) {
					// Then get lookupid to execute update on old relation
					let historyLookupId: string[] = new Array().concat(get(historyRecord, `data.${relation.lookup}._id`, []));
					if (get(relationLookupMeta, `fields.${relation.lookup}.isList`) === true && isArray(historyRecord.data[relation.lookup])) {
						historyLookupId = [];
						for (value of historyRecord.data[relation.lookup] as Array<Record<string, string>>) {
							value._id != null && historyLookupId.push(value._id);
						}
					}

					await BluebirdPromise.mapSeries(historyLookupId, async historyLookupIdItem => {
						return updateRelationReference(metaName, relation, historyLookupIdItem, referenceDocumentName);
					});
				}
			}

			// Execute update of relations into new value
			await BluebirdPromise.mapSeries(lookupId, lookupIdItem => updateRelationReference(metaName, relation, lookupIdItem, referenceDocumentName));
		});
	});
}
