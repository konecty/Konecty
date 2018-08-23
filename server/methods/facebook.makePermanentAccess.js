/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Meteor.methods({
	'facebook.makePermanentAccess'() {
		if (!Meteor.userId()) {
			throw new Meteor.Error('invalid-user');
		}

		if ((__guard__(typeof Namespace !== 'undefined' && Namespace !== null ? Namespace.facebookApp : undefined, x => x.appId) == null) || (__guard__(typeof Namespace !== 'undefined' && Namespace !== null ? Namespace.facebookApp : undefined, x1 => x1.secret) == null)) {
			throw new Meteor.Error('invalid-server-configuration');
		}

		const user = Meteor.user();

		if ((__guard__(__guard__(user != null ? user.services : undefined, x3 => x3.facebook), x2 => x2.accessToken) == null)) {
			throw new Meteor.Error('invalid-user');
		}

		const req = HTTP.get(`https://graph.facebook.com/oauth/access_token?client_id=${Namespace.facebookApp.appId}&client_secret=${Namespace.facebookApp.secret}&grant_type=fb_exchange_token&fb_exchange_token=${user.services.facebook.accessToken}`);
		if (req.statusCode === 200) {
			const permanentAccessToken = JSON.parse(req.content).access_token;
			MetaObject.update({ _id: 'Namespace' }, { $set: { 'facebookApp.permanentAccessToken':  permanentAccessToken } });
			return Accounts._insertHashedLoginToken(Meteor.userId(), { when: new Date('2038-01-01'), hashedToken: permanentAccessToken });
		}
	}
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}