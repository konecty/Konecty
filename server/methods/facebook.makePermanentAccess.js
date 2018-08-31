import { has } from 'lodash';

Meteor.methods({
  'facebook.makePermanentAccess'() {
    if (!Meteor.userId()) {
      throw new Meteor.Error('invalid-user');
    }

    if (!has(Namespace, 'facebookApp.appId') || !has(Namespace, 'facebookApp.secret')) {
      throw new Meteor.Error('invalid-server-configuration');
    }

    const user = Meteor.user();

    if (!has(user, 'services.accessToken')) {
      throw new Meteor.Error('invalid-user');
    }

    const req = HTTP.get(
      `https://graph.facebook.com/oauth/access_token?client_id=${Namespace.facebookApp.appId}&client_secret=${
        Namespace.facebookApp.secret
      }&grant_type=fb_exchange_token&fb_exchange_token=${user.services.facebook.accessToken}`
    );
    if (req.statusCode === 200) {
      const permanentAccessToken = JSON.parse(req.content).access_token;
      MetaObject.update({ _id: 'Namespace' }, { $set: { 'facebookApp.permanentAccessToken': permanentAccessToken } });
      Accounts._insertHashedLoginToken(Meteor.userId(), { when: new Date('2038-01-01'), hashedToken: permanentAccessToken });
    }
  }
});
