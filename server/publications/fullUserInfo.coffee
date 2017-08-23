Meteor.publish 'fullUserInfo', ->
	return @ready() unless this.userId?

	return Meteor.users.find this.userId
