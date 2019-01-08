import values from 'lodash/values';
import get from 'lodash/get';
import size from 'lodash/size';

Template.authFacebook.helpers({
	notAuthorized() {
		const user = Meteor.user();

		if (get(user, 'services.facebook')) {
			return false;
		}

		return true;
	},

	pages() {
		return values(Template.instance().pages.get());
	}
});

Template.authFacebook.events({
	'click button.authorize'(event, instance) {
		const user = Meteor.user();

		const loginConfig = { requestPermissions: ['manage_pages'] };

		Meteor.loginWithFacebook(loginConfig, (err, success) => {
			Meteor.call('facebook.makePermanentAccess');
		});
	},

	'click button.revoke'(event, instance) {
		Meteor.call('facebook.revoke');
	},

	'click button.logout'(event, instance) {
		Meteor.logout();
	},

	'click button.ok'(event, instance) {
		document.location.href = '/';
	},

	'click a.add-webhook'(event, instance) {
		event.preventDefault();
		HTTP.post(
			`https://graph.facebook.com/v2.7/${this.id}/subscribed_apps`,
			{ params: { access_token: this.access_token } },
			(err, response) => {
				$(`i[data-rel=${this.id}]`).removeClass('hidden');
				const pages = instance.pages.get();
				pages[this.id].added = true;
				instance.pages.set(pages);
			}
		);
	},

	'click a.remove-webhook'(event, instance) {
		event.preventDefault();
		HTTP.del(
			`https://graph.facebook.com/v2.7/${this.id}/subscribed_apps`,
			{ params: { access_token: this.access_token } },
			(err, response) => {
				$(`i[data-rel=${this.id}]`).addClass('hidden');
				const pages = instance.pages.get();
				pages[this.id].added = false;
				instance.pages.set(pages);
			}
		);
	}
});

Template.authFacebook.onCreated(function() {
	this.pages = new ReactiveVar([]);
	return this.autorun(() => {
		const user = Meteor.user();
		if (get(user, 'services.facebook')) {
			HTTP.get(
				'https://graph.facebook.com/v2.7/me/accounts',
				{ params: { access_token: user.services.facebook.accessToken } },
				(err, response) => {
					const pages = {};
					if (get(response, 'data.data')) {
						for (let page of response.data.data) {
							pages[page.id] = page;
							HTTP.get(
								`https://graph.facebook.com/v2.7/${page.id}/`,
								{ params: { fields: 'id,subscribed_apps', access_token: page.access_token } },
								(err, response) => {
									if (response && response.data) {
										pages[response.data.id].added = size(get(response, 'data.subscribed_apps.data')) > 0;
										this.pages.set(pages);
									}
								}
							);
						}
					}
				}
			);
		}
	});
});
