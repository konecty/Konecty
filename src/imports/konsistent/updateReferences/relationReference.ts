import BluebirdPromise from 'bluebird';
import { Collection, Filter, UpdateFilter } from 'mongodb';

import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';

import { parseFilterObject } from '@imports/data/filterUtils';

import { MetaObject } from '@imports/model/MetaObject';
import { DataDocument } from '@imports/types/data';
import { Relation } from '@imports/types/metadata';
import type { AggregatePipeline } from '@imports/types/mongo';
import { logger } from '@imports/utils/logger';

export default async function updateRelationReference(metaName: string, relation: Relation, lookupId: string, documentName: string) {
	// Try to get metadata
	let e, query: Filter<object> | undefined;
	const meta = MetaObject.Meta[metaName];

	if (!meta) {
		logger.error(`Can't get meta of document ${metaName}`);
		return 0;
	}

	if (isObject(relation)) {
		relation = JSON.parse(JSON.stringify(relation));
	}

	// Init a query with filter of relation
	if (has(relation, 'filter')) {
		query = parseFilterObject(relation.filter, meta);
	}

	// If no query was setted, then init a empty filter
	if (!query) {
		query = {};
	}
	// Add condition to get only documents with lookup to passaed lookupId
	query[`${relation.lookup}._id`] = lookupId;

	// Get data colletion from native mongodb
	const collection = MetaObject.Collections[relation.document] as Collection<DataDocument>;

	// Init update object
	const valuesToUpdate: UpdateFilter<DataDocument> = {
		$set: {},
		$unset: {},
	};

	if (relation.aggregators == null) {
		logger.error(`Can't get aggregators of relation ${relation.document} on document ${metaName}`);
		return 0;
	}

	// Iterate over all aggregators to create the update object
	await BluebirdPromise.mapSeries(Object.keys(relation.aggregators), async fieldName => {
		// Only allow aggregatores with some methods
		const aggregator = relation.aggregators?.[fieldName];
		if (aggregator == null) return;

		if (!['count', 'sum', 'min', 'max', 'avg', 'first', 'last', 'addToSet'].includes(aggregator.aggregator)) {
			return;
		}

		const pipeline: AggregatePipeline = [];

		// Init query to aggregate data
		const match: AggregatePipeline[number] = { $match: query };

		pipeline.push(match);

		// Init aggregation object to aggregate all values into one
		const group = {
			$group: {
				_id: null,
				value: {} as Record<string, any>,
				currency: undefined as Record<string, any> | undefined,
			},
		} satisfies AggregatePipeline[number];

		let type = '';

		// If agg is count then use a trick to count records using sum
		if (aggregator.aggregator === 'count') {
			group.$group.value.$sum = 1;
		} else {
			// Get type of aggrated field
			const MetaObj = MetaObject.Meta[relation.document];
			if (MetaObj.type !== 'document') return;

			const aggregatorField = MetaObj.fields[Number(aggregator.field.split('.')[0])];
			({ type } = aggregatorField);

			// If type is money ensure that field has .value
			if (type === 'money' && !/\.value$/.test(aggregator.field)) {
				aggregator.field += '.value';
			}

			// And get first occurency of currency
			if (type === 'money') {
				group.$group.currency = { $first: `$${aggregator.field.replace('.value', '.currency')}` };
			}

			if (type === 'lookup' && aggregator.aggregator === 'addToSet') {
				if (aggregatorField.isList === true) {
					pipeline.push({ $unwind: `$${aggregator.field}` });
				}

				const addToSetGroup = {
					$group: {
						_id: `$${aggregator.field}._id`,
						value: {
							$first: `$${aggregator.field}`,
						},
					},
				};

				pipeline.push(addToSetGroup);

				aggregator.field = 'value';
			}

			// If agg inst count then use agg method over passed agg field
			group.$group.value[`$${aggregator.aggregator}`] = `$${aggregator.field}`;
		}

		pipeline.push(group);

		// Try to execute agg and log error if fails
		try {
			let result = await collection.aggregate(pipeline, { cursor: { batchSize: 1 } }).toArray();

			// If result was an array with one item cotaining a property value
			if (isArray(result) && isObject(result[0]) && result[0].value) {
				valuesToUpdate.$set = valuesToUpdate.$set ?? {};
				// If aggregator is of type money create an object with value and currency
				if (type === 'money') {
					valuesToUpdate.$set[fieldName] = { currency: result[0].currency, value: result[0].value };
				} else {
					// Then add value to update object
					valuesToUpdate.$set[fieldName] = result[0].value;
				}
			} else {
				valuesToUpdate.$unset = valuesToUpdate.$unset ?? {};
				valuesToUpdate.$unset[fieldName] = 1;
			}
		} catch (error) {
			e = error as Error;
			logger.error(e, `Error on aggregate relation ${relation.document} on document ${metaName}: ${e.message}`);
		}
	});

	// Remove $set if empty
	if (valuesToUpdate.$set && Object.keys(valuesToUpdate.$set).length === 0) {
		delete valuesToUpdate.$set;
	}

	// Remove $unset if empty
	if (valuesToUpdate.$unset && Object.keys(valuesToUpdate.$unset).length === 0) {
		delete valuesToUpdate.$unset;
	}

	// If no value was defined to set or unset then abort
	if (Object.keys(valuesToUpdate).length === 0) {
		return 0;
	}

	// Try to get reference model
	const referenceCollection = MetaObject.Collections[documentName] as Collection<DataDocument>;
	if (referenceCollection == null) {
		logger.error(`Can't get model for document ${documentName}`);
		return 0;
	}

	// Define a query to udpate records with aggregated values
	const updateQuery: Filter<DataDocument> = { _id: lookupId };

	// Try to execute update query
	try {
		const { modifiedCount: affected } = await referenceCollection.updateOne(updateQuery, valuesToUpdate);

		// If there are affected records
		if (affected > 0) {
			// Log Status
			logger.info(`∑ ${documentName} < ${metaName} (${affected})`);

			// And log all aggregatores for this status
			Object.entries(relation.aggregators).forEach(([fieldName, aggregator]) => {
				if (aggregator.field) {
					logger.info(`  ${documentName}.${fieldName} < ${aggregator.aggregator} ${metaName}.${aggregator.field}`);
				} else {
					logger.info(`  ${documentName}.${fieldName} < ${aggregator.aggregator} ${metaName}`);
				}
			});
		}

		return affected;
	} catch (error1) {
		logger.error(error1, 'Error on updateRelationReference');
	}

	return 0;
}
