/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS208: Avoid top-level this
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
this.Account = (function() {

	const currentTab = function() {};

	Session.set('account-status', false);

	const open = function(element) {
		switch (element.icon) {
			case "plus":
				Session.set('account-tab', "accountLinks");
				break;
			case "gear":
				Session.set('account-tab', "accountConfiguration");
				break;
			case "bell":
				Session.set('account-tab', "accountNotifications");
				break;
		}

		return Session.set('account-status', true);
	};
	const close = () => Session.set('account-status', false);

	return {
		open,
		close,
		currentTab
	};

})();
