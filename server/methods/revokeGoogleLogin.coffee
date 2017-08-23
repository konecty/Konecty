Meteor.methods
	revokeGoogleLogin: ->
		if not Meteor.userId()
			throw new Meteor.Error 'invalid-user'

		Meteor.users.update Meteor.userId(),
			$unset:
				'services.google': 1
