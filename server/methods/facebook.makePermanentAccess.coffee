Meteor.methods
	'facebook.makePermanentAccess': ->
		if not Meteor.userId()
			throw new Meteor.Error 'invalid-user'

		if not Namespace?.facebookApp?.appId? or not Namespace?.facebookApp?.secret?
			throw new Meteor.Error 'invalid-server-configuration'

		user = Meteor.user()

		if not user?.services?.facebook?.accessToken?
			throw new Meteor.Error 'invalid-user'

		req = HTTP.get("https://graph.facebook.com/oauth/access_token?client_id=#{Namespace.facebookApp.appId}&client_secret=#{Namespace.facebookApp.secret}&grant_type=fb_exchange_token&fb_exchange_token=#{user.services.facebook.accessToken}")
		if req.statusCode is 200
			permanentAccessToken = JSON.parse(req.content).access_token;
			MetaObject.update({ _id: 'Namespace' }, { $set: { 'facebookApp.permanentAccessToken':  permanentAccessToken } })
			Accounts._insertHashedLoginToken(Meteor.userId(), { when: new Date('2038-01-01'), hashedToken: permanentAccessToken })
