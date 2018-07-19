###
# @TODO test sincrony
###
mongodbUri = Npm.require 'mongodb-uri'

@Meta = {}
Konsistent.MetaByCollection = {}
Konsistent.Models = {}
Konsistent.History = {}
Konsistent.References = {}
Konsistent.tailHandle = null

# Get db name from connection string
uri = mongodbUri.parse process.env.MONGO_URL
dbName = uri.database
if _.isEmpty(process.env.DISABLE_KONSISTENT) or process.env.DISABLE_KONSISTENT is 'false' or process.env.DISABLE_KONSISTENT is '0'
	console.log "[konsistent] === #{dbName} ===".green

# Define fome keys to remove from saved data in history when data was created or updated
keysToIgnore = ['_updatedAt', '_createdAt', '_updatedBy', '_createdBy', '_deletedBy', '_deletedBy']

# Define collection Konsistent to save last state
Konsistent.Models.Konsistent = new Meteor.Collection "Konsistent"

CursorDescription = (collectionName, selector, options) ->
  self = this;
  self.collectionName = collectionName;
  self.selector = Mongo.Collection._rewriteSelector(selector);
  self.options = options || {};
  return self


# Method to init data obervation of all collections with meta.saveHistory equals to true
Konsistent.History.setup = ->
	if Konsistent.History?.db?
		Konsistent.tailHandle?.stop()
		Konsistent.History.db.close()

	# Get record that define last processed oplog
	lastProcessedOplog = Konsistent.Models.Konsistent.findOne _id: 'LastProcessedOplog'

	metaNames = []

	for metaName, meta of Meta
		metaNames.push "#{dbName}.#{meta.collection}"

	# Create condition to get oplogs of update and insert types from data collections
	queryData =
		op: $in: ['u', 'i']
		ns: $in: metaNames

	# Create condition to get oplogs of insert type from trash collections
	queryTrash =
		op: 'i'
		ns: $in: metaNames.map (name) -> name + '.Trash'

	# Define query with data and trash conditions
	query =
		$or: [queryData, queryTrash]

	# If there are some saved point add ts condition to get records after these point
	if lastProcessedOplog?.ts?
		query.ts = $gt: lastProcessedOplog.ts

	# Connect in local collection and bind callback into meteor fibers
	# MongoInternals.NpmModule.MongoClient.connect process.env.MONGO_OPLOG_URL, Meteor.bindEnvironment (err, db) ->
	# 	if err then throw err

	Konsistent.History.db = new MongoInternals.Connection(process.env.MONGO_OPLOG_URL, { poolSize: 1 });

	# Get oplog native collection
	collection = Konsistent.History.db.rawCollection 'oplog.rs'

	# If there are no ts saved go to db to get last oplog registered
	if not query.ts?
		# Turn findOne sync
		findOne = Meteor.wrapAsync _.bind collection.findOne, collection

		# find last oplog record and get only ts value
		lastOplogTimestamp = findOne {}, {ts: 1}, {sort: {ts: -1}}

		# If there are return then add ts to oplog observer and save the ts into Konsistent collection
		if lastOplogTimestamp?.ts?
			query.ts = $gt: lastOplogTimestamp.ts
			Konsistent.History.saveLastOplogTimestamp lastOplogTimestamp.ts

	cursorDescription = new CursorDescription('oplog.rs', query, {tailable: true});

	Konsistent.tailHandle = Konsistent.History.db.tail(cursorDescription, Meteor.bindEnvironment((doc) ->
		ns = doc.ns.split '.'
		Konsistent.History.processOplogItem doc
	))

	# # Define query as tailable to receive insertions
	# options =
	# 	tailable: true

	# # Define a cursor with above query
	# global.oplogStream = stream = collection.find(query, options).stream()

	# stream.on 'error', Meteor.bindEnvironment (err) ->
	# 	if err? then throw err

	# stream.on 'data', Meteor.bindEnvironment (doc) ->
	# 	if doc?
	# 		ns = doc.ns.split '.'

	# 		Konsistent.History.processOplogItem doc

	# Process each result from tailable cursor bindind into Meteor's fibers
	# cursor.each Meteor.bindEnvironment (err, doc) ->
	# 	if err? then throw err
	# 	if doc?
	# 		ns = doc.ns.split '.'

	# 		Konsistent.History.processOplogItem doc


# Process each oplog item to verify if there are data to save as history
Konsistent.History.processOplogItem = (doc) ->
	# Split ns into array to get db name, meta name and if is a trash collection
	ns = doc.ns.split '.'

	# Init detault data
	_id = doc.o._id
	action = 'create'
	data = doc.o
	metaName = Konsistent.MetaByCollection[ns[Math.min(2, ns.length - 1)]] or Konsistent.MetaByCollection["data.#{ns[2]}"] or Konsistent.MetaByCollection[ns.slice(1).join('.')]
	metaName = metaName.name

	# If opration is an update get _id from o2 and define action as update
	if doc.op is 'u'
		_id = doc.o2._id
		action = 'update'

	# If there are an property $set then move all fields to main object
	if data.$set?
		for key, value of data.$set
			data[key] = value

	# If there are an property $unset then set fields as null on main object
	if data.$unset?
		for key, value of data.$unset
			data[key] = null

	# Remove properties $set and $unset that was already copied to main object
	delete data.$set
	delete data.$unset

	# Now all values are in main object then get _updatedAt and _updatedBy and set to another variables
	updatedBy = data._updatedBy
	updatedAt = data._updatedAt

	# If record is from a Trash collection set action as delete and use _deleteAt and By as _updatedAt and By
	if ns[3] is 'Trash'
		action = 'delete'
		updatedBy = data._deletedBy
		updatedAt = data._deletedAt

	# Update relatinos if action was an update
	if action is 'update'
		Konsistent.History.updateLookupReferences metaName, _id, data

	Konsistent.History.processReverseLookups metaName, _id, data, action

	# Update documents with relations to this document
	Konsistent.History.updateRelationReferences metaName, action, _id, data

	# Remove some internal data
	for key in keysToIgnore
		delete data[key]

	# Verify if meta of record was setted to save history
	if Meta[metaName]?.saveHistory is true
		# Pass data and update information to create history record
		Konsistent.History.createHistory metaName, action, _id, data, updatedBy, updatedAt, doc

	# Save last processed ts
	Konsistent.History.saveLastOplogTimestamp doc.ts


	Konsistent.History.processAlertsForOplogItem metaName, action, _id, data, updatedBy, updatedAt


saveLastOplogTimestampTimout = null
saveLastOplogTimestampQueueSize = 0
saveLastOplogTimestampSaveDelay = 100
saveLastOplogTimestampMaxQueueSize = 1000
saveLastOplogTimestampGreaterValue = null

# Save last processed timestamp into Konsistent collection
Konsistent.History.saveLastOplogTimestamp = (ts) ->
	if not saveLastOplogTimestampGreaterValue? or ts.greaterThan(saveLastOplogTimestampGreaterValue)
		saveLastOplogTimestampGratherValue = ts

	flush = ->
		query =
			_id: 'LastProcessedOplog'

		data =
			_id: 'LastProcessedOplog'
			ts: saveLastOplogTimestampGratherValue

		options =
			upsert: true

		try
			Konsistent.Models.Konsistent.update query, data, options
		catch e
			console.log e
			NotifyErrors.notify 'SaveLastOplogTimestamp', e {
				query: query
				data: data
				options: options
			}


	saveLastOplogTimestampQueueSize++
	if saveLastOplogTimestampTimout?
		clearTimeout saveLastOplogTimestampTimout

	timeoutFn = ->
		saveLastOplogTimestampQueueSize = 0
		flush()

	saveLastOplogTimestampTimout = setTimeout Meteor.bindEnvironment(timeoutFn), saveLastOplogTimestampSaveDelay

	if saveLastOplogTimestampQueueSize >= saveLastOplogTimestampMaxQueueSize
		clearTimeout saveLastOplogTimestampTimout
		saveLastOplogTimestampQueueSize = 0
		flush()

# Method to create a new History using meta, action, old record and new record
Konsistent.History.createHistory = (metaName, action, id, data, updatedBy, updatedAt, oplogDoc) ->
	# If data is empty or no update data is avaible then abort
	if Object.keys(data).length is 0 or not updatedAt? or not updatedBy? or data._merge?
		return

	historyData = {}

	meta = Meta[metaName]

	# Remove fields that is marked to ignore history
	for key, value of data
		field = meta.fields[key]
		if field?.ignoreHistory isnt true
			historyData[key] = value

	# Log operation to shell
	log = metaName

	switch action
		when 'create'
			log = "+ #{log}".green
		when 'update'
			log = "• #{log}".blue
		when 'delete'
			log = "- #{log}".red

	if global.logAllRequests is true
		console.log log

	# Get history collection
	history = Konsistent.Models["#{metaName}.History"]

	# If can't get history collection terminate this method
	if not history?
		return NotifyErrors.notify 'SaveLastOplogTimestamp', new Error "Can't get History collection from #{metaName}"

	historyQuery =
		_id: oplogDoc.ts.getHighBits() * 100000 + oplogDoc.ts.getLowBits()

	# Define base data to history
	historyItem =
		_id: historyQuery._id
		dataId: id
		createdAt: updatedAt
		createdBy: updatedBy
		data: historyData
		type: action

	# Create history!
	try
		history.update historyQuery, historyItem, {upsert: true}
	catch e
		console.log e
		NotifyErrors.notify 'createHistory', e, {
			historyQuery: historyQuery
			historyItem: historyItem
			upsert: true
		}


# Method to update reverse relations of one record
Konsistent.History.updateRelationReferences = (metaName, action, id, data) ->
	# Get references from meta
	references = Konsistent.References[metaName]

	# Verify if exists reverse relations
	if not _.isObject(references) or not _.isObject(references.relationsFrom) or Object.keys(references.relationsFrom).length is 0
		return

	# Get model
	model = Konsistent.Models[metaName]

	# If action is delete then get collection trash
	if action is 'delete'
		model = Konsistent.Models["#{metaName}.Trash"]

	referencesToUpdate = {}

	# If action is create or delete then update all records with data related in this record
	if action isnt 'update'
		for relationsFromDocumentName, relations of references.relationsFrom
			referencesToUpdate[relationsFromDocumentName] = relations
	# Else update only data when changes in this document affects related aggregation
	else
		# Get all keys that was updated
		updatedKeys = Object.keys data

		# Iterate over all relations to verify if each relation has filter's terms or aggregate's fields in updatedKeys
		for relationsFromDocumentName, relations of references.relationsFrom
			for relation in relations
				referencedKeys = []

				if _.isString relation.lookup
					referencedKeys.push relation.lookup

				referencedKeys = referencedKeys.concat utils.getFirstPartOfArrayOfPaths utils.getTermsOfFilter relation.filter

				for fieldName, aggregator of relation.aggregators
					if aggregator.field?
						referencedKeys.push aggregator.field.split('.')[0]

				# Remove duplicated fields, can exists because we splited paths to get only first part
				referencedKeys = _.uniq referencedKeys
				# Get only keys that exists in references and list of updated keys
				referencedKeys = _.intersection referencedKeys, updatedKeys

				# If there are common fields, add relation to list of relations to be processed
				if referencedKeys.length > 0
					referencesToUpdate[relationsFromDocumentName] ?= []
					referencesToUpdate[relationsFromDocumentName].push relation

	# If there are 0 references to process then abort
	if Object.keys(referencesToUpdate).length is 0
		return

	# Find record with all information, not only udpated data, to calc aggregations
	record = model.findOne _id: id

	# If no record was found log error to console and abort
	if not record?
		return NotifyErrors.notify 'updateRelationReferences', new Error("Can't find record #{id} from #{metaName}"), {
			metaName: metaName
			action: action
			id: id
			data: data
			referencesToUpdate: referencesToUpdate
		}

	# # Iterate over relations to process
	for referenceDocumentName, relations of referencesToUpdate
		for relation in relations
			relationLookupMeta = Meta[relation.document]
			# Get lookup id from record
			lookupId = []
			if record[relation.lookup]?._id?
				lookupId.push record[relation.lookup]?._id
			else if relationLookupMeta.fields[relation.lookup]?.isList is true and _.isArray(record[relation.lookup])
				for value in record[relation.lookup]
					if value?._id?
						lookupId.push value?._id

			# If action is update and the lookup field of relation was updated go to hitory to update old relation
			if lookupId.length > 0 and action is 'update' and data[relation.lookup]?._id?
				# Try to get history model
				historyModel = Konsistent.Models["#{metaName}.History"]

				if not historyModel?
					NotifyErrors.notify 'updateRelationReferences', new Error "Can't get model for document #{metaName}.History"

				# Define query of history with data id
				historyQuery =
					dataId: id.toString()

				# Add condition to get aonly data with changes on lookup field
				historyQuery["data.#{relation.lookup}"] = $exists: true

				# And sort DESC to get only last data
				historyOptions =
					sort: createdAt: -1

				# User findOne to get only one data
				historyRecord = historyModel.findOne historyQuery, historyOptions

				# If there are record
				if historyRecord?
					# Then get lookupid to execute update on old relation
					historyLookupId = historyRecord.data[relation.lookup]?._id
					if relationLookupMeta.fields[relation.lookup]?.isList is true and _.isArray(historyRecord.data[relation.lookup])
						historyLookupId = []
						for value in historyRecord.data[relation.lookup]
							historyLookupId.push value?._id

					# Execute update on old relation
					historyLookupId = [].concat historyLookupId
					for historyLookupIdItem in historyLookupId
						Konsistent.History.updateRelationReference metaName, relation, historyLookupIdItem, action, referenceDocumentName

			# Execute update of relations into new value
			for lookupIdItem in lookupId
				Konsistent.History.updateRelationReference metaName, relation, lookupIdItem, action, referenceDocumentName


# Method to udpate documents with references in this document
Konsistent.History.updateRelationReference = (metaName, relation, lookupId, action, referenceDocumentName) ->
	# Try to get metadata
	meta = Meta[metaName]

	if not meta?
		return NotifyErrors.notify 'updateRelationReference', new Error "Can't get meta of document #{metaName}"

	if _.isObject relation
		relation = JSON.parse JSON.stringify relation

	# Init a query with filter of relation
	if relation?.filter?
		query = filterUtils.parseFilterObject relation.filter, meta

	# If no query was setted, then init a empty filter
	query ?= {}
	# Add condition to get only documents with lookup to passaed lookupId
	query["#{relation.lookup}._id"] = lookupId

	# Get data colletion from native mongodb
	relationMeta = Meta[relation.document]
	collection = Konsistent.Models[relation.document]._getCollection()

	# Init update object
	valuesToUpdate =
		$set: {}
		$unset: {}

	# Iterate over all aggregators to create the update object
	for fieldName, aggregator of relation.aggregators
		# Only allow aggregatores with some methods
		if aggregator.aggregator not in ['count', 'sum', 'min', 'max', 'avg', 'first', 'last', 'addToSet']
			continue

		pipeline = []

		# Init query to aggregate data
		match =
			$match: query

		pipeline.push match

		# Init aggregation object to aggregate all values into one
		group =
			$group:
				_id: null
				value: {}

		type = ''

		# If agg is count then use a trick to count records using sum
		if aggregator.aggregator is 'count'
			group.$group.value.$sum = 1
		else
			# Get type of aggrated field
			aggregatorField = Meta[relation.document].fields[aggregator.field.split('.')[0]]
			type = aggregatorField.type

			# If type is money ensure that field has .value
			if type is 'money' and not /\.value$/.test aggregator.field
				aggregator.field += '.value'

			# And get first occurency of currency
			if type is 'money'
				group.$group.currency =
					$first: "$#{aggregator.field.replace('.value', '.currency')}"

			if type is 'lookup' and aggregator.aggregator is 'addToSet'
				if aggregatorField.isList is true
					pipeline.push $unwind: "$#{aggregator.field}"

				addToSetGroup =
					$group:
						_id: "$#{aggregator.field}._id"
						value:
							$first: "$#{aggregator.field}"

				pipeline.push addToSetGroup

				aggregator.field = 'value'

			# If agg inst count then use agg method over passed agg field
			group.$group.value["$#{aggregator.aggregator}"] = "$#{aggregator.field}"

		pipeline.push group

		# Wrap aggregate method into an async metero's method
		aggregate = Meteor.wrapAsync _.bind collection.aggregate, collection

		# Try to execute agg and log error if fails
		try
			result = aggregate pipeline
			# If result was an array with one item cotaining a property value
			if _.isArray(result) and _.isObject(result[0]) and result[0].value?
				# If aggregator is of type money create an object with value and currency
				if type is 'money'
					valuesToUpdate.$set[fieldName] = {currency: result[0].currency, value: result[0].value}
				else
					# Then add value to update object
					valuesToUpdate.$set[fieldName] = result[0].value
			else
				# Else unset value
				valuesToUpdate.$unset[fieldName] = 1
		catch e
			NotifyErrors.notify 'updateRelationReference', e, {
				pipeline: pipeline
			}

	# Remove $set if empty
	if Object.keys(valuesToUpdate.$set).length is 0
		delete valuesToUpdate.$set

	# Remove $unset if empty
	if Object.keys(valuesToUpdate.$unset).length is 0
		delete valuesToUpdate.$unset

	# If no value was defined to set or unset then abort
	if Object.keys(valuesToUpdate).length is 0
		return

	# Try to get reference model
	referenceModel = Konsistent.Models[referenceDocumentName]
	if not referenceModel?
		return NotifyErrors.notify 'updateRelationReference', new Error "Can't get model for document #{referenceDocumentName}"

	# Define a query to udpate records with aggregated values
	updateQuery =
		_id: lookupId

	# Try to execute update query
	try
		affected = referenceModel.update updateQuery, valuesToUpdate

		# If there are affected records
		if affected > 0
			# Log Status
			console.log "∑ #{referenceDocumentName} < #{metaName} (#{affected})".yellow
			# And log all aggregatores for this status
			for fieldName, aggregator of relation.aggregators
				if aggregator.field?
					console.log "  #{referenceDocumentName}.#{fieldName} < #{aggregator.aggregator} #{metaName}.#{aggregator.field}".yellow
				else
					console.log "  #{referenceDocumentName}.#{fieldName} < #{aggregator.aggregator} #{metaName}".yellow

		return affected
	catch e
		NotifyErrors.notify 'updateRelationReference', e, {
			updateQuery: updateQuery
			valuesToUpdate: valuesToUpdate
		}


# Method to update reverse relations of one record
Konsistent.History.updateLookupReferences = (metaName, id, data) ->
	# Get references from meta
	references = Konsistent.References[metaName]

	# Verify if exists reverse relations
	if not _.isObject(references) or not _.isObject(references.from) or Object.keys(references.from).length is 0
		return

	# Get model
	model = Konsistent.Models[metaName]

	# Define object to receive only references that have reference fields in changed data
	referencesToUpdate = {}

	# Get all keys that was updated
	updatedKeys = Object.keys data

	# Iterate over all relations to verify if each relation have fields in changed keys
	for referenceDocumentName, fields of references.from
		for fieldName, field of fields
			keysToUpdate = []
			# Split each key to get only first key of array of paths
			if field.descriptionFields?.length > 0
				keysToUpdate.push key.split('.')[0] for key in field.descriptionFields

			if field.inheritedFields?.length > 0
				keysToUpdate.push key.fieldName.split('.')[0] for key in field.inheritedFields

			# Remove duplicated fields, can exists because we splited paths to get only first part
			keysToUpdate = _.uniq keysToUpdate
			# Get only keys that exists in references and list of updated keys
			keysToUpdate = _.intersection keysToUpdate, updatedKeys

			# If there are common fields, add field to list of relations to be processed
			if keysToUpdate.length > 0
				referencesToUpdate[referenceDocumentName] ?= {}
				referencesToUpdate[referenceDocumentName][fieldName] = field

	# If there are 0 relations to process then abort
	if Object.keys(referencesToUpdate).length is 0
		return

	# Find record with all information, not only udpated data, to can copy all related fields
	record = model.findOne _id: id

	# If no record was found log error to console and abort
	if not record?
		return NotifyErrors.notify 'updateLookupReferences', new Error "Can't find record #{id} from #{metaName}"

	# Iterate over relations to process and iterate over each related field to execute a method to update relations
	for referenceDocumentName, fields of referencesToUpdate
		for fieldName, field of fields
			Konsistent.History.updateLookupReference referenceDocumentName, fieldName, field, record, metaName


# Method to update a single field of a single relation from a single updated record
Konsistent.History.updateLookupReference = (metaName, fieldName, field, record, relatedMetaName) ->
	# Try to get related meta
	meta = Meta[metaName]
	if not meta?
		return NotifyErrors.notify 'updateLookupReference', new Error "Meta #{metaName} does not exists"

	# Try to get related model
	model = Konsistent.Models[metaName]
	if not model?
		return NotifyErrors.notify 'updateLookupReference', new Error "Model #{metaName} does not exists"

	# Define field to query and field to update
	fieldToQuery = "#{fieldName}._id"
	fieldToUpdate = fieldName

	# If field is isList then use .$ into field to update
	# to find in arrays and update only one item from array
	if field.isList is true
		fieldToUpdate = "#{fieldName}.$"

	# Define query with record id
	query = {}
	query[fieldToQuery] = record._id

	# Define an update of multiple records
	options =
		multi: true

	# Init object of data to set
	updateData =
		$set: {}

	# Add dynamic field name to update into object to update
	updateData.$set[fieldToUpdate] = {}

	# If there are description fields
	if _.isArray(field.descriptionFields) and field.descriptionFields.length > 0
		# Execute method to copy fields and values using an array of paths
		utils.copyObjectFieldsByPathsIncludingIds record, updateData.$set[fieldToUpdate], field.descriptionFields

	# If there are inherit fields
	if _.isArray(field.inheritedFields) and field.inheritedFields.length > 0
		# For each inherited field
		for inheritedField in field.inheritedFields
			if inheritedField.inherit in ['always', 'hierarchy_always']
				# Get field meta
				inheritedMetaField = meta.fields[inheritedField.fieldName]

				if inheritedField.inherit is 'hierarchy_always'
					# If inherited field not is a lookup our not is list then notify to bugsnag and ignore process
					if inheritedMetaField?.type isnt 'lookup' or inheritedMetaField.isList isnt true
						NotifyErrors.notify 'updateLookupReference[hierarchy_always]', new Error('Not lookup or not isList'), {
							inheritedMetaField: inheritedMetaField
							query: query
							updateData: updateData
							options: options
						}
						continue
					record[inheritedField.fieldName] ?= []
					record[inheritedField.fieldName].push
						_id: record._id


				# If field is lookup
				if inheritedMetaField?.type is 'lookup'
					# Get model to find record
					lookupModel = Konsistent.Models[inheritedMetaField.document]

					if not lookupModel?
						console.log new Error "Document #{inheritedMetaField.document} not found"
						continue

					if record[inheritedField.fieldName]?._id? or (inheritedMetaField.isList is true and record[inheritedField.fieldName]?.length > 0)
						if inheritedMetaField.isList isnt true
							subQuery =
								_id: record[inheritedField.fieldName]._id.valueOf()

							# Find records
							lookupRecord = lookupModel.findOne subQuery

							# If no record found log error
							if not lookupRecord?
								console.log new Error "Record not found for field #{inheritedField.fieldName} with _id [#{subQuery._id}] on document [#{inheritedMetaField.document}] not found"
								continue

							# Else copy description fields
							if _.isArray inheritedMetaField.descriptionFields
								updateData.$set[inheritedField.fieldName] ?= {}
								utils.copyObjectFieldsByPathsIncludingIds lookupRecord, updateData.$set[inheritedField.fieldName], inheritedMetaField.descriptionFields

							# End copy inherited values
							if _.isArray inheritedMetaField.inheritedFields
								for inheritedMetaFieldItem in inheritedMetaField.inheritedFields
									if inheritedMetaFieldItem.inherit is 'always'
										updateData.$set[inheritedMetaFieldItem.fieldName] = lookupRecord[inheritedMetaFieldItem.fieldName]

						else if record[inheritedField.fieldName]?.length > 0

							ids = record[inheritedField.fieldName].map (item) -> item._id
							ids = _.compact _.uniq ids
							subQuery =
								_id:
									$in: ids

							subOptions = {}
							if _.isArray inheritedMetaField.descriptionFields
								subOptions.fields = utils.convertStringOfFieldsSeparatedByCommaIntoObjectToFind utils.getFirstPartOfArrayOfPaths(inheritedMetaField.descriptionFields).join(',')

							# Find records
							lookupRecords = lookupModel.find(subQuery, subOptions).fetch()
							lookupRecordsById = {}
							for item in lookupRecords
								lookupRecordsById[item._id] = item

							record[inheritedField.fieldName].forEach (item) ->
								lookupRecord = lookupRecordsById[item._id]

								# If no record found log error
								if not lookupRecord?
									console.log new Error "Record not found for field #{inheritedField.fieldName} with _id [#{item._id}] on document [#{inheritedMetaField.document}] not found"
									return

								# Else copy description fields
								if _.isArray inheritedMetaField.descriptionFields
									tempValue = {}
									utils.copyObjectFieldsByPathsIncludingIds lookupRecord, tempValue, inheritedMetaField.descriptionFields
									updateData.$set[inheritedField.fieldName] ?= []
									updateData.$set[inheritedField.fieldName].push tempValue

				else

					# Copy data into object to update if inherit method is 'always'
					updateData.$set[inheritedField.fieldName] = record[inheritedField.fieldName]

	try
		# Execute update and get affected records
		affectedRecordsCount = model.update query, updateData, options

		# If there are affected records then log into console
		if affectedRecordsCount > 0
			console.log "∞ #{relatedMetaName} > #{metaName}.#{fieldName} (#{affectedRecordsCount})".yellow

		return affectedRecordsCount
	catch e
		# Log if update get some error
		NotifyErrors.notify 'updateLookupReference', e, {
			query: query
			updateData: updateData
			options: options
		}


# Method to update reverse relations of one record
Konsistent.History.processReverseLookups = (metaName, id, data, action) ->
	if action is 'delete'
		return

	meta = Meta[metaName]
	model = Konsistent.Models[metaName]

	reverseLookupCount = 0
	for fieldName, field of meta.fields when field.type is 'lookup' and field.reverseLookup? and data[field.name] isnt undefined
		reverseLookupCount++

	if reverseLookupCount is 0
		return

	# Get all data to copty into lookups
	query =
		_id: id

	record = model.findOne query

	if not record?
		return NotifyErrors.notify 'ReverseLoockup Error', new Error "Record not found with _id [#{id.valueOf()}] on document [#{metaName}]"

	# Process reverse lookups
	for fieldName, field of meta.fields when field.type is 'lookup' and field.reverseLookup?
		reverseLookupMeta = Meta[field.document]

		if not reverseLookupMeta?
			NotifyErrors.notify 'ReverseLoockup Error', new Error "Meta [#{field.document}] not found"
			continue

		if not reverseLookupMeta.fields[field.reverseLookup]?
			NotifyErrors.notify 'ReverseLoockup Error', new Error "Field [#{field.reverseLookup}] does not exists in [#{field.document}]"
			continue

		reverseLookupModel = Konsistent.Models[field.document]

		# Mount query and update to remove reverse lookup from another records
		if data[field.name] isnt undefined
			reverseLookupQuery = {}

			if data[field.name]?
				reverseLookupQuery._id = $ne: data[field.name]._id

			reverseLookupQuery["#{field.reverseLookup}._id"] = id

			reverseLookupUpdate = $unset: {}
			reverseLookupUpdate.$unset[field.reverseLookup] = 1

			if reverseLookupMeta.fields[field.reverseLookup].isList is true
				delete reverseLookupUpdate.$unset
				reverseLookupUpdate.$pull = {}
				reverseLookupUpdate.$pull["#{field.reverseLookup}"] = _id: id

			options =
				multi: true

			affectedRecordsCount = reverseLookupModel.update reverseLookupQuery, reverseLookupUpdate, options

			if affectedRecordsCount > 0
				console.log "∞ #{field.document}.#{field.reverseLookup} - #{metaName} (#{affectedRecordsCount})".yellow

		# Create fake empty record to be populated with lookup detail fields and inherited fields
		if data[field.name]?
			value = {}
			value[field.reverseLookup] =
				_id: id

			lookupUtils.copyDescriptionAndInheritedFields reverseLookupMeta.fields[field.reverseLookup], value[field.reverseLookup], record, reverseLookupMeta, action, reverseLookupModel, value, value, [data[field.name]._id]

			# Mount query and update to create the reverse lookup
			reverseLookupQuery =
				_id: data[field.name]._id

			reverseLookupUpdate = $set: value

			# If reverse lookup is list then add lookup to array and set inherited fields
			if reverseLookupMeta.fields[field.reverseLookup].isList is true
				reverseLookupUpdate.$push = {}
				reverseLookupUpdate.$push[field.reverseLookup] = reverseLookupUpdate.$set[field.reverseLookup]
				delete reverseLookupUpdate.$set[field.reverseLookup]
				if Object.keys(reverseLookupUpdate.$set).length is 0
					delete reverseLookupUpdate.$set

			affectedRecordsCount = reverseLookupModel.update reverseLookupQuery, reverseLookupUpdate

			if affectedRecordsCount > 0
				console.log "∞ #{field.document}.#{field.reverseLookup} < #{metaName} (#{affectedRecordsCount})".yellow


Konsistent.History.processAlertsForOplogItem = (metaName, action, _id, data, updatedBy, updatedAt) ->
	if not updatedBy?
		return

	if not updatedAt?
		return

	if data._merge?
		return

	meta = Meta[metaName]

	if not meta?
		return NotifyErrors.notify 'processAlertsForOplogItem', new Error "Can't get meta for #{metaName}"

	if meta.sendAlerts isnt true
		return

	model = Konsistent.Models[metaName]

	if not model?
		return NotifyErrors.notify 'processAlertsForOplogItem', new Error "Can't get model for #{metaName}"

	userModel = Konsistent.Models['User']

	if not userModel?
		return NotifyErrors.notify 'processAlertsForOplogItem', new Error 'Can\'t get model for User'

	code = data.code
	usersToFindEmail = []
	users = []
	users = users.concat data._user if data._user?

	if action is 'update'
		query =
			_id: _id

		options =
			fields:
				_user: 1
				code: 1

		updatedRecord = model.findOne query, options
		code = updatedRecord.code
		users = users.concat updatedRecord._user if updatedRecord._user?

	for user in users
		if user? and user._id isnt updatedBy._id
			usersToFindEmail.push user._id

	if usersToFindEmail.length is 0
		return

	userQuery =
		_id: $in: usersToFindEmail
		active: true

	userOptions =
		fields:
			username: 1
			emails: 1
			locale: 1

	try
		userRecords = userModel.find(userQuery, userOptions).fetch()
	catch e
		NotifyErrors.notify 'updateLookupReference', e, {
			userQuery: userQuery
			userOptions: userOptions
		}

	actionText = 'Apagado'
	switch action
		when 'create'
			actionText = 'Criado'
		when 'update'
			actionText = 'Alterado'

	excludeKeys = ['_updatedAt', '_updatedBy', '_createdAt', '_createdBy', '_deletedAt', '_deletedBy']

	# Ignore fields that is marked to ignore history
	for key, value of data
		field = meta.fields[key]
		if field?.ignoreHistory is true
			excludeKeys.push key

	for user in userRecords
		rawData = {}
		dataArray = []

		for key, value of data when key not in excludeKeys
			if key is '_id'
				value = value

			field = key.split('.')[0]
			field = meta.fields[field]

			rawData[key] = value

			if field?
				dataArray.push
					field: utils.getLabel(field, user) or key
					value: utils.formatValue value, field
			else
				dataArray.push
					field: utils.getLabel(field, user) or key
					value: value

		if dataArray?.length is 0
			continue

		documentName = utils.getLabel(meta, user) or meta.name

		alertData =
			documentName: documentName
			action: action
			actionText: actionText
			code: code
			_id: _id
			_updatedBy: updatedBy
			_updatedAt: updatedAt
			data: dataArray
			rawData: rawData
			user: user

		if Namespace.RocketChat?.alertWebhook?
			urls = [].concat Namespace.RocketChat.alertWebhook
			for url in urls when not _.isEmpty url
				HTTP.post url, { data: alertData }, (err, response) ->
					if err?
						NotifyErrors.notify 'HookRocketChatAlertError', err
						return console.log "📠 ", "Rocket.Chat Alert ERROR #{url}".red, err

					if response.statusCode is 200
						console.log "📠 ", "#{response.statusCode} Rocket.Chat Alert #{url}".green
					else
						console.log "📠 ", "#{response.statusCode} Rocket.Chat Alert #{url}".red

		else if user.emails?[0]?.address?
			emailData =
				from: 'Konecty Alerts <alerts@konecty.com>'
				to: user.emails?[0]?.address
				subject: "[Konecty] Dado em: #{documentName} com code: #{code} foi #{actionText}"
				template: 'alert.html'
				data: alertData
				type: 'Email'
				status: 'Send'
				discard: true

			Konsistent.Models['Message'].insert emailData
