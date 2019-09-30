import { registerFirstUser, registerFirstGroup } from './initialData'

@Meta = {}
@DisplayMeta = {}
@Access = {}
@References = {}
@Namespace = {}

dropAllIndexes = false
overwriteExitingIndexes = false
logIndexActionEnable = false

logIndexAction = (msg) ->
	if logIndexActionEnable is true
		console.log msg

getIndexes = (collectionName) ->
	collection = Models[collectionName]._getCollection()
	indexInformation = Meteor.wrapAsync _.bind(collection.indexInformation, collection)
	return indexInformation()

rebuildReferences = ->
	console.log '[kondata] Rebuilding references'
	global.References = {}

	for metaName, meta of Meta
		for fieldName, field of meta.fields
			if field.type is 'lookup'
				References[field.document] ?= {from: {}}
				References[field.document].from[metaName] ?= {}
				References[field.document].from[metaName][fieldName] =
					type: field.type
					field: fieldName
					isList: field.isList
					descriptionFields: field.descriptionFields
					detailFields: field.detailFields

tryEnsureIndex = (model, fields, options) ->
	try
		model._ensureIndex fields, options
	catch e
		if overwriteExitingIndexes and e.toString().indexOf('already exists with different options') isnt -1
			logIndexAction "Overwriting index: #{JSON.stringify(fields)}".yellow
			model._dropIndex fields
			model._ensureIndex fields, options
		else
			console.log 'Index Error: '.red, e

initialData = _.debounce(Meteor.bindEnvironment( ->
	registerFirstUser()
	registerFirstGroup()
), 2000)

registerMeta = (meta) ->
	meta.collection ?= "data.#{meta.name}"
	Meta[meta.name] = meta

	if meta.type is 'document'
		meta.fields._merge =
			name: '_merge'
			type: 'text'
			isList: true

	unless Models[meta.name]
		Models["#{meta.name}.Comment"] = new Meteor.Collection "#{meta.collection}.Comment"
		Models["#{meta.name}.History"] = new Meteor.Collection "#{meta.collection}.History"
		Models["#{meta.name}.Trash"] = new Meteor.Collection "#{meta.collection}.Trash"
		Models["#{meta.name}.AutoNumber"] = new Meteor.Collection "#{meta.collection}.AutoNumber"

		switch meta.collection
			when 'users'
				Models[meta.name] = Meteor.users
			else
				Models[meta.name] = new Meteor.Collection meta.collection

		Meteor.publish "data.#{meta.name}", (filter, limit) ->
			return @ready() unless @userId?

			unless filter
				filter = {}
			return Models[meta.name].find filter, {limit: limit or 30}

		# Meteor.publish "data.#{meta.name}.History", (limit) ->
		# 	return @ready() unless @userId?
		# 	return Models["#{meta.name}.History"].find {}, {limit: limit or 30}

		Meteor.publish "data.#{meta.name}.History", (filter, limit) ->
			return @ready() unless @userId?

			unless filter
				filter = {}
			return Models["#{meta.name}.History"].find filter, {limit: limit or 30}

		dropIndexes = ->
			# Drop data indexes
			indexesInformation = getIndexes meta.name
			if indexesInformation?
				for indexInformation, value of indexesInformation when indexInformation isnt '_id_'
					logIndexAction "Drop Index at #{meta.collection}: #{indexInformation}".red
					Models[meta.name]._dropIndex indexInformation

			# Drop comment indexes
			indexesInformation = getIndexes "#{meta.name}.Comment"
			if indexesInformation?
				for indexInformation, value of indexesInformation when indexInformation isnt '_id_'
					logIndexAction "Drop Index at #{meta.collection}.Comment: #{indexInformation}".red
					Models["#{meta.name}.Comment"]._dropIndex indexInformation

			# Drop history indexes
			indexesInformation = getIndexes "#{meta.name}.History"
			if indexesInformation?
				for indexInformation, value of indexesInformation when indexInformation isnt '_id_'
					logIndexAction "Drop Index at #{meta.collection}.History: #{indexInformation}".red
					Models["#{meta.name}.History"]._dropIndex indexInformation

		processIndexes = ->
			# Drop all indexes of meta
			if dropAllIndexes is true
				dropIndexes()

			# Create index for TTL in ActiveSessions
			if meta.name is 'ActiveSessions'
				fieldName = 'expireAt'
				fields = {}
				fields[fieldName] = 1

				logIndexAction "Ensure Index at #{meta.collection}: #{fieldName}".green
				tryEnsureIndex Models[meta.name], fields, {name: fieldName, expireAfterSeconds: 60}

			# Create indexes for history collections
			historyIndexes = ['dataId', 'createdAt']
			for historyIndex in historyIndexes
				fields = {}
				fields[historyIndex] = 1

				logIndexAction "Ensure Index at #{meta.collection}.History: #{historyIndex}".green
				tryEnsureIndex Models["#{meta.name}.History"], fields, {name: historyIndex}

			# Create indexes for comment collections
			commentIndexes = ['dataId', '_createdAt']
			for commentIndex in commentIndexes
				fields = {}
				fields[commentIndex] = 1

				logIndexAction "Ensure Index at #{meta.collection}.Comment: #{commentIndex}".green
				tryEnsureIndex Models["#{meta.name}.Comment"], fields, {name: commentIndex}

			# Create indexes for each field that is sortable
			for fieldName, field of meta.fields when field.type not in ['richText', 'composite']
				if field.isSortable is true or field.isUnique is true or field.type in ['lookup', 'address', 'autoNumber']
					subFields = ['']

					switch field.type
						when 'lookup'
							subFields = ['._id']
						when 'email'
							subFields = ['.address']
						when 'money'
							subFields = ['.value']
						when 'personName'
							subFields = ['.full']
						when 'phone'
							subFields = ['.phoneNumber', '.countryCode']
						when 'address'
							subFields = ['.country', '.state', '.city', '.district', '.place', '.number', '.complement', '.postalCode', '.placeType']


					options =
						unique: 0
						name: fieldName

					if field.type is 'autoNumber' or field.isUnique is true
						options.unique = 1

					if field.isUnique is true and field.isRequired isnt true
						options.sparse = 1

					if field.name in ['username', 'emails'] and meta.name is 'User'
						options.unique = 1
						options.sparse = 1

					fields = {}

					for subField in subFields
						fields[fieldName + subField] = 1

					logIndexAction "Ensure Index at #{meta.collection}: #{fieldName}".green
					tryEnsureIndex Models[meta.name], fields, options

			# Create indexes for internal fields
			metaDefaultIndexes = ['_user._id', '_user.group._id', '_updatedAt', '_updatedBy._id', '_createdAt', '_createdBy._id']
			for metaDefaultIndex in metaDefaultIndexes
				fields = {}
				fields[metaDefaultIndex] = 1

				logIndexAction "Ensure Index at #{meta.collection}: #{metaDefaultIndex}".green
				tryEnsureIndex Models[meta.name], fields, {name: metaDefaultIndex}

			# Create indexes defined in meta
			if _.isObject(meta.indexes) and not _.isArray(meta.indexes) and Object.keys(meta.indexes).length > 0
				for indexName, index of meta.indexes
					index.keys ?= {}
					index.options ?= {}
					index.options.name ?= indexName

					logIndexAction "Ensure Index at #{meta.collection}: #{index.options.name}".green
					if Object.keys(index.keys).length > 0
						keys = {}
						for key, direction of index.keys
							keys[key.replace(/:/g, '.')] = direction

						tryEnsureIndex Models[meta.name], keys, index.options

			# Create text index
			if _.isObject(meta.indexText) and not _.isArray(meta.indexText) and Object.keys(meta.indexText).length > 0
				keys = {}
				options =
					name: 'TextIndex'
					default_language: global.Namespace.language
					weights: {}

				logIndexAction "Ensure Index at #{meta.collection}: #{options.name}".green
				for key, weight of meta.indexText
					key = key.replace /:/g, '.'
					keys[key] = 'text'
					if _.isNumber(weight) and weight > 0
						options.weights[key] = weight

				tryEnsureIndex Models[meta.name], keys, options

		if _.isEmpty(process.env.DISABLE_REINDEX) or process.env.DISABLE_REINDEX is 'false' or process.env.DISABLE_REINDEX is '0'
			Meteor.defer(processIndexes);

	# wait required metas to create initial data
	if Models['User'] && Models['Group']
		initialData()

deregisterMeta = (meta) ->
	delete Meta[meta.name]

	delete Models["#{meta.name}.Comment"]
	delete Models["#{meta.name}.History"]
	delete Models["#{meta.name}.Trash"]
	delete Models["#{meta.name}.AutoNumber"]
	delete Models[meta.name]

Meteor.startup ->
	if !!process.env.IS_MIRROR is true
		MetaObject.remove({})
		Meteor.users.remove({})

	MetaObject.find({type: 'access'}).observe
		added: (meta) ->
			Access[meta._id] = meta

		changed: (meta) ->
			Access[meta._id] = meta

		removed: (meta) ->
			delete Access[meta._id]


	rebuildReferencesTimer = null
	rebuildReferencesDelay = 1000

	MetaObject.find({type: $in: ['document', 'composite']}).observe
		added: (meta) ->
			registerMeta meta

			clearTimeout rebuildReferencesTimer
			rebuildReferencesTimer = setTimeout rebuildReferences, rebuildReferencesDelay

		changed: (meta) ->
			registerMeta meta

			clearTimeout rebuildReferencesTimer
			rebuildReferencesTimer = setTimeout rebuildReferences, rebuildReferencesDelay

		removed: (meta) ->
			deregisterMeta meta

			clearTimeout rebuildReferencesTimer
			rebuildReferencesTimer = setTimeout rebuildReferences, rebuildReferencesDelay


	MetaObject.find({type: $in: ['pivot', 'view', 'list']}).observe
		added: (meta) ->
			DisplayMeta[meta._id] = meta

		changed: (meta) ->
			DisplayMeta[meta._id] = meta

		removed: (meta) ->
			delete DisplayMeta[meta._id]

