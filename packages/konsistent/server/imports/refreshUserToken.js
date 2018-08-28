import { get, has } from 'lodash';

refreshUserToken = function(userId, googleApp) {
  const user = Meteor.users.findOne(userId);

  if (!get(user, 'services.google.refreshToken')) {
    return;
  }

  const options = {
    params: {
      client_id: googleApp.clientId,
      client_secret: googleApp.secret,
      refresh_token: user.services.google.refreshToken,
      grant_type: 'refresh_token'
    }
  };

  console.log('refreshUserToken ->', userId, googleApp, options);

  const ret = HTTP.post('https://www.googleapis.com/oauth2/v4/token', options);

  console.log('ret ->', ret);

  if (has(ret, 'data.access_token')) {
    user.services.google.accessToken = ret.data.access_token;
    user.services.google.idToken = ret.data.id_token;
    user.services.google.expiresAt = +new Date() + 1000 * parseInt(ret.data.expires_in, 10);

    Meteor.users.update(userId, {
      $set: {
        'services.google.accessToken': user.services.google.accessToken,
        'services.google.idToken': user.services.google.idToken,
        'services.google.expiresAt': user.services.google.expiresAt
      }
    });
  }

  return user.services.google;
};
