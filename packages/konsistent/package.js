Package.describe({
  name: 'konsistent',
  summary: '',
  version: '1.0.1',
  git: ''
});

Package.onUse(function(api) {
  api.use('blaze-html-templates');
  api.use('accounts-password');
  api.use('accounts-base');
  api.use('accounts-ui');
  api.use('underscore');
  api.use('tracker');
  api.use('check');
  api.use('http');
  api.use('ecmascript');

  api.use('meteorhacks:collection-utils');
  api.use('mrt:underscore-string-latest');
  api.use('konecty:user-presence');
  api.use('mrt:bootstrap-3');
  api.use('meteorhacks:ssr');
  api.use('nooitaf:colors');
  api.use('iron:router');

  api.addAssets('private/templates/mail/alert.html', 'server');
  api.addAssets('private/templates/mail/resetPassword.html', 'server');

  api.addFiles('lib/accounts.js');
  api.addFiles('lib/buildReferences.js');

  api.addFiles('client/lib/MetaObject.js', 'client');
  api.addFiles('client/helpers/arrayify.js', 'client');
  api.addFiles('client/helpers/lengthGt.js', 'client');
  api.addFiles('client/helpers/stringify.js', 'client');
  api.addFiles('client/views/layouts/slim.html', 'client');
  api.addFiles('client/views/components/ListMeta.html', 'client');
  api.addFiles('client/views/components/ListMeta.js', 'client');
  api.addFiles('client/views/components/login.html', 'client');
  api.addFiles('client/routes/config.js', 'client');

  api.addFiles('server/imports/index.js', 'server');
  api.addFiles('server/imports/errors.js', 'server');
  api.addFiles('server/imports/mailConsumer.js', 'server');
  api.addFiles('server/imports/refreshUserToken.js', 'server');
  api.addFiles('server/imports/vm.js', 'server');
  api.addFiles('server/methods/processLookup.js', 'server');
  api.addFiles('server/startup/loadMetaObjects.js', 'server');

  api.export('Konsistent', 'server');
});
