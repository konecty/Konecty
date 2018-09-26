

Meteor.startup(function() {
	Konsistent.start(MetaObject, Models, (_.isEmpty(process.env.DISABLE_KONSISTENT) || process.env.DISABLE_KONSISTENT === 'false' || process.env.DISABLE_KONSISTENT === '0'));
});
