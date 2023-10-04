import BluebirdPromise from 'bluebird';
import { MongoClient } from 'mongodb';
import { CronJob } from 'cron';
import { DateTime } from 'luxon';

import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import uniq from 'lodash/uniq';
import intersection from 'lodash/intersection';
import isArray from 'lodash/isArray';
import compact from 'lodash/compact';
import has from 'lodash/has';
import set from 'lodash/set';
import get from 'lodash/get';
import size from 'lodash/size';
import keys from 'lodash/keys';
import merge from 'lodash/merge';
import pick from 'lodash/pick';
import omit from 'lodash/omit';

import { Meta, Models, References, MetaByCollection, Collections } from '/imports/model/MetaObject';
import { parseFilterObject } from '/imports/data/filterUtils';
import { copyDescriptionAndInheritedFields } from '/imports/meta/copyDescriptionAndInheritedFields';

import { logger } from '/imports/utils/logger';
import { db } from '/imports/database';
import {getFirstPartOfArrayOfPaths, getTermsOfFilter} from '/imports/konsistent/utils';
import { formatValue, getLabel } from '/imports/konsistent/utils';

const KONSISTENT_SCHEDULE = process.env.KONSISTENT_SCHEDULE || '*/1 * * * *';

const TZ = process.env.TZ || 'America/Sao_Paulo';

const konsystentJob = new CronJob(KONSISTENT_SCHEDULE, processOplogItem, null, false, TZ);

export async function setupKonsistent() {
	const konsistentCollection = db.collection('Konsistent');
	const konsistentChangesCollection = db.collection('KonsistentChanges');

	const collections = await db.collections({
		nameOnly: true,
		dbName: db.databaseName,
	});

	if (collections.map(({ collectionName }) => collectionName).includes('KonsistentChanges') === false) {
		const indexResult = await konsistentChangesCollection.createIndex({ processTS: 1 }, { expireAfterSeconds: 24 * 60 * 60, sparse: true, name: 'processTS_expire' }); // 1 day
		logger.info(indexResult, `Created index processTS_expire on KonsistentChanges`);
	}

	processOplogItem().catch(e => {
		logger.error(e, 'Error on processOplogItem');
	});

	const metaCollections = Object.values(Meta).map(meta => `${db.databaseName}.${meta.collection}`);
	const metaTrashCollections = metaCollections.map(name => name + '.Trash');

	if (process.env.MONGO_OPLOG_URL != null) {
		const lastProcessedOplog = await konsistentCollection.findOne({ _id: 'LastProcessedOplog' });

		if (lastProcessedOplog?.ts != null) {
			const queryData = {
				op: {
					$in: ['u', 'i'],
				},
				ns: {
					$in: metaCollections,
				},
			};

			const queryTrash = {
				op: 'i',
				ns: {
					$in: metaTrashCollections,
				},
			};

			const query = { $or: [queryData, queryTrash], ts: { $gt: lastProcessedOplog.ts } };

			const oplogClient = new MongoClient(process.env.MONGO_OPLOG_URL, { maxPoolSize: 1 });

			// Get oplog native collection
			const oplogCollection = oplogClient.db('local').collection('oplog.rs');

			const recoveryEntries = await oplogCollection.find(query).toArray();

			const entries = recoveryEntries.map(entry => _mapFromOplogToChange(entry)).filter(e => e != null);

			const result = await BluebirdPromise.reduce(
				entries,
				async (acc, entry) => {
					try {
						await konsistentChangesCollection.insertOne(entry);
						return acc + 1;
					} catch (error) {
						if (error.code === 11000) {
							return acc;
						}
						logger.error(error, 'Error on insert recovery entry');
						return acc;
					}
				},
				0,
			);

			logger.info(`Inserted ${result} history recovery entries`);

			oplogClient.close();

			if (result > 0) {
				processOplogItem().catch(e => {
					logger.error(e, 'Error on processOplogItem');
				});
			}
		}
	}

	const changeStream = db.watch();

	changeStream.on('change', async change => {
		if (['update', 'insert'].includes(change.operationType) === false) {
			logger.debug(`Ignoring ${change.operationType} ${change.ns.coll} wrong operation type`);
			return;
		}

		const ns = `${change.ns.db}.${change.ns.coll}`;

		if (metaCollections.includes(ns) === false && metaTrashCollections.includes(ns) === false) {
			logger.debug(`Ignoring ${change.operationType} ${change.ns.coll} wrong collection`);
			return;
		}

		const changeData = _mapFromChangeStreamToChange(change);

		if (changeData == null) {
			logger.debug(`Ignoring ${change.operationType} ${change.ns.coll} wrong data`);
			return;
		}

		try {
			await konsistentChangesCollection.insertOne(changeData);
			processOplogItem().catch(e => {
				logger.error(e, 'Error on processOplogItem');
			});
			logger.debug(`Inserted history entry for ${changeData.meta} ${changeData.type} ${changeData.dataId}`);
		} catch (error) {
			if (error.code === 11000) {
				return;
			}
			logger.error(error, 'Error on insert history entry');
		}
	});

	changeStream.on('error', e => {
		logger.error(e, 'Error on oplog change stream');
	});
}

function _mapFromOplogToChange(doc) {
	const result = {
		_id: doc.ts.getHighBits() * 100000 + doc.ts.getLowBits(),
		data: {},
	};

	const ns = doc.ns.split('.');

	set(result, 'ts', doc.ts);

	if (ns[3] === 'Trash') {
		set(result, 'type', 'delete');
		set(result, 'dataId', doc.o._id);
		set(result, 'updatedBy', doc.o._deletedBy);
		set(result, 'updatedAt', doc.o._deletedAt);
	} else if (doc.op === 'u') {
		set(result, 'type', 'update');
		set(result, 'dataId', doc.o2._id);
		set(result, 'data._id', doc.o2._id);
		if (doc.o?.$set?._updatedBy != null) {
			set(result, 'updatedBy', doc.o.$set._updatedBy);
		}
		if (doc.o?.$set?._updatedAt != null) {
			set(result, 'updatedAt', doc.o.$set._updatedAt);
		}
		if (doc.o.$set != null) {
			Object.entries(doc.o.$set).forEach(([key, value]) => {
				set(result, `data.${key}`, value);
			});
		}

		if (doc.o.$unset != null) {
			Object.entries(doc.o.$unset).forEach(([key]) => {
				set(result, `data.${key}`, null);
			});
		}
	} else if (doc.op === 'i') {
		set(result, 'type', 'create');
		set(result, 'dataId', doc.o._id);
		set(result, 'data._id', doc.o._id);
		if (doc.o?._updatedBy != null) {
			set(result, 'updatedBy', doc.o._updatedBy);
		}
		if (doc.o?._updatedAt != null) {
			set(result, 'updatedAt', doc.o._updatedAt);
		}

		if (doc.o != null) {
			Object.entries(doc.o).forEach(([key, value]) => {
				set(result, `data.${key}`, value);
			});
		}
	}

	const meta = MetaByCollection[ns[Math.min(2, ns.length - 1)]] || MetaByCollection[`data.${ns[2]}`] || MetaByCollection[ns.slice(1).join('.')];

	if (meta == null) {
		logger.error(doc, `Meta not found for collection [${doc.ns}]`);
		return;
	}

	set(result, 'meta', meta.name);

	return result;
}

function _mapFromChangeStreamToChange(change) {
	if (['update', 'insert'].includes(change.operationType) === false) {
		return;
	}
	const result = {
		_id: change.clusterTime.getHighBits() * 100000 + change.clusterTime.getLowBits(),
		data: {},
	};

	set(result, 'ts', change.clusterTime);

	set(result, 'dataId', change.documentKey._id);
	set(result, 'data._id', change.documentKey._id);

	const meta = /Trash$/.test(change.ns.coll) === true ? MetaByCollection[change.ns.coll.replace('.Trash', '')] : MetaByCollection[change.ns.coll];

	if (meta == null) {
		logger.error(change, `Meta not found for collection [${change.ns.coll}]`);
		return;
	}

	set(result, 'meta', meta.name);

	if (/Trash$/.test(change.ns.coll) === true) {
		set(result, 'type', 'delete');
		set(result, 'updatedBy', change.fullDocument._deletedBy);
		set(result, 'updatedAt', change.fullDocument._deletedAt);
		Object.entries(change.fullDocument).forEach(([key, value]) => {
			set(result, `data.${key}`, value);
		});
	} else if (change.operationType === 'update') {
		set(result, 'type', 'update');
		if (change.updateDescription?.updatedFields?._updatedBy != null) {
			set(result, 'updatedBy', change.updateDescription.updatedFields._updatedBy);
		}
		if (change.updateDescription?.updatedFields?._updatedAt != null) {
			set(result, 'updatedAt', change.updateDescription.updatedFields._updatedAt);
		}
		Object.entries(change.updateDescription.updatedFields).forEach(([key, value]) => {
			set(result, `data.${key}`, value);
		});

		change.updateDescription.removedFields.forEach(([key]) => {
			set(result, `data.${key}`, null);
		});
	} else {
		set(result, 'type', 'create');
		if (change.fullDocument?._updatedBy != null) {
			set(result, 'updatedBy', change.fullDocument._updatedBy);
		}
		if (change.fullDocument?._updatedAt != null) {
			set(result, 'updatedAt', change.fullDocument._updatedAt);
		}
		Object.entries(change.fullDocument).forEach(([key, value]) => {
			set(result, `data.${key}`, value);
		});
	}

	return result;
}

async function processOplogItem() {
	if (konsystentJob.running === false) {
		logger.debug('Konsistent processOplogItem is running');
		return;
	}
	konsystentJob.stop();

	const konsistentChangesCollection = db.collection('KonsistentChanges');

	const change = await konsistentChangesCollection.findOneAndUpdate(
		{ processTS: { $exists: false }, processStartTS: { $exists: false }, $or: [{ errorCount: { $exists: false } }, { errorCount: { $gte: 3 } }] },
		{ $set: { processStartTS: new Date() } },
		{ sort: { _id: 1 } },
	);

	if (change?.value == null) {
		logger.debug('No changes to process');
		konsystentJob.start();
		return;
	}

	try {
		const keysToIgnore = ['_updatedAt', '_createdAt', '_deletedAt', '_updatedBy', '_createdBy', '_deletedBy'];

		let startTime = process.hrtime();

		const { _id, type: action, meta: metaName, data, dataId, ts, updatedBy, updatedAt } = change.value;

		// Update relatinos if action was an update
		if (action === 'update') {
			await updateLookupReferences(metaName, dataId, data);

			const totalTime = process.hrtime(startTime);
			logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Update lookup references for ${metaName}`);
		}

		startTime = process.hrtime();

		await processReverseLookups(metaName, dataId, data, action);

		const totalTime = process.hrtime(startTime);
		logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Process reverse lookups for ${metaName}`);

		startTime = process.hrtime();

		// Update documents with relations to this document
		await updateRelationReferences(metaName, action, dataId, data);

		const updateRelationsTime = process.hrtime(startTime);
		logger.debug(`${updateRelationsTime[0]}s ${updateRelationsTime[1] / 1000000}ms => Update relation references for ${metaName}`);

		// Remove some internal data

		// Verify if meta of record was setted to save history
		if (get(Meta, `${metaName}.saveHistory`, false) === true) {
			await createHistory(metaName, action, dataId, omit(data, keysToIgnore), updatedBy, updatedAt, _id);
		}

		await konsistentChangesCollection.updateOne({ _id: _id }, { $set: { processTS: DateTime.local().toJSDate() }, $unset: { processStartTS: 1 } });

		startTime = process.hrtime();
		await saveLastOplogTimestamp(ts);

		const oplogTime = process.hrtime(startTime);
		logger.debug(`${oplogTime[0]}s ${oplogTime[1] / 1000000}ms => Save last oplog timestamp`);

		await processAlertsForOplogItem(metaName, action, _id, data, updatedBy, updatedAt);
	} catch (e) {
		logger.error(e, 'Error on process oplog item');
		await konsistentChangesCollection.updateOne({ _id: change.value._id }, { $set: { processError: e }, $inc: { errorCount: 1 }, $unset: { processStartTS: 1 } });
	}
	konsystentJob.start();
	return setTimeout(processOplogItem, 0);
}

async function saveLastOplogTimestamp(ts) {
	const query = { _id: 'LastProcessedOplog' };

	try {
		const lastProcessedOplog = await db.collection('Konsistent').findOne(query);

		if (lastProcessedOplog == null) {
			return db.collection('Konsistent').insertOne({ _id: 'LastProcessedOplog', ts });
		}

		if (lastProcessedOplog.ts == null || lastProcessedOplog.ts.greaterThan(ts)) {
			return db.collection('Konsistent').updateOne(query, { $set: { ts } });
		}
	} catch (e) {
		logger.error(
			{
				error: e,
			},
			'Error on save last oplog timestamp',
		);
	}
}

async function createHistory(metaName, action, id, data, updatedBy, updatedAt, changeId) {
	// If data is empty or no update data is avaible then abort
	if (Object.keys(data).length === 0 || updatedAt == null || updatedBy == null) {
		return;
	}

	const startTime = process.hrtime();

	const historyData = {};

	const meta = Meta[metaName];

	// Remove fields that is marked to ignore history
	for (let key in data) {
		const value = data[key];
		const field = meta.fields[key];
		if (get(field, 'ignoreHistory', false) !== true) {
			historyData[key] = value;
		}
	}

	// Get history collection
	const history = Collections[`${metaName}.History`];

	// If can't get history collection terminate this method
	if (!history) {
		return logger.error(`Can't get History collection from ${metaName}`);
	}

	const historyQuery = { _id: changeId };

	// Define base data to history
	const historyItem = {
		dataId: id,
		createdAt: updatedAt,
		createdBy: updatedBy,
		data: historyData,
		type: action,
	};

	// Create history!
	try {
		await history.updateOne(historyQuery, { $set: historyItem, $setOnInsert: historyQuery }, { upsert: true });

		const updateTime = process.hrtime(startTime);
		// Log operation to shell
		let log = metaName;

		switch (action) {
			case 'create':
				log = `${updateTime[0]}s ${updateTime[1] / 1000000}ms => Create history to create action over  ${log}`;
				break;
			case 'update':
				log = `${updateTime[0]}s ${updateTime[1] / 1000000}ms => Create history to update action over ${log}`;
				break;
			case 'delete':
				log = `${updateTime[0]}s ${updateTime[1] / 1000000}ms => Create history to delete action over ${log}`;
				break;
		}

		logger.debug(log);
	} catch (e) {
		logger.error(e, 'Error on create history');
	}
}

async function updateRelationReferences(metaName, action, id, data) {
	// Get references from meta
	let relation, relations, relationsFromDocumentName;
	const references = References[metaName];

	// Verify if exists reverse relations
	if (!isObject(references) || !isObject(references.relationsFrom) || Object.keys(references.relationsFrom).length === 0) {
		return;
	}

	// Get model
	let collection = Collections[metaName];

	// If action is delete then get collection trash
	if (action === 'delete') {
		collection = Collections[`${metaName}.Trash`];
	}

	const referencesToUpdate = {};

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
	const record = await collection.findOne({ _id: id });

	// If no record was found log error and abort
	if (!record) {
		return logger.error(`Can't find record ${id} from ${metaName}`);
	}

	// # Iterate over relations to process
	await BluebirdPromise.mapSeries(Object.keys(referencesToUpdate), async referenceDocumentName => {
		relations = referencesToUpdate[referenceDocumentName];
		await BluebirdPromise.mapSeries(relations, async relation => {
			var value;
			const relationLookupMeta = Meta[relation.document];
			// Get lookup id from record
			const lookupId = [];
			if (has(record, `${relation.lookup}._id`)) {
				lookupId.push(get(record, `${relation.lookup}._id`));
			} else if (get(relationLookupMeta, `fields.${relation.lookup}.isList`, false) === true && isArray(record[relation.lookup])) {
				for (value of record[relation.lookup]) {
					if (has(value, '_id')) {
						lookupId.push(value._id);
					}
				}
			}

			// If action is update and the lookup field of relation was updated go to hitory to update old relation
			if (lookupId.length > 0 && action === 'update' && has(data, `${relation.lookup}._id`)) {
				// Try to get history model
				const historyCollection = Collections[`${metaName}.History`];

				if (historyCollection == null) {
					logger.error(`Can't get model for document ${metaName}.History`);
				}

				// Define query of history with data id
				const historyQuery = { dataId: id.toString() };

				// Add condition to get aonly data with changes on lookup field
				historyQuery[`data.${relation.lookup}`] = { $exists: true };

				// And sort DESC to get only last data
				const historyOptions = { sort: { createdAt: -1 } };

				// User findOne to get only one data
				const historyRecord = await historyCollection.findOne(historyQuery, historyOptions);

				// If there are record
				if (historyRecord) {
					// Then get lookupid to execute update on old relation
					let historyLookupId = get(historyRecord, `data.${relation.lookup}._id`);
					if (get(relationLookupMeta, `fields.${relation.lookup}.isList`, false) === true && isArray(historyRecord.data[relation.lookup])) {
						historyLookupId = [];
						for (value of historyRecord.data[relation.lookup]) {
							historyLookupId.push(get(value, '_id'));
						}
					}

					// Execute update on old relation
					historyLookupId = [].concat(historyLookupId);
					await BluebirdPromise.mapSeries(historyLookupId, async historyLookupIdItem => {
						return updateRelationReference(metaName, relation, historyLookupIdItem, action, referenceDocumentName);
					});
				}
			}

			// Execute update of relations into new value
			await BluebirdPromise.mapSeries(lookupId, lookupIdItem => updateRelationReference(metaName, relation, lookupIdItem, action, referenceDocumentName));
		});
	});
}

async function updateRelationReference(metaName, relation, lookupId, action, referenceDocumentName) {
	// Try to get metadata
	let aggregator, e, query;
	const meta = Meta[metaName];

	if (!meta) {
		return logger.error(`Can't get meta of document ${metaName}`);
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
	// const relationMeta = Meta[relation.document];
	const collection = Collections[relation.document];

	// Init update object
	const valuesToUpdate = {
		$set: {},
		$unset: {},
	};

	// Iterate over all aggregators to create the update object
	await BluebirdPromise.mapSeries(Object.keys(relation.aggregators), async fieldName => {
		// Only allow aggregatores with some methods
		aggregator = relation.aggregators[fieldName];
		if (!['count', 'sum', 'min', 'max', 'avg', 'first', 'last', 'addToSet'].includes(aggregator.aggregator)) {
			return;
		}

		const pipeline = [];

		// Init query to aggregate data
		const match = { $match: query };

		pipeline.push(match);

		// Init aggregation object to aggregate all values into one
		const group = {
			$group: {
				_id: null,
				value: {},
			},
		};

		let type = '';

		// If agg is count then use a trick to count records using sum
		if (aggregator.aggregator === 'count') {
			group.$group.value.$sum = 1;
		} else {
			// Get type of aggrated field
			const aggregatorField = Meta[relation.document].fields[aggregator.field.split('.')[0]];
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

		// Wrap aggregate method into an async metero's method

		// Try to execute agg and log error if fails
		try {
			let result = await collection.aggregate(pipeline, { cursor: { batchSize: 1 } }).toArray();

			// If result was an array with one item cotaining a property value
			if (isArray(result) && isObject(result[0]) && result[0].value) {
				// If aggregator is of type money create an object with value and currency
				if (type === 'money') {
					valuesToUpdate.$set[fieldName] = { currency: result[0].currency, value: result[0].value };
				} else {
					// Then add value to update object
					valuesToUpdate.$set[fieldName] = result[0].value;
				}
			} else {
				// Else unset value
				valuesToUpdate.$unset[fieldName] = 1;
			}
		} catch (error) {
			e = error;
			logger.error(e, `Error on aggregate relation ${relation.document} on document ${metaName}: ${e.message}`);
		}
	});

	// Remove $set if empty
	if (Object.keys(valuesToUpdate.$set).length === 0) {
		delete valuesToUpdate.$set;
	}

	// Remove $unset if empty
	if (Object.keys(valuesToUpdate.$unset).length === 0) {
		delete valuesToUpdate.$unset;
	}

	// If no value was defined to set or unset then abort
	if (Object.keys(valuesToUpdate).length === 0) {
		return;
	}

	// Try to get reference model
	const referenceCollection = Collections[referenceDocumentName];
	if (referenceCollection == null) {
		return logger.error(`Can't get model for document ${referenceDocumentName}`);
	}

	// Define a query to udpate records with aggregated values
	const updateQuery = { _id: lookupId };

	// Try to execute update query
	try {
		const affected = await referenceCollection.update(updateQuery, valuesToUpdate);

		// If there are affected records
		if (affected > 0) {
			// Log Status
			logger.info(`∑ ${referenceDocumentName} < ${metaName} (${affected})`);
			// And log all aggregatores for this status
			// for (fieldName in relation.aggregators) {
			Object.entries(relation.aggregators).forEach((fieldName, aggregator) => {
				if (aggregator.field) {
					logger.info(`  ${referenceDocumentName}.${fieldName} < ${aggregator.aggregator} ${metaName}.${aggregator.field}`);
				} else {
					logger.info(`  ${referenceDocumentName}.${fieldName} < ${aggregator.aggregator} ${metaName}`);
				}
			});
		}

		return affected;
	} catch (error1) {
		logger.error(error1, 'Error on updateRelationReference');
	}
}

async function updateLookupReferences(metaName, id, data) {
	// Get references from meta
	let field, fieldName, fields;
	const references = References[metaName];

	// Verify if exists reverse relations
	if (!isObject(references) || size(keys(references.from)) === 0) {
		return;
	}

	// Get model
	const collection = Collections[metaName];

	// Define object to receive only references that have reference fields in changed data
	const referencesToUpdate = {};

	// Get all keys that was updated
	const updatedKeys = Object.keys(data);

	// Iterate over all relations to verify if each relation have fields in changed keys
	for (var referenceDocumentName in references.from) {
		fields = references.from[referenceDocumentName];
		for (fieldName in fields) {
			var key;
			field = fields[fieldName];
			let keysToUpdate = [];
			// Split each key to get only first key of array of paths
			if (size(field.descriptionFields) > 0) {
				for (key of field.descriptionFields) {
					keysToUpdate.push(key.split('.')[0]);
				}
			}

			if (size(field.inheritedFields) > 0) {
				for (key of field.inheritedFields) {
					keysToUpdate.push(key.fieldName.split('.')[0]);
				}
			}

			// Remove duplicated fields, can exists because we splited paths to get only first part
			keysToUpdate = uniq(keysToUpdate);
			// Get only keys that exists in references and list of updated keys
			keysToUpdate = intersection(keysToUpdate, updatedKeys);

			// If there are common fields, add field to list of relations to be processed
			if (keysToUpdate.length > 0) {
				if (!referencesToUpdate[referenceDocumentName]) {
					referencesToUpdate[referenceDocumentName] = {};
				}
				referencesToUpdate[referenceDocumentName][fieldName] = field;
			}
		}
	}

	// If there are 0 relations to process then abort
	if (Object.keys(referencesToUpdate).length === 0) {
		return;
	}

	// Find record with all information, not only udpated data, to can copy all related fields
	const record = await collection.findOne({ _id: id });

	// If no record was found log error and abort
	if (!record) {
		return logger.error(`Can't find record ${id} from ${metaName}`);
	}

	// Iterate over relations to process and iterate over each related field to execute a method to update relations
	await BluebirdPromise.mapSeries(Object.keys(referencesToUpdate), async referenceDocumentName => {
		fields = referencesToUpdate[referenceDocumentName];
		await BluebirdPromise.mapSeries(Object.keys(fields), async fieldName => {
			field = fields[fieldName];
			return updateLookupReference(referenceDocumentName, fieldName, field, record, metaName);
		});
	});
}

async function updateLookupReference(metaName, fieldName, field, record, relatedMetaName) {
	// Try to get related meta
	const meta = Meta[metaName];
	if (!meta) {
		return logger.error(`Meta ${metaName} does not exists`);
	}

	// Try to get related model
	const collection = Collections[metaName];
	if (collection == null) {
		return logger.error(`Model ${metaName} does not exists`);
	}

	// Define field to query and field to update
	const fieldToQuery = `${fieldName}._id`;
	let fieldToUpdate = fieldName;

	// If field is isList then use .$ into field to update
	// to find in arrays and update only one item from array
	if (field.isList === true) {
		fieldToUpdate = `${fieldName}.$`;
	}

	// Define query with record id
	const query = {};
	query[fieldToQuery] = record._id;

	// Init object of data to set
	const updateData = { $set: {} };

	// Add dynamic field name to update into object to update
	updateData.$set[fieldToUpdate] = {};

	// If there are description fields
	if (isArray(field.descriptionFields) && field.descriptionFields.length > 0) {
		// Execute method to copy fields and values using an array of paths

		const descriptionFieldsValue = pick(record, Array.from(new Set(['_id'].concat(field.descriptionFields))));
		merge(updateData.$set[fieldToUpdate], descriptionFieldsValue);
	}

	// If there are inherit fields
	if (isArray(field.inheritedFields) && field.inheritedFields.length > 0) {
		// For each inherited field
		for (var inheritedField of field.inheritedFields) {
			if (['always', 'hierarchy_always'].includes(inheritedField.inherit)) {
				// Get field meta
				var inheritedMetaField = meta.fields[inheritedField.fieldName];

				if (inheritedField.inherit === 'hierarchy_always') {
					if (get(inheritedMetaField, 'type') !== 'lookup' || inheritedMetaField.isList !== true) {
						logger.error(`Not lookup or not isList field ${inheritedField.fieldName} in ${metaName}`);
						continue;
					}
					if (!record[inheritedField.fieldName]) {
						record[inheritedField.fieldName] = [];
					}
					record[inheritedField.fieldName].push({
						_id: record._id,
					});
				}

				// If field is lookup
				if (get(inheritedMetaField, 'type') === 'lookup') {
					// Get model to find record
					const lookupModel = Models[inheritedMetaField.document];

					if (!lookupModel) {
						logger.error(`Document ${inheritedMetaField.document} not found`);
						continue;
					}

					if (has(record, `${inheritedField.fieldName}._id`) || (inheritedMetaField.isList === true && get(record, `${inheritedField.fieldName}.length`) > 0)) {
						var lookupRecord, subQuery;
						if (inheritedMetaField.isList !== true) {
							subQuery = { _id: record[inheritedField.fieldName]._id.valueOf() };

							// Find records
							lookupRecord = lookupModel.findOne(subQuery);

							// If no record found log error
							if (!lookupRecord) {
								logger.error(
									`Record not found for field ${inheritedField.fieldName} with _id [${subQuery._id}] on document [${inheritedMetaField.document}] not found`,
								);
								continue;
							}

							// Else copy description fields
							if (isArray(inheritedMetaField.descriptionFields)) {
								if (!updateData.$set[inheritedField.fieldName]) {
									updateData.$set[inheritedField.fieldName] = {};
								}

								const descriptionFieldsValue = pick(lookupRecord, Array.from(new Set(['_id'].concat(inheritedMetaField.descriptionFields))));
								merge(updateData.$set[inheritedField.fieldName], descriptionFieldsValue);
							}

							// End copy inherited values
							if (isArray(inheritedMetaField.inheritedFields)) {
								for (let inheritedMetaFieldItem of inheritedMetaField.inheritedFields) {
									if (inheritedMetaFieldItem.inherit === 'always') {
										updateData.$set[inheritedMetaFieldItem.fieldName] = lookupRecord[inheritedMetaFieldItem.fieldName];
									}
								}
							}
						} else if (get(record, `${inheritedField.fieldName}.length`, 0) > 0) {
							let ids = record[inheritedField.fieldName].map(item => item._id);
							ids = compact(uniq(ids));
							subQuery = {
								_id: {
									$in: ids,
								},
							};

							const subOptions = {};
							if (isArray(inheritedMetaField.descriptionFields)) {
								subOptions.projection = inheritedMetaField.descriptionFields.reduce((obj, item) => {
									const key = item.split('.')[0];
									if (obj[key] == null) {
										obj[key] = 1;
									}
									return obj;
								}, {});
							}

							// Find records
							const lookupRecords = await lookupModel.find(subQuery, subOptions).toArray();
							const lookupRecordsById = lookupRecords.reduce((obj, item) => {
								obj[item._id] = item;
								return obj;
							}, {});

							record[inheritedField.fieldName].forEach(function (item) {
								lookupRecord = lookupRecordsById[item._id];

								// If no record found log error
								if (!lookupRecord) {
									logger.error(
										`Record not found for field ${inheritedField.fieldName} with _id [${item._id}] on document [${inheritedMetaField.document}] not found`,
									);
									return;
								}

								// Else copy description fields
								if (isArray(inheritedMetaField.descriptionFields)) {
									const tempValue = pick(lookupRecord, Array.from(new Set(['_id'].concat(inheritedMetaField.descriptionFields))));
									if (updateData.$set[inheritedField.fieldName] == null) {
										updateData.$set[inheritedField.fieldName] = [];
									}
									return updateData.$set[inheritedField.fieldName].push(tempValue);
								}
							});
						}
					}
				} else {
					// Copy data into object to update if inherit method is 'always'
					updateData.$set[inheritedField.fieldName] = record[inheritedField.fieldName];
				}
			}
		}
	}

	try {
		// Execute update and get affected records
		const updateResult = await collection.updateMany(query, updateData);

		// If there are affected records then log
		if (updateResult.modifiedCount > 0) {
			logger.debug(`🔗 ${relatedMetaName} > ${metaName}.${fieldName} (${updateResult.modifiedCount})`);
		}

		return updateResult.modifiedCount;
	} catch (e) {
		logger.error(e, 'Error updating lookup reference');
	}
}

async function processReverseLookups(metaName, id, data, action) {
	let field;
	if (action === 'delete') {
		return;
	}

	const meta = Meta[metaName];
	const collection = Collections[metaName];

	let reverseLookupCount = 0;
	for (var fieldName in meta.fields) {
		field = meta.fields[fieldName];
		if (field.type === 'lookup' && !field.reverseLookup && data[field.name] !== undefined) {
			reverseLookupCount++;
		}
	}

	if (reverseLookupCount === 0) {
		return;
	}

	// Get all data to copty into lookups
	const query = { _id: id };

	const record = await collection.findOne(query);

	if (!record) {
		return logger.error(`Record not found with _id [${id.valueOf()}] on document [${metaName}]`);
	}

	// Process reverse lookups
	await BluebirdPromise.mapSeries(Object.keys(meta.fields), async fieldName => {
		field = meta.fields[fieldName];
		if (field.type === 'lookup' && field.reverseLookup) {
			let reverseLookupQuery, reverseLookupUpdate;

			const reverseLookupMeta = Meta[field.document];

			if (reverseLookupMeta == null) {
				logger.error(`Meta [${field.document}] not found`);
				return;
			}

			if (reverseLookupMeta.fields[field.reverseLookup] == null) {
				logger.error(`Field [${field.reverseLookup}] does not exists in [${field.document}]`);
				return;
			}

			const reverseLookupCollection = Collections[field.document];

			// Mount query and update to remove reverse lookup from another records
			if (data[field.name] !== undefined) {
				reverseLookupQuery = {};

				if (data[field.name]) {
					reverseLookupQuery._id = { $ne: data[field.name]._id };
				}

				reverseLookupQuery[`${field.reverseLookup}._id`] = id;

				reverseLookupUpdate = { $unset: {} };
				reverseLookupUpdate.$unset[field.reverseLookup] = 1;

				if (reverseLookupMeta.fields[field.reverseLookup].isList === true) {
					delete reverseLookupUpdate.$unset;
					reverseLookupUpdate.$pull = {};
					reverseLookupUpdate.$pull[`${field.reverseLookup}`] = { _id: id };
				}

				const updateResult = await reverseLookupCollection.updateMany(reverseLookupQuery, reverseLookupUpdate);

				if (updateResult.modifiedCount > 0) {
					logger.info(`∞ ${field.document}.${field.reverseLookup} - ${metaName} (${updateResult.modifiedCount})`);
				}
			}

			// Create fake empty record to be populated with lookup detail fields and inherited fields
			if (data[field.name]) {
				const value = {};
				value[field.reverseLookup] = { _id: id };

				await copyDescriptionAndInheritedFields(
					reverseLookupMeta.fields[field.reverseLookup],
					value[field.reverseLookup],
					record,
					reverseLookupMeta,
					action,
					reverseLookupCollection,
					value,
					value,
					[data[field.name]._id],
				);

				// Mount query and update to create the reverse lookup
				reverseLookupQuery = { _id: data[field.name]._id };

				reverseLookupUpdate = { $set: value };

				// If reverse lookup is list then add lookup to array and set inherited fields
				if (reverseLookupMeta.fields[field.reverseLookup].isList === true) {
					reverseLookupUpdate.$push = {};
					reverseLookupUpdate.$push[field.reverseLookup] = reverseLookupUpdate.$set[field.reverseLookup];
					delete reverseLookupUpdate.$set[field.reverseLookup];
					if (Object.keys(reverseLookupUpdate.$set).length === 0) {
						delete reverseLookupUpdate.$set;
					}
				}

				const reverseUpdateResult = await reverseLookupCollection.updateMany(reverseLookupQuery, reverseLookupUpdate);

				if (reverseUpdateResult.modifiedCount > 0) {
					logger.info(`∞ ${field.document}.${field.reverseLookup} < ${metaName} (${reverseUpdateResult.modifiedCount})`);
				}
			}
		}
	});
}

async function processAlertsForOplogItem(metaName, action, _id, data, updatedBy, updatedAt) {
	let field, userRecords, value;
	if (!updatedBy) {
		return;
	}

	if (!updatedAt) {
		return;
	}

	if (data._merge) {
		return;
	}

	const meta = Meta[metaName];

	if (!meta) {
		return logger.error(`Can't get meta for ${metaName}`);
	}

	if (meta.sendAlerts !== true) {
		return;
	}

	const collection = Collections[metaName];

	if (collection == null) {
		return logger.error(`Can't get model for ${metaName}`);
	}

	const userCollection = Collections['User'];

	if (userCollection == null) {
		return logger.error("Can't get model for User");
	}
	const startTime = process.hrtime();
	let { code } = data;
	const usersToFindEmail = [];
	let users = [];
	if (data._user) {
		users = users.concat(data._user);
	}

	if (action === 'update') {
		const query = { _id };

		const options = {
			projection: {
				_user: 1,
				code: 1,
			},
		};

		const updatedRecord = await collection.findOne(query, options);
		({ code } = updatedRecord);
		if (updatedRecord._user) {
			users = users.concat(updatedRecord._user);
		}
	}

	for (var user of users) {
		if (user && user._id !== updatedBy._id) {
			usersToFindEmail.push(user._id);
		}
	}

	if (usersToFindEmail.length === 0) {
		return;
	}

	const userQuery = {
		_id: {
			$in: usersToFindEmail,
		},
		active: true,
	};

	const userOptions = {
		projection: {
			username: 1,
			emails: 1,
			locale: 1,
		},
	};

	try {
		userRecords = await userCollection.find(userQuery, userOptions).toArray();
	} catch (e) {
		logger.error(e, `Error on find users for ${metaName} ${_id}`);
	}

	let actionText = 'Apagado';
	switch (action) {
		case 'create':
			actionText = 'Criado';
			break;
		case 'update':
			actionText = 'Alterado';
			break;
	}

	const excludeKeys = ['_updatedAt', '_updatedBy', '_createdAt', '_createdBy', '_deletedAt', '_deletedBy'];

	// Ignore fields that is marked to ignore history
	for (var key in data) {
		value = data[key];
		field = meta.fields[key];
		if (get(field, 'ignoreHistory') === true) {
			excludeKeys.push(key);
		}
	}

	await BluebirdPromise.mapSeries(userRecords, async user => {
		const rawData = {};
		const dataArray = [];

		for (key in data) {
			value = data[key];
			if (!excludeKeys.includes(key)) {
				if (key === '_id') {
					value = value;
				}

				field = key.split('.')[0];
				field = meta.fields[field];

				rawData[key] = value;

				if (field) {
					dataArray.push({
						field: getLabel(field, user) || key,
						value: formatValue(value, field),
					});
				} else {
					dataArray.push({
						field: getLabel(field, user) || key,
						value,
					});
				}
			}
		}

		if (get(dataArray, 'length') === 0) {
			return;
		}

		const documentName = getLabel(meta, user) || meta.name;

		const alertData = {
			documentName,
			action,
			actionText,
			code,
			_id,
			_updatedBy: updatedBy,
			_updatedAt: updatedAt,
			data: dataArray,
			rawData,
			user,
		};

		if (has(user, 'emails.0.address')) {
			const emailData = {
				from: 'Konecty Alerts <alerts@konecty.com>',
				to: get(user, 'emails.0.address'),
				subject: `[Konecty] Dado em: ${documentName} com code: ${code} foi ${actionText}`,
				template: 'alert.hbs',
				data: alertData,
				type: 'Email',
				status: 'Send',
				discard: true,
			};
			await Collections['Message'].insertOne(emailData);
		}
	});

	const totalTime = process.hrtime(startTime);
	logger.debug(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Process alerts for oplog item for ${metaName}`);
}
