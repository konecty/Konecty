@Namespace = {}

rebuildReferences = ->
	Konsistent.History.setup()

	console.log '[konsistent] Rebuilding references'
	Konsistent.References = buildReferences Meta

registerMeta = (meta) ->
	meta.collection ?= "data.#{meta.name}"
	Meta[meta.name] = meta
	Konsistent.MetaByCollection[meta.collection] = meta

	unless Konsistent.Models[meta.name]
		Konsistent.Models["#{meta.name}.History"] = Konsistent._Models["#{meta.name}.History"] or new Meteor.Collection "#{meta.collection}.History"
		Konsistent.Models["#{meta.name}.Trash"] = Konsistent._Models["#{meta.name}.Trash"] or new Meteor.Collection "#{meta.collection}.Trash"
		Konsistent.Models["#{meta.name}.Comment"] = Konsistent._Models["#{meta.name}.Comment"] or new Meteor.Collection "#{meta.collection}.Comment"
		Konsistent.Models["#{meta.name}.AutoNumber"] = Konsistent._Models["#{meta.name}.AutoNumber"] or new Meteor.Collection "#{meta.collection}.AutoNumber"

		switch meta.collection
			when 'users'
				Konsistent.Models[meta.name] = Meteor.users
			else
				Konsistent.Models[meta.name] = Konsistent._Models[meta.name] or new Meteor.Collection meta.collection


deregisterMeta = (meta) ->
	delete Meta[meta.name]

	delete Konsistent.Models["#{meta.name}.History"]
	delete Konsistent.Models["#{meta.name}.Trash"]
	delete Konsistent.Models["#{meta.name}.Comment"]
	delete Konsistent.Models["#{meta.name}.AutoNumber"]
	delete Konsistent.Models[meta.name]


registerTemplate = (record) ->
	Templates[record._id] =
		template: SSR.compileTemplate(record._id, record.value)
		subject: record.subject

	for name, fn of record.helpers
		helper = {}
		fn = [].concat fn
		helper[name] = Function.apply null, fn
		Template[record._id].helpers helper

Konsistent.start = (MetaObject, Models, rebuildMetas = true) ->
	Konsistent.MetaObject = MetaObject
	Konsistent._Models = Models or {}

	UserPresenceMonitor.setVisitorStatus = (id, status) ->
		if not Konsistent._Models.ChatVisitor? then Konsistent._Models.ChatVisitor = new Meteor.Collection "data.ChatVisitor"
		Konsistent._Models.ChatVisitor.update {_id: id, userStatus: {$ne: status}}, {$set: {userStatus: status}}

	UserPresenceMonitor.start();

	MetaObjectQuery =
		type: 'document'

	Meteor.publish "konsistent/metaObject", () ->
		return @ready() unless @userId?

		return Konsistent.MetaObject.find MetaObjectQuery

	if Konsistent._Models.Template?
		Konsistent._Models.Template.find({type: 'email'}).observe
			added: (record) ->
				registerTemplate record

			changed: (record) ->
				registerTemplate record

			removed: (record) ->
				delete Templates[record._id]

	Konsistent.MetaObject.find({type: 'namespace'}).observe
		added: (meta) ->
			global.Namespace = meta

		changed: (meta) ->
			global.Namespace = meta

	if rebuildMetas
		rebuildReferencesTimer = null
		rebuildReferencesDelay = 100
		Konsistent.MetaObject.find(MetaObjectQuery).observe
			added: (meta) ->
				registerMeta meta

				clearTimeout rebuildReferencesTimer
				rebuildReferencesTimer = setTimeout Meteor.bindEnvironment(rebuildReferences), rebuildReferencesDelay

			changed: (meta) ->
				registerMeta meta

				clearTimeout rebuildReferencesTimer
				rebuildReferencesTimer = setTimeout Meteor.bindEnvironment(rebuildReferences), rebuildReferencesDelay

			removed: (meta) ->
				deregisterMeta meta

				clearTimeout rebuildReferencesTimer
				rebuildReferencesTimer = setTimeout Meteor.bindEnvironment(rebuildReferences), rebuildReferencesDelay

		mailConsumer.start()

	Accounts.loginServiceConfiguration.remove
		service: "google"

	if global.Namespace.googleApp?
		console.log "Setup google config for accounts".green
		Accounts.loginServiceConfiguration.insert
			service: "google"
			clientId: global.Namespace.googleApp.clientId
			secret: global.Namespace.googleApp.secret

	Accounts.loginServiceConfiguration.remove
		service: "facebook"

	if global.Namespace.facebookApp?
		console.log "Setup facebook config for accounts".green
		Accounts.loginServiceConfiguration.insert
			service: "facebook"
			appId: global.Namespace.facebookApp.appId
			secret: global.Namespace.facebookApp.secret