/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Meteor.startup ->

MetaObject.find({type: 'document'}).observe({
	added(meta) {
		if (!Models[meta.name]) {
			Models[meta.name] = new Meteor.Collection(`data.${meta.name}`);
			Models[`${meta.name}.History`] = new Meteor.Collection(`data.${meta.name}.History`);
			return Models[`${meta.name}Editing`] = new Meteor.Collection(null);
		}
	},

	changed(meta) {
		if (!Models[meta.name]) {
			Models[meta.name] = new Meteor.Collection(`data.${meta.name}`);
			Models[`${meta.name}.History`] = new Meteor.Collection(`data.${meta.name}.History`);
			return Models[`${meta.name}Editing`] = new Meteor.Collection(null);
		}
	}
});

