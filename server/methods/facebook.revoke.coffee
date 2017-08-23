Meteor.methods
	'facebook.revoke': ->
		if not Meteor.userId()
			throw new Meteor.Error 'invalid-user'

		Meteor.users.update Meteor.userId(),
			$unset:
				'services.facebook': 1
