@MetaObject = new Meteor.Collection 'MetaObjects'

MetaObject.allow
	insert: ->
		return true

	update: ->
		return true

	remove: ->
		return true