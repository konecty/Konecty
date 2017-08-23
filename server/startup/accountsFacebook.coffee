Meteor.startup ->
	Accounts.loginServiceConfiguration.remove
		service: "facebook"

	if Namespace.facebookApp?
		Accounts.loginServiceConfiguration.insert
			service: "facebook"
			appId: Namespace.facebookApp.appId
			secret: Namespace.facebookApp.secret
