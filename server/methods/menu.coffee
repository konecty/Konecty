### Get system menu
	@param authTokenId
###
Meteor.registerMethod 'menu', 'withUser', (request) ->
	list = {}

	accessCache = {}

	getAccess = (documentName) =>
		if not accessCache[documentName]?
			accessCache[documentName] = accessUtils.getAccessFor documentName, @user
		return accessCache[documentName]

	namespace = MetaObject.findOne _id: 'Namespace'

	accesses = []

	MetaObject.find({type: {$nin: ['namespace', 'access']}}, {sort: {_id: 1}}).forEach (metaObject) ->
		metaObject.namespace = namespace.ns

		metaObject._id = metaObject.namespace + ':' + metaObject._id

		access = undefined
		if metaObject.document?
			access = getAccess metaObject.document
		else
			access = getAccess metaObject.name

		if access is false and metaObject.type not in ['document', 'composite']
			return

		if metaObject.type in ['document', 'composite'] and _.isObject access
			accesses.push access._id
			metaObject.access = metaObject.namespace + ':' + access._id

		columns = []

		for key, value of metaObject.columns
			columns.push value

		metaObject.columns = columns

		if metaObject.oldVisuals?
			metaObject.visuals = metaObject.oldVisuals
			delete metaObject.oldVisuals

		if metaObject.columns.length is 0
			delete metaObject.columns

		fields = []

		for key, value of metaObject.fields
			fields.push value

		metaObject.fields = fields

		if metaObject.fields.length is 0
			delete metaObject.fields

		if _.isArray metaObject.fields
			for field in metaObject.fields
				if field.type is 'lookup' and field.inheritedFields?.length > 0
					field.type = 'inheritLookup'

		list[metaObject._id] = metaObject

	MetaObject.find({_id: {$in: accesses}}).forEach (metaObject) ->
		metaObject.namespace = namespace.ns

		metaObject._id = metaObject.namespace + ':' + metaObject._id

		list[metaObject._id] = metaObject

	return list


Meteor.publish 'MetaObjectsWithAccess', () ->
	return @ready() unless @userId?

	user = Meteor.users.findOne @userId

	accessCache = {}

	getAccess = (documentName) =>
		if not accessCache[documentName]?
			accessCache[documentName] = accessUtils.getAccessFor documentName, user
		return accessCache[documentName]

	namespace = MetaObject.findOne _id: 'Namespace'


	processMetaObject = (metaObject) ->
		metaObject.menuSorter ?= 999
		access = undefined
		if metaObject.document?
			access = getAccess metaObject.document
		else
			access = getAccess metaObject.name

		if access is false and metaObject.type not in ['document', 'composite']
			return

		if metaObject.type in ['document', 'composite'] and _.isObject access
			metaObject.accessId = access._id

		return metaObject


	fields =
		namespace: 1
		document: 1
		type: 1
		name: 1
		label: 1
		plurals: 1
		icon: 1
		menuSorter: 1
		group: 1

	self = @

	MetaObject.find({type: {$nin: ['namespace', 'access']}}, {sort: {_id: 1}}).observe
		added: (metaObject) ->
			self.added 'Menu', metaObject._id, processMetaObject metaObject

		changed: (metaObject) ->
			self.changed 'Menu', metaObject._id, processMetaObject metaObject

		removed: (metaObject) ->
			self.removed 'Menu', metaObject._id, processMetaObject metaObject


	self.ready()
