Meteor.startup ->
	Accounts.loginServiceConfiguration.remove
		service: "google"

	if Namespace.googleApp?
		Accounts.loginServiceConfiguration.insert
			service: "google"
			clientId: Namespace.googleApp.clientId
			secret: Namespace.googleApp.secret
