/*
 * @TODO test sincrony
 */
import { isEmpty, bind, isObject, isString, uniq, intersection, isArray, compact, has, get, size, keys } from 'lodash';
import { parse } from 'mongodb-uri';

Konsistent = {};
Meta = {};

Konsistent.MetaByCollection = {};
Konsistent.Models = {};
Konsistent.History = {};
Konsistent.References = {};
Konsistent.tailHandle = null;

// Get db name from connection string
const uriObject = parse(process.env.MONGO_URL);
const dbName = uriObject.database;
if (isEmpty(process.env.DISABLE_KONSISTENT) || process.env.DISABLE_KONSISTENT === 'false' || process.env.DISABLE_KONSISTENT === '0') {
	console.log(`[konsistent] === ${dbName} ===`.green);
}

// Define fome keys to remove from saved data in history when data was created or updated
const keysToIgnore = ['_updatedAt', '_createdAt', '_updatedBy', '_createdBy', '_deletedBy', '_deletedBy', '$v'];

// Define collection Konsistent to save last state
Konsistent.Models.Konsistent = new Meteor.Collection('Konsistent');

const CursorDescription = function (collectionName, selector, options) {
	const self = this;
	self.collectionName = collectionName;
	self.selector = Mongo.Collection._rewriteSelector(selector);
	self.options = options || {};
	return self;
};

// Method to init data obervation of all collections with meta.saveHistory equals to true
Konsistent.History.setup = function () {
	if (has(Konsistent, 'History.db')) {
		if (Konsistent.tailHandle) {
			Konsistent.tailHandle.stop();
		}
		Konsistent.History.db.close();
	}

	// Get record that define last processed oplog
	const lastProcessedOplog = Konsistent.Models.Konsistent.findOne({ _id: 'LastProcessedOplog' });

	const metaNames = [];

	for (let metaName in Meta) {
		const meta = Meta[metaName];
		metaNames.push(`${dbName}.${meta.collection}`);
	}

	// Create condition to get oplogs of update and insert types from data collections
	const queryData = {
		op: {
			$in: ['u', 'i'],
		},
		ns: {
			$in: metaNames,
		},
	};

	// Create condition to get oplogs of insert type from trash collections
	const queryTrash = {
		op: 'i',
		ns: {
			$in: metaNames.map(name => name + '.Trash'),
		},
	};

	// Define query with data and trash conditions
	const query = { $or: [queryData, queryTrash] };

	// If there are some saved point add ts condition to get records after these point
	if (has(lastProcessedOplog, 'ts')) {
		query.ts = { $gt: lastProcessedOplog.ts };
	}

	// Connect in local collection and bind callback into meteor fibers
	// MongoInternals.NpmModule.MongoClient.connect process.env.MONGO_OPLOG_URL, Meteor.bindEnvironment (err, db) ->
	// 	if err then throw err

	Konsistent.History.db = new MongoInternals.Connection(process.env.MONGO_OPLOG_URL, { poolSize: 1 });

	// Get oplog native collection
	const collection = Konsistent.History.db.rawCollection('oplog.rs');

	// If there are no ts saved go to db to get last oplog registered
	if (!query.ts) {
		// Turn findOne sync
		const findOne = Meteor.wrapAsync(bind(collection.findOne, collection));

		// find last oplog record and get only ts value
		const lastOplogTimestamp = findOne({}, { projection: { ts: 1 }, sort: { ts: -1 } });

		// If there are return then add ts to oplog observer and save the ts into Konsistent collection
		if (has(lastOplogTimestamp, 'ts')) {
			query.ts = { $gt: lastOplogTimestamp.ts };
			Konsistent.History.saveLastOplogTimestamp(lastOplogTimestamp.ts);
		}
	}

	const cursorDescription = new CursorDescription('oplog.rs', query, { tailable: true });

	Konsistent.tailHandle = Konsistent.History.db.tail(
		cursorDescription,
		Meteor.bindEnvironment(function (doc) {
			// const ns = doc.ns.split('.');
			Konsistent.History.processOplogItem(doc);
		}),
	);
};

// # Define query as tailable to receive insertions
// options =
// 	tailable: true

// # Define a cursor with above query
// global.oplogStream = stream = collection.find(query, options).stream()

// stream.on 'error', Meteor.bindEnvironment (err) ->
// 	if err? then throw err

// stream.on 'data', Meteor.bindEnvironment (doc) ->
// 	if doc?
// 		ns = doc.ns.split '.'

// 		Konsistent.History.processOplogItem doc

// Process each result from tailable cursor bindind into Meteor's fibers
// cursor.each Meteor.bindEnvironment (err, doc) ->
// 	if err? then throw err
// 	if doc?
// 		ns = doc.ns.split '.'

// 		Konsistent.History.processOplogItem doc

// Process each oplog item to verify if there are data to save as history
Konsistent.History.processOplogItem = function (doc) {
	let startTime = process.hrtime();
	// Split ns into array to get db name, meta name and if is a trash collection
	let key, value;
	const ns = doc.ns.split('.');

	// Init detault data
	let { _id } = doc.o;
	let action = 'create';
	const data = doc.o;
	let metaName =
		Konsistent.MetaByCollection[ns[Math.min(2, ns.length - 1)]] || Konsistent.MetaByCollection[`data.${ns[2]}`] || Konsistent.MetaByCollection[ns.slice(1).join('.')];
	if (!metaName) {
		console.log(`Meta not found for collection [${doc.ns}]`);
		return;
	}
	metaName = metaName.name;

	// If opration is an update get _id from o2 and define action as update
	if (doc.op === 'u') {
		({ _id } = doc.o2);
		action = 'update';
	}

	// If there are an property $set then move all fields to main object
	if (data.$set) {
		for (key in data.$set) {
			value = data.$set[key];
			data[key] = value;
		}
	}

	// If there are an property $unset then set fields as null on main object
	if (data.$unset) {
		for (key in data.$unset) {
			value = data.$unset[key];
			data[key] = null;
		}
	}

	// Remove properties $set and $unset that was already copied to main object
	delete data.$set;
	delete data.$unset;

	// Now all values are in main object then get _updatedAt and _updatedBy and set to another variables
	let updatedBy = data._updatedBy;
	let updatedAt = data._updatedAt;

	// If record is from a Trash collection set action as delete and use _deleteAt and By as _updatedAt and By
	if (ns[3] === 'Trash') {
		action = 'delete';
		updatedBy = data._deletedBy;
		updatedAt = data._deletedAt;
	}

	// Update relatinos if action was an update
	if (action === 'update') {
		Konsistent.History.updateLookupReferences(metaName, _id, data);
		if (global.logAllRequests === true) {
			const totalTime = process.hrtime(startTime);
			console.log(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Update lookup references for ${metaName}`.brightMagenta);
		}
	}

	startTime = process.hrtime();

	Konsistent.History.processReverseLookups(metaName, _id, data, action);

	if (global.logAllRequests === true) {
		const totalTime = process.hrtime(startTime);
		console.log(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Process reverse lookups for ${metaName}`.brightMagenta);
	}

	startTime = process.hrtime();

	// Update documents with relations to this document
	Konsistent.History.updateRelationReferences(metaName, action, _id, data);

	if (global.logAllRequests === true) {
		const totalTime = process.hrtime(startTime);
		console.log(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Update relation references for ${metaName}`.brightMagenta);
	}

	// Remove some internal data
	for (key of keysToIgnore) {
		delete data[key];
	}

	// Verify if meta of record was setted to save history
	if (get(Meta, `${metaName}.saveHistory`, false) === true) {
		// Pass data and update information to create history record
		Konsistent.History.createHistory(metaName, action, _id, data, updatedBy, updatedAt, doc);
	}
	startTime = process.hrtime();
	// Save last processed ts
	Konsistent.History.saveLastOplogTimestamp(doc.ts);

	if (global.logAllRequests === true) {
		const totalTime = process.hrtime(startTime);
		console.log(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Save last oplog timestamp`.brightMagenta);
	}

	return Konsistent.History.processAlertsForOplogItem(metaName, action, _id, data, updatedBy, updatedAt);
};

let saveLastOplogTimestampTimout = null;
let saveLastOplogTimestampQueueSize = 0;
const saveLastOplogTimestampSaveDelay = 100;
const saveLastOplogTimestampMaxQueueSize = 1000;
const saveLastOplogTimestampGreaterValue = null;

// Save last processed timestamp into Konsistent collection
Konsistent.History.saveLastOplogTimestamp = function (ts) {
	let saveLastOplogTimestampGratherValue;
	if (!saveLastOplogTimestampGreaterValue || ts.greaterThan(saveLastOplogTimestampGreaterValue)) {
		saveLastOplogTimestampGratherValue = ts;
	}

	const flush = function () {
		const query = { _id: 'LastProcessedOplog' };

		const data = {
			_id: 'LastProcessedOplog',
			ts: saveLastOplogTimestampGratherValue,
		};

		const options = { upsert: true };

		try {
			return Konsistent.Models.Konsistent.update(query, data, options);
		} catch (e) {
			console.error(e);
			return NotifyErrors.notify(
				'SaveLastOplogTimestamp',
				e({
					query,
					data,
					options,
				}),
			);
		}
	};

	saveLastOplogTimestampQueueSize++;
	if (saveLastOplogTimestampTimout) {
		clearTimeout(saveLastOplogTimestampTimout);
	}

	const timeoutFn = function () {
		saveLastOplogTimestampQueueSize = 0;
		return flush();
	};

	saveLastOplogTimestampTimout = setTimeout(Meteor.bindEnvironment(timeoutFn), saveLastOplogTimestampSaveDelay);

	if (saveLastOplogTimestampQueueSize >= saveLastOplogTimestampMaxQueueSize) {
		clearTimeout(saveLastOplogTimestampTimout);
		saveLastOplogTimestampQueueSize = 0;
		return flush();
	}
};

// Method to create a new History using meta, action, old record and new record
Konsistent.History.createHistory = function (metaName, action, id, data, updatedBy, updatedAt, oplogDoc) {
	// If data is empty or no update data is avaible then abort
	if (Object.keys(data).length === 0 || !updatedAt || !updatedBy || data._merge) {
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
	const history = Konsistent.Models[`${metaName}.History`];

	// If can't get history collection terminate this method
	if (!history) {
		return NotifyErrors.notify('SaveLastOplogTimestamp', new Error(`Can't get History collection from ${metaName}`));
	}

	const historyQuery = { _id: oplogDoc.ts.getHighBits() * 100000 + oplogDoc.ts.getLowBits() };

	// Define base data to history
	const historyItem = {
		_id: historyQuery._id,
		dataId: id,
		createdAt: updatedAt,
		createdBy: updatedBy,
		data: historyData,
		type: action,
	};

	// Create history!
	try {
		history.update(historyQuery, historyItem, { upsert: true });
		if (global.logAllRequests === true) {
			const totalTime = process.hrtime(startTime);
			// Log operation to shell
			let log = metaName;

			switch (action) {
				case 'create':
					log = `${totalTime[0]}s ${totalTime[1] / 1000000}ms => Create history to create action over  ${log}`.green;
					break;
				case 'update':
					log = `${totalTime[0]}s ${totalTime[1] / 1000000}ms => Create history to update action over ${log}`.blue;
					break;
				case 'delete':
					log = `${totalTime[0]}s ${totalTime[1] / 1000000}ms => Create history to delete action over ${log}`.red;
					break;
			}

			console.log(log);
		}
	} catch (e) {
		console.error(e);
		NotifyErrors.notify('createHistory', e, {
			historyQuery,
			historyItem,
			upsert: true,
		});
	}
};

// Method to update reverse relations of one record
Konsistent.History.updateRelationReferences = function (metaName, action, id, data) {
	// Get references from meta
	let relation, relations, relationsFromDocumentName;
	const references = Konsistent.References[metaName];

	// Verify if exists reverse relations
	if (!isObject(references) || !isObject(references.relationsFrom) || Object.keys(references.relationsFrom).length === 0) {
		return;
	}

	// Get model
	let model = Konsistent.Models[metaName];

	// If action is delete then get collection trash
	if (action === 'delete') {
		model = Konsistent.Models[`${metaName}.Trash`];
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

				referencedKeys = referencedKeys.concat(utils.getFirstPartOfArrayOfPaths(utils.getTermsOfFilter(relation.filter)));

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
	const record = model.findOne({ _id: id });

	// If no record was found log error to console and abort
	if (!record) {
		return NotifyErrors.notify('updateRelationReferences', new Error(`Can't find record ${id} from ${metaName}`), {
			metaName,
			action,
			id,
			data,
			referencesToUpdate,
		});
	}

	// # Iterate over relations to process
	for (var referenceDocumentName in referencesToUpdate) {
		relations = referencesToUpdate[referenceDocumentName];
		for (relation of relations) {
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
				const historyModel = Konsistent.Models[`${metaName}.History`];

				if (!historyModel) {
					NotifyErrors.notify('updateRelationReferences', new Error(`Can't get model for document ${metaName}.History`));
				}

				// Define query of history with data id
				const historyQuery = { dataId: id.toString() };

				// Add condition to get aonly data with changes on lookup field
				historyQuery[`data.${relation.lookup}`] = { $exists: true };

				// And sort DESC to get only last data
				const historyOptions = { sort: { createdAt: -1 } };

				// User findOne to get only one data
				const historyRecord = historyModel.findOne(historyQuery, historyOptions);

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
					for (let historyLookupIdItem of historyLookupId) {
						Konsistent.History.updateRelationReference(metaName, relation, historyLookupIdItem, action, referenceDocumentName);
					}
				}
			}

			// Execute update of relations into new value
			lookupId.map(lookupIdItem => Konsistent.History.updateRelationReference(metaName, relation, lookupIdItem, action, referenceDocumentName));
		}
	}
};

// Method to udpate documents with references in this document
Konsistent.History.updateRelationReference = function (metaName, relation, lookupId, action, referenceDocumentName) {
	// Try to get metadata
	let aggregator, e, query;
	const meta = Meta[metaName];

	if (!meta) {
		return NotifyErrors.notify('updateRelationReference', new Error(`Can't get meta of document ${metaName}`));
	}

	if (isObject(relation)) {
		relation = JSON.parse(JSON.stringify(relation));
	}

	// Init a query with filter of relation
	if (has(relation, 'filter')) {
		query = filterUtils.parseFilterObject(relation.filter, meta);
	}

	// If no query was setted, then init a empty filter
	if (!query) {
		query = {};
	}
	// Add condition to get only documents with lookup to passaed lookupId
	query[`${relation.lookup}._id`] = lookupId;

	// Get data colletion from native mongodb
	const relationMeta = Meta[relation.document];
	const collection = Konsistent.Models[relation.document]._getCollection();

	// Init update object
	const valuesToUpdate = {
		$set: {},
		$unset: {},
	};

	// Iterate over all aggregators to create the update object
	for (var fieldName in relation.aggregators) {
		// Only allow aggregatores with some methods
		aggregator = relation.aggregators[fieldName];
		if (!['count', 'sum', 'min', 'max', 'avg', 'first', 'last', 'addToSet'].includes(aggregator.aggregator)) {
			continue;
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
		const aggregate = Meteor.wrapAsync(bind(collection.aggregate, collection));

		// Try to execute agg and log error if fails
		try {
			const resultsCursor = aggregate(pipeline, { cursor: { batchSize: 1 } });
			const aggregateToArray = Meteor.wrapAsync(resultsCursor.toArray, resultsCursor);

			let result = aggregateToArray();

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
			NotifyErrors.notify('updateRelationReference', e, {
				pipeline,
			});
		}
	}

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
	const referenceModel = Konsistent.Models[referenceDocumentName];
	if (!referenceModel) {
		return NotifyErrors.notify('updateRelationReference', new Error(`Can't get model for document ${referenceDocumentName}`));
	}

	// Define a query to udpate records with aggregated values
	const updateQuery = { _id: lookupId };

	// Try to execute update query
	try {
		const affected = referenceModel.update(updateQuery, valuesToUpdate);

		// If there are affected records
		if (affected > 0) {
			// Log Status
			console.log(`∑ ${referenceDocumentName} < ${metaName} (${affected})`.yellow);
			// And log all aggregatores for this status
			for (fieldName in relation.aggregators) {
				aggregator = relation.aggregators[fieldName];
				if (aggregator.field) {
					console.log(`  ${referenceDocumentName}.${fieldName} < ${aggregator.aggregator} ${metaName}.${aggregator.field}`.yellow);
				} else {
					console.log(`  ${referenceDocumentName}.${fieldName} < ${aggregator.aggregator} ${metaName}`.yellow);
				}
			}
		}

		return affected;
	} catch (error1) {
		e = error1;
		return NotifyErrors.notify('updateRelationReference', e, {
			updateQuery,
			valuesToUpdate,
		});
	}
};

// Method to update reverse relations of one record
Konsistent.History.updateLookupReferences = function (metaName, id, data) {
	// Get references from meta
	let field, fieldName, fields;
	const references = Konsistent.References[metaName];

	// Verify if exists reverse relations
	if (!isObject(references) || size(keys(references.from)) === 0) {
		return;
	}

	// Get model
	const model = Konsistent.Models[metaName];

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
	const record = model.findOne({ _id: id });

	// If no record was found log error to console and abort
	if (!record) {
		return NotifyErrors.notify('updateLookupReferences', new Error(`Can't find record ${id} from ${metaName}`));
	}

	// Iterate over relations to process and iterate over each related field to execute a method to update relations
	for (referenceDocumentName in referencesToUpdate) {
		fields = referencesToUpdate[referenceDocumentName];
		for (fieldName in fields) {
			field = fields[fieldName];
			Konsistent.History.updateLookupReference(referenceDocumentName, fieldName, field, record, metaName);
		}
	}
};

// Method to update a single field of a single relation from a single updated record
Konsistent.History.updateLookupReference = function (metaName, fieldName, field, record, relatedMetaName) {
	// Try to get related meta
	const meta = Meta[metaName];
	if (!meta) {
		return NotifyErrors.notify('updateLookupReference', new Error(`Meta ${metaName} does not exists`));
	}

	// Try to get related model
	const model = Konsistent.Models[metaName];
	if (!model) {
		return NotifyErrors.notify('updateLookupReference', new Error(`Model ${metaName} does not exists`));
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

	// Define an update of multiple records
	const options = { multi: true };

	// Init object of data to set
	const updateData = { $set: {} };

	// Add dynamic field name to update into object to update
	updateData.$set[fieldToUpdate] = {};

	// If there are description fields
	if (isArray(field.descriptionFields) && field.descriptionFields.length > 0) {
		// Execute method to copy fields and values using an array of paths
		utils.copyObjectFieldsByPathsIncludingIds(record, updateData.$set[fieldToUpdate], field.descriptionFields);
	}

	// If there are inherit fields
	if (isArray(field.inheritedFields) && field.inheritedFields.length > 0) {
		// For each inherited field
		for (var inheritedField of field.inheritedFields) {
			if (['always', 'hierarchy_always'].includes(inheritedField.inherit)) {
				// Get field meta
				var inheritedMetaField = meta.fields[inheritedField.fieldName];

				if (inheritedField.inherit === 'hierarchy_always') {
					// If inherited field not is a lookup our not is list then notify to bugsnag and ignore process
					if (get(inheritedMetaField, 'type') !== 'lookup' || inheritedMetaField.isList !== true) {
						NotifyErrors.notify('updateLookupReference[hierarchy_always]', new Error('Not lookup or not isList'), {
							inheritedMetaField,
							query,
							updateData,
							options,
						});
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
					const lookupModel = Konsistent.Models[inheritedMetaField.document];

					if (!lookupModel) {
						console.log(new Error(`Document ${inheritedMetaField.document} not found`));
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
								console.log(
									new Error(
										`Record not found for field ${inheritedField.fieldName} with _id [${subQuery._id}] on document [${inheritedMetaField.document}] not found`,
									),
								);
								continue;
							}

							// Else copy description fields
							if (isArray(inheritedMetaField.descriptionFields)) {
								if (!updateData.$set[inheritedField.fieldName]) {
									updateData.$set[inheritedField.fieldName] = {};
								}
								utils.copyObjectFieldsByPathsIncludingIds(lookupRecord, updateData.$set[inheritedField.fieldName], inheritedMetaField.descriptionFields);
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
								subOptions.fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind(
									utils.getFirstPartOfArrayOfPaths(inheritedMetaField.descriptionFields).join(','),
								);
							}

							// Find records
							const lookupRecords = lookupModel.find(subQuery, subOptions).fetch();
							var lookupRecordsById = {};
							for (let item of lookupRecords) {
								lookupRecordsById[item._id] = item;
							}

							record[inheritedField.fieldName].forEach(function (item) {
								lookupRecord = lookupRecordsById[item._id];

								// If no record found log error
								if (!lookupRecord) {
									console.log(
										new Error(
											`Record not found for field ${inheritedField.fieldName} with _id [${item._id}] on document [${inheritedMetaField.document}] not found`,
										),
									);
									return;
								}

								// Else copy description fields
								if (isArray(inheritedMetaField.descriptionFields)) {
									const tempValue = {};
									utils.copyObjectFieldsByPathsIncludingIds(lookupRecord, tempValue, inheritedMetaField.descriptionFields);
									if (!updateData.$set[inheritedField.fieldName]) {
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
		const affectedRecordsCount = model.update(query, updateData, { multi: true });

		// If there are affected records then log into console
		if (affectedRecordsCount > 0) {
			console.log(`🔗 ${relatedMetaName} > ${metaName}.${fieldName} (${affectedRecordsCount})`.yellow);
		}

		return affectedRecordsCount;
	} catch (e) {
		console.error(e);
		// Log if update get some error
		NotifyErrors.notify('updateLookupReference', e, {
			query,
			updateData,
			options,
		});
	}
};

// Method to update reverse relations of one record
Konsistent.History.processReverseLookups = function (metaName, id, data, action) {
	let field;
	if (action === 'delete') {
		return;
	}

	const meta = Meta[metaName];
	const model = Konsistent.Models[metaName];

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

	const record = model.findOne(query);

	if (!record) {
		return NotifyErrors.notify('ReverseLoockup Error', new Error(`Record not found with _id [${id.valueOf()}] on document [${metaName}]`));
	}

	// Process reverse lookups
	for (fieldName in meta.fields) {
		field = meta.fields[fieldName];
		if (field.type === 'lookup' && field.reverseLookup) {
			var affectedRecordsCount, reverseLookupQuery, reverseLookupUpdate;

			const reverseLookupMeta = Meta[field.document];

			if (!reverseLookupMeta) {
				NotifyErrors.notify('ReverseLoockup Error', new Error(`Meta [${field.document}] not found`));
				continue;
			}

			if (!reverseLookupMeta.fields[field.reverseLookup]) {
				NotifyErrors.notify('ReverseLoockup Error', new Error(`Field [${field.reverseLookup}] does not exists in [${field.document}]`));
				continue;
			}

			const reverseLookupModel = Konsistent.Models[field.document];

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

				affectedRecordsCount = reverseLookupModel.update(reverseLookupQuery, reverseLookupUpdate, { multi: true });

				if (affectedRecordsCount > 0) {
					console.log(`∞ ${field.document}.${field.reverseLookup} - ${metaName} (${affectedRecordsCount})`.yellow);
				}
			}

			// Create fake empty record to be populated with lookup detail fields and inherited fields
			if (data[field.name]) {
				const value = {};
				value[field.reverseLookup] = { _id: id };

				lookupUtils.copyDescriptionAndInheritedFields(
					reverseLookupMeta.fields[field.reverseLookup],
					value[field.reverseLookup],
					record,
					reverseLookupMeta,
					action,
					reverseLookupModel,
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

				affectedRecordsCount = reverseLookupModel.update(reverseLookupQuery, reverseLookupUpdate, { multi: true });

				if (affectedRecordsCount > 0) {
					console.log(`∞ ${field.document}.${field.reverseLookup} < ${metaName} (${affectedRecordsCount})`.yellow);
				}
			}
		}
	}
};

Konsistent.History.processAlertsForOplogItem = function (metaName, action, _id, data, updatedBy, updatedAt) {
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
		return NotifyErrors.notify('processAlertsForOplogItem', new Error(`Can't get meta for ${metaName}`));
	}

	if (meta.sendAlerts !== true) {
		return;
	}

	const model = Konsistent.Models[metaName];

	if (!model) {
		return NotifyErrors.notify('processAlertsForOplogItem', new Error(`Can't get model for ${metaName}`));
	}

	const userModel = Konsistent.Models['User'];

	if (!userModel) {
		return NotifyErrors.notify('processAlertsForOplogItem', new Error("Can't get model for User"));
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
			fields: {
				_user: 1,
				code: 1,
			},
		};

		const updatedRecord = model.findOne(query, options);
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
		fields: {
			username: 1,
			emails: 1,
			locale: 1,
		},
	};

	try {
		userRecords = userModel.find(userQuery, userOptions).fetch();
	} catch (e) {
		NotifyErrors.notify('updateLookupReference', e, {
			userQuery,
			userOptions,
		});
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

	for (user of userRecords) {
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
						field: utils.getLabel(field, user) || key,
						value: utils.formatValue(value, field),
					});
				} else {
					dataArray.push({
						field: utils.getLabel(field, user) || key,
						value,
					});
				}
			}
		}

		if (get(dataArray, 'length') === 0) {
			continue;
		}

		const documentName = utils.getLabel(meta, user) || meta.name;

		var alertData = {
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

		if (has(Namespace, 'RocketChat.alertWebhook')) {
			var urls = [].concat(Namespace.RocketChat.alertWebhook);
			for (var url of urls) {
				if (!isEmpty(url)) {
					HTTP.post(url, { data: alertData }, function (err, response) {
						if (err) {
							NotifyErrors.notify('HookRocketChatAlertError', err);
							console.log('🚀 ', `Rocket.Chat Alert ERROR ${url}`.red, err);
							return;
						}

						if (response.statusCode === 200) {
							return console.log('🚀 ', `${response.statusCode} Rocket.Chat Alert ${url}`.green);
						} else {
							return console.log('🚀 ', `${response.statusCode} Rocket.Chat Alert ${url}`.red);
						}
					});
				}
			}
		} else if (has(user, 'emails.0.address')) {
			const emailData = {
				from: 'Konecty Alerts <alerts@konecty.com>',
				to: get(user, 'emails.0.address'),
				subject: `[Konecty] Dado em: ${documentName} com code: ${code} foi ${actionText}`,
				template: 'alert.html',
				data: alertData,
				type: 'Email',
				status: 'Send',
				discard: true,
			};
			Konsistent.Models['Message'].insert(emailData);
		}
	}
	if (global.logAllRequests === true) {
		const totalTime = process.hrtime(startTime);
		console.log(`${totalTime[0]}s ${totalTime[1] / 1000000}ms => Process alerts for oplog item for ${metaName}`.brightMagenta);
	}
};
