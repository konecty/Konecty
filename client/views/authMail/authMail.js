/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.authMail.helpers({
	notAuthorized() {
		const user = Meteor.user();

		if (__guard__(user != null ? user.services : undefined, x => x.google) != null) {
			return false;
		}

		return true;
	},

	userEmail() {
		const user = Meteor.user();
		return __guard__(__guard__(user != null ? user.emails : undefined, x1 => x1[0]), x => x.address);
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
			// requestPermissions: ['https://www.googleapis.com/auth/gmail.send']

		if (__guard__(user.emails != null ? user.emails[0] : undefined, x => x.address) != null) {
			loginConfig.userEmail = user.emails[0].address;

			return Meteor.loginWithGoogle(loginConfig, function(err) {
				if (err) {
					return console.log(`error : ${err.message}`);
				}
			});
		}
	},

		// params =
		// 	"response_type": "token",
		// 	"client_id": '286145326878-trh2csbacbee8anv77odepph4b4jvolm.apps.googleusercontent.com'
		// 	"scope": 'https://mail.google.com/'
		// 	"redirect_uri": Meteor.absoluteUrl() + '_oauth/google?close'
		// 	# "state": OAuth._stateParam(loginStyle, credentialToken, options.redirectUrl)
		// 	# 'nonce': Random.secret().replace(/\W/g, '')
		// 	'login_hint': user.emails[0].address

		// loginUrl = 'https://accounts.google.com/o/oauth2/auth?' + _.map(params, (value, param) ->
		// 	return encodeURIComponent(param) + '=' + encodeURIComponent(value);
		// ).join("&")

		// window.open(loginUrl, 'google-login', 'width=500,height=500');

	'click button.revoke'(event, instance) {
		return Meteor.call('revokeGoogleLogin');
	},

	'click button.logout'(event, instance) {
		return Meteor.logout();
	},

	'click button.sendTestEmail'(event, instance) {
		return Meteor.call('sendTestGoogleEmail', () => instance.testSent.set(true));
	},

	'click button.ok'(event, instance) {
		return document.location.href = '/';
	}
});

Template.authMail.onCreated(function() {
	return this.testSent = new ReactiveVar(false);
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}