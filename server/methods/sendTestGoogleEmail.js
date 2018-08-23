/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Meteor.methods({
	sendTestGoogleEmail() {
		if (Meteor.userId() == null) {
			throw new Meteor.Error('invalid-user');
		}

		const user = Meteor.user();

		if ((__guard__(__guard__(user != null ? user.services : undefined, x1 => x1.google), x => x.idToken) == null) || (__guard__(__guard__(user != null ? user.services : undefined, x3 => x3.google), x2 => x2.accessToken) == null)) {
			throw new Meteor.Error('user-not-authorized');
		}

		if ((__guard__(typeof Namespace !== 'undefined' && Namespace !== null ? Namespace.googleApp : undefined, x4 => x4.clientId) == null) || (__guard__(typeof Namespace !== 'undefined' && Namespace !== null ? Namespace.googleApp : undefined, x5 => x5.secret) == null)) {
			throw new Meteor.Error('server-not-configured');
		}

		const messageData = {
			type: 'Email',
			status: 'Send',
			to: user.emails[0].address,
			subject: 'Teste de envio',
			body: '<h1>Teste de envio</h1><p>Por favor confira se o endereço do Remetente está correto.</p>',
			server: 'googleApp',
			_createdAt: new Date(),
			_updatedAt: new Date(),
			_createdBy: _.pick(user, '_id', 'group', 'name'),
			_updatedBy: _.pick(user, '_id', 'group', 'name'),
			_user: [ _.pick(user, '_id', 'group', 'name', 'active') ],
			discard: true
		};

		return Models['Message'].insert(messageData);
	}
});


function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}