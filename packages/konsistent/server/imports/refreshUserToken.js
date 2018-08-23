/*
 * decaffeinate suggestions:
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.refreshUserToken = function(userId, googleApp) {
	const user = Meteor.users.findOne(userId);

	if (!__guard__(__guard__(user != null ? user.services : undefined, x1 => x1.google), x => x.refreshToken)) { return; }

	const options = {
		params: {
			client_id: googleApp.clientId,
			client_secret: googleApp.secret,
			refresh_token: user.services.google.refreshToken,
			grant_type: 'refresh_token'
		}
	};

	console.log('refreshUserToken ->',userId, googleApp,options);

	const ret = HTTP.post('https://www.googleapis.com/oauth2/v4/token', options);

	console.log('ret ->',ret);

	if (__guard__(ret != null ? ret.data : undefined, x2 => x2.access_token)) {
		user.services.google.accessToken = ret.data.access_token;
		user.services.google.idToken = ret.data.id_token;
		user.services.google.expiresAt = (+new Date) + (1000 * parseInt(ret.data.expires_in, 10));

		Meteor.users.updateOne(userId, {
			$set: {
				'services.google.accessToken': user.services.google.accessToken,
				'services.google.idToken': user.services.google.idToken,
				'services.google.expiresAt': user.services.google.expiresAt
			}
		}
		);
	}

	return user.services.google;
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}