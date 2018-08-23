/*
 * decaffeinate suggestions:
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.MetaObject = new Meteor.Collection('MetaObjects');

MetaObject.allow({
	insert() {
		return true;
	},

	update() {
		return true;
	},

	remove() {
		return true;
	}
});