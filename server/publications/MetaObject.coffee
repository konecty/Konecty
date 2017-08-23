Meteor.publish 'metaObject', ->
	return @ready() unless @userId?

	return MetaObject.find()
