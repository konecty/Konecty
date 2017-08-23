orig_updateOrCreateUserFromExternalService = Accounts.updateOrCreateUserFromExternalService
Accounts.updateOrCreateUserFromExternalService = (serviceName, serviceData, options) ->
	userId = Meteor.userId()

	if not userId
		return

	update =
		$set: {}

	serviceIdKey = "services.#{serviceName}.id"
	update.$set[serviceIdKey] = serviceData.id

	Meteor.users.update userId, update

	return orig_updateOrCreateUserFromExternalService.apply(this, arguments)
