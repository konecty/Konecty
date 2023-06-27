import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

const orig_updateOrCreateUserFromExternalService = Accounts.updateOrCreateUserFromExternalService;
Accounts.updateOrCreateUserFromExternalService = function (serviceName, serviceData) {
	const userId = Meteor.userId();

	if (!userId) {
		return;
	}

	const update = { $set: {} };

	const serviceIdKey = `services.${serviceName}.id`;
	update.$set[serviceIdKey] = serviceData.id;

	Meteor.users.update(userId, update);

	return orig_updateOrCreateUserFromExternalService.apply(this, arguments);
};
