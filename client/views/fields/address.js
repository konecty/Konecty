/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.fieldAddress.helpers({
	format(value) {
		return renderers.address(value, this.field);
	}
});

Template.fieldAddress.events({
	'click konecty-display'() {
		return Modal.open('modalAddress', this.value);
	}
});
