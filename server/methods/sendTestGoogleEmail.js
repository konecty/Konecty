import { pick, has } from 'lodash';
Meteor.methods({
  sendTestGoogleEmail() {
    if (!Meteor.userId()) {
      throw new Meteor.Error('invalid-user');
    }

    const user = Meteor.user();

    if (!has(user, 'services.google.idToken') || !has(user, 'services.google.accessToken')) {
      throw new Meteor.Error('user-not-authorized');
    }

    if (!has(Namespace, 'googleApp.clientId') || !has(Namespace, 'googleApp.secret')) {
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
      _createdBy: pick(user, '_id', 'group', 'name'),
      _updatedBy: pick(user, '_id', 'group', 'name'),
      _user: [pick(user, '_id', 'group', 'name', 'active')],
      discard: true
    };

    Models['Message'].insert(messageData);
  }
});
