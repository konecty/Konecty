import get from 'lodash/get';

Template.authMail.helpers({
	notAuthorized() {
		const user = Meteor.user();

		if (get(user, 'services.google')) {
			return false;
		}

		return true;
	},

	userEmail() {
		const user = Meteor.user();
		return get(user, 'emails.0.address');
	},

	testSent() {
		return Template.instance().testSent.get();
	}
});

Template.authMail.events({
	'click button.authorize'(event, instance) {
		const user = Meteor.user();
		const loginConfig = {
			requestPermissions: ['https://mail.google.com/'],
			requestOfflineToken: true,
			loginHint: user.emails[0].address,
			forceApprovalPrompt: true
		};

		if (get(user, 'emails.0.address')) {
			loginConfig.userEmail = user.emails[0].address;

			Meteor.loginWithGoogle(loginConfig, function(err) {
				if (err) {
					console.log(`error : ${err.message}`);
				}
			});
		}
	},

	'click button.revoke'(event, instance) {
		Meteor.call('revokeGoogleLogin');
	},

	'click button.logout'(event, instance) {
		Meteor.logout();
	},

	'click button.sendTestEmail'(event, instance) {
		Meteor.call('sendTestGoogleEmail', () => instance.testSent.set(true));
	},

	'click button.ok'(event, instance) {
		document.location.href = '/';
	}
});

Template.authMail.onCreated(function() {
	this.testSent = new ReactiveVar(false);
});
