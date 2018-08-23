/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Meteor.publish('fullUserInfo', function() {
	if (this.userId == null) { return this.ready(); }

	return Meteor.users.find(this.userId);
});
