Package.describe({
  name: 'konutils',
  summary: '',
  version: '1.1.0',
  git: ''
});

Package.onUse(function(api) {
  api.use('ecmascript');
  api.use('mongo');
  api.use('coffeescript');
  api.use('nooitaf:colors');
  api.use('thepumpinglemma:object-path');

  api.addFiles('server/utils.coffee', ['server']);
  api.addFiles('server/sortUtils.coffee', ['server']);
  api.addFiles('server/sessionUtils.coffee', ['server']);
  api.addFiles('server/accessUtils.coffee', ['server']);
  api.addFiles('server/filterUtils.coffee', ['server']);
  api.addFiles('server/lookupUtils.coffee', ['server']);
  api.addFiles('server/metaUtils.coffee', ['server']);

  api.export(['utils'], ['server']);
  api.export(['sortUtils'], ['server']);
  api.export(['sessionUtils'], ['server']);
  api.export(['accessUtils'], ['server']);
  api.export(['filterUtils'], ['server']);
  api.export(['lookupUtils'], ['server']);
  api.export(['metaUtils'], ['server']);
});

Npm.depends({
  moment: '2.18.1',
  'moment-timezone': '0.5.13',
  request: '2.88.0'
});
