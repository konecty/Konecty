import BluebirdPromise from 'bluebird';
import { MongoClient } from 'mongodb';

import set from 'lodash/set';

import { MetaObject } from '@imports/model/MetaObject';

import { db } from '../database';
import { logger } from '../utils/logger';
import processOplogItem from './processOplogItem';

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

	const metaCollections = Object.values(MetaObject.Meta).map(meta => `${db.databaseName}.${meta.collection}`);
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

	const meta = MetaObject.MetaByCollection[ns[Math.min(2, ns.length - 1)]] || MetaObject.MetaByCollection[`data.${ns[2]}`] || MetaObject.MetaByCollection[ns.slice(1).join('.')];

	if (meta == null) {
		logger.error(doc, `MetaObject.Meta not found for collection [${doc.ns}]`);
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

	const meta = /Trash$/.test(change.ns.coll) === true ? MetaObject.MetaByCollection[change.ns.coll.replace('.Trash', '')] : MetaObject.MetaByCollection[change.ns.coll];

	if (meta == null) {
		logger.error(change, `MetaObject.Meta not found for collection [${change.ns.coll}]`);
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

