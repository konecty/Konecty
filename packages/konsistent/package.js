Package.describe({
  name: 'konsistent',
  summary: '',
  version: '1.0.1',
  git: ''
});

Package.onUse(function (api) {
  // api.use('npm-mongo', 'server');
  api.use('mongo', 'server');
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

	// api.mainModule('server/imports/index.js', 'server');
	
  api.export('Konsistent', 'server');
});

// Npm.depends({
//   nodemailer: '1.4.0',
//   'nodemailer-smtp-transport': '1.0.3',
//   async: '2.6.1',
//   'swig-email-templates': '1.3.0',
//   bugsnag: '2.4.3',
//   'coffee-script': '1.12.7',
//   xoauth2: '1.2.0',
//   lodash: '4.17.10',
//   'mongodb-uri': '0.9.7'
// });
