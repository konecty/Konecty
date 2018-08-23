Package.describe({
  name: 'konmeta',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: '',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

// Npm.depends({
//   "mongodb": "3.1.3"
// });

Package.onUse(function (api) {
  // api.versionsFrom('1.5.1');

  api.use('mongo');
  api.use('webapp');
  api.use('ecmascript');

  api.addAssets('metadata/core.MetaObject.json', 'server');
  api.addAssets('metadata/core.Namespace.json', 'server');

  api.mainModule('konmeta.js', 'server');

  api.export('MetaObject', 'server');
});
