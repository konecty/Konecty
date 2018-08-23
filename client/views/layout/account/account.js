/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.account.helpers({
	tabTemplate() {
		return Session.get("account-tab");
	},
	status() {
		if (!Session.get("account-status")) { return "hidden"; }
	}
});

Template.account.events({
	"click .link"(e) {
		return Account.open(e.currentTarget);
	},
	"click .close"(e) {
		return Account.close();
	}
});
