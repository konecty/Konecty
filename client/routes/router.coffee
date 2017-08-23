Router.onBeforeAction ->
	if Meteor.user()?
		return this.next()
	this.render 'login'

Router.route '/auth/mail',
	name: 'auth-mail',
	action: ->
		this.render 'authMail'
	subscriptions: ->
		Meteor.subscribe 'fullUserInfo'

Router.route '/auth/facebook',
	name: 'auth-facebook',
	action: ->
		this.render 'authFacebook'
	subscriptions: ->
		Meteor.subscribe 'fullUserInfo'

Router.route '/foxy',
	subscriptions: ->
		if Meteor.userId()
			return [
				Meteor.subscribe 'MetaObjectsWithAccess'
				Meteor.subscribe 'data.Preference', {'_user._id': Meteor.userId()}, 1000
				Meteor.subscribe 'metaObject'
			]
	action: ->
		this.layout 'master'
		this.render 'index'


Router.route '/foxy/list/:documentName/:listName',
	subscriptions: ->
		if Meteor.userId()
			return [
				Meteor.subscribe 'MetaObjectsWithAccess'
				Meteor.subscribe 'data.Preference', {'_user._id': Meteor.userId()}, 1000
				Meteor.subscribe 'metaObject'
			]
	action: ->
		params = @params

		metaDocument = Menu.findOne
			_id: params.documentName

		if metaDocument?
			Session.set 'main-menu-active', metaDocument.group or metaDocument._id

		metaList = Menu.findOne
			document: params.documentName
			name: params.listName
			type: 'list'

		if metaList?
			Session.set 'main-submenu-active', metaList._id

			metaView = Menu.findOne
				document: params.documentName
				name: metaList.view
				type: 'view'

		if not metaDocument? or not metaList? or not MetaObject.findOne(params.documentName)
			this.layout 'master'
		else
			this.layout 'master',
				data:
					meta:
						document: metaDocument
						list: metaList
						view: metaView
					data: Models[params.documentName]?.find {}

			Tracker.autorun ->
				Meteor.subscribe("data.#{params.documentName}", Session.get('filter'))

		this.render 'index'
