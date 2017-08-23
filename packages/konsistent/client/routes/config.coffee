ListMetaController = RouteController.extend
	template: 'ListMeta'
	data: ->
		params = @params
		query = {}

		meta = MetaObject.find().fetch()

		Meta = {}

		for item in meta
			Meta[item.name] = item

		References = buildReferences Meta

		return {
			id: 'History'
			meta: params.meta
			dataId: params._id
			data: ->
				return References
		}

	waitOn: ->
		return Meteor.subscribe 'konsistent/metaObject'

Router.configure
	layoutTemplate: 'slimLayout'

Router.map ->
	this.route 'ListMeta',
		path: '/konsistent'
		controller: ListMetaController
