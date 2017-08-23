Meteor.startup(function() {
	if (!window.MetaObject) {
		window.MetaObject = new Meteor.Collection('MetaObjects');

		MetaObject.allow({
			insert: function() {
				return true
			},

			update: function() {
				return true
			},

			remove: function() {
				return true
			}
		});
	}
});
