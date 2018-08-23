/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Template.authFacebook.helpers({
	notAuthorized() {
		const user = Meteor.user();

		if (__guard__(user != null ? user.services : undefined, x => x.facebook) != null) {
			return false;
		}

		return true;
	},

	pages() {
		return _.values(Template.instance().pages.get());
	}
});

Template.authFacebook.events({
	'click button.authorize'(event, instance) {
		const user = Meteor.user();

		const loginConfig =
			{requestPermissions: ['manage_pages']};

		return Meteor.loginWithFacebook(loginConfig, (err, success) => {
			return Meteor.call('facebook.makePermanentAccess');
		});
	},


	'click button.revoke'(event, instance) {
		return Meteor.call('facebook.revoke');
	},

	'click button.logout'(event, instance) {
		return Meteor.logout();
	},

	'click button.ok'(event, instance) {
		return document.location.href = '/';
	},

	'click a.add-webhook'(event, instance) {
		event.preventDefault();
		return HTTP.post(`https://graph.facebook.com/v2.7/${this.id}/subscribed_apps`, { params: { access_token: this.access_token } }, (err, response) => {
			$(`i[data-rel=${this.id}]`).removeClass('hidden');
			const pages = instance.pages.get();
			pages[this.id].added = true;
			return instance.pages.set(pages);
		});
	},

	'click a.remove-webhook'(event, instance) {
		event.preventDefault();
		return HTTP.del(`https://graph.facebook.com/v2.7/${this.id}/subscribed_apps`, { params: { access_token: this.access_token } }, (err, response) => {
			$(`i[data-rel=${this.id}]`).addClass('hidden');
			const pages = instance.pages.get();
			pages[this.id].added = false;
			return instance.pages.set(pages);
		});
	}
});

Template.authFacebook.onCreated(function() {
	this.pages = new ReactiveVar([]);
	return this.autorun(() => {
		const user = Meteor.user();
		if (__guard__(user != null ? user.services : undefined, x => x.facebook) != null) {
			return HTTP.get('https://graph.facebook.com/v2.7/me/accounts', { params: { access_token: user.services.facebook.accessToken } }, (err, response) => {
				const pages = {};
				if (__guard__(response != null ? response.data : undefined, x1 => x1.data)) {
					return (() => {
						const result = [];
						for (let page of Array.from(response.data.data)) {
							pages[page.id] = page;
							result.push(HTTP.get(`https://graph.facebook.com/v2.7/${page.id}/`, { params: { fields: 'id,subscribed_apps', access_token: page.access_token } }, (err, response) => {
								if (response != null ? response.data : undefined) {
									pages[response.data.id].added = __guard__(__guard__(__guard__(response != null ? response.data : undefined, x4 => x4.subscribed_apps), x3 => x3.data), x2 => x2.length) > 0;
									return this.pages.set(pages);
								}
							}));
						}
						return result;
					})();
				}
			});
		}
	});
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}