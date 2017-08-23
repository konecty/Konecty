Template.authFacebook.helpers
	notAuthorized: ->
		user = Meteor.user()

		if user?.services?.facebook?
			return false

		return true

	pages: ->
		return _.values(Template.instance().pages.get());

Template.authFacebook.events
	'click button.authorize': (event, instance) ->
		user = Meteor.user()

		loginConfig =
			requestPermissions: ['manage_pages']

		Meteor.loginWithFacebook loginConfig, (err, success) =>
			Meteor.call 'facebook.makePermanentAccess'


	'click button.revoke': (event, instance) ->
		Meteor.call 'facebook.revoke'

	'click button.logout': (event, instance) ->
		Meteor.logout()

	'click button.ok': (event, instance) ->
		document.location.href = '/'

	'click a.add-webhook': (event, instance) ->
		event.preventDefault();
		HTTP.post('https://graph.facebook.com/v2.7/' + this.id + '/subscribed_apps', { params: { access_token: this.access_token } }, (err, response) =>
			$("i[data-rel=#{this.id}]").removeClass('hidden');
			pages = instance.pages.get();
			pages[this.id].added = true;
			instance.pages.set(pages);
		);

	'click a.remove-webhook': (event, instance) ->
		event.preventDefault();
		HTTP.del('https://graph.facebook.com/v2.7/' + this.id + '/subscribed_apps', { params: { access_token: this.access_token } }, (err, response) =>
			$("i[data-rel=#{this.id}]").addClass('hidden');
			pages = instance.pages.get();
			pages[this.id].added = false;
			instance.pages.set(pages);
		);

Template.authFacebook.onCreated ->
	this.pages = new ReactiveVar []
	this.autorun =>
		user = Meteor.user()
		if user?.services?.facebook?
			HTTP.get('https://graph.facebook.com/v2.7/me/accounts', { params: { access_token: user.services.facebook.accessToken } }, (err, response) =>
				pages = {}
				if response?.data?.data
					for page in response.data.data
						pages[page.id] = page;
						HTTP.get('https://graph.facebook.com/v2.7/' + page.id + '/', { params: { fields: 'id,subscribed_apps', access_token: page.access_token } }, (err, response) =>
							if response?.data
								pages[response.data.id].added = response?.data?.subscribed_apps?.data?.length > 0
								this.pages.set(pages);
						);
			);
