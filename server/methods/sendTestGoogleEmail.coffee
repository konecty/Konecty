Meteor.methods
	sendTestGoogleEmail: ->
		unless Meteor.userId()?
			throw new Meteor.Error 'invalid-user'

		user = Meteor.user()

		unless user?.services?.google?.idToken? and user?.services?.google?.accessToken?
			throw new Meteor.Error 'user-not-authorized'

		unless Namespace?.googleApp?.clientId? and Namespace?.googleApp?.secret?
			throw new Meteor.Error 'server-not-configured'

		messageData =
			type: 'Email'
			status: 'Send'
			to: user.emails[0].address
			subject: 'Teste de envio'
			body: '<h1>Teste de envio</h1><p>Por favor confira se o endereço do Remetente está correto.</p>'
			server: 'googleApp'
			_createdAt: new Date()
			_updatedAt: new Date()
			_createdBy: _.pick(user, '_id', 'group', 'name')
			_updatedBy: _.pick(user, '_id', 'group', 'name')
			_user: [ _.pick(user, '_id', 'group', 'name', 'active') ]
			discard: true

		Models['Message'].insert messageData

