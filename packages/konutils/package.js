Package.describe({
  name: 'konutils',
  summary: '',
  version: '1.1.0',
  git: ''
});

Package.onUse(function(api) {
  api.use('ecmascript');
  api.use('mongo');
  api.use('nooitaf:colors');
  api.use('thepumpinglemma:object-path');

  api.addFiles('server/utils.js', ['server']);
  api.addFiles('server/sortUtils.js', ['server']);
  api.addFiles('server/sessionUtils.js', ['server']);
  api.addFiles('server/accessUtils.js', ['server']);
  api.addFiles('server/filterUtils.js', ['server']);
  api.addFiles('server/lookupUtils.js', ['server']);
  api.addFiles('server/metaUtils.js', ['server']);

  api.export('utils', ['server']);
  api.export('sortUtils', ['server']);
  api.export('sessionUtils', ['server']);
  api.export('accessUtils', ['server']);
  api.export('filterUtils', ['server']);
  api.export('lookupUtils', ['server']);
  api.export('metaUtils', ['server']);
});
