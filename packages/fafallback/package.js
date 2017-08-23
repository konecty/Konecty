Package.describe({
  name: 'fafallback',
  summary: '',
  version: '1.0.0',
  git: ''
});

Package.onUse(function(api) {
  api.versionsFrom('1.0');
  api.addFiles('fafallback.css', ['client']);
});