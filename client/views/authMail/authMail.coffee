Template.authMail.helpers
	notAuthorized: ->
		user = Meteor.user()

		if user?.services?.google?
			return false

		return true

	userEmail: ->
		user = Meteor.user()
		return user?.emails?[0]?.address

	testSent: ->
		return Template.instance().testSent.get()

Template.authMail.events
	'click button.authorize': (event, instance) ->
		user = Meteor.user()
		loginConfig =
			requestPermissions: ['https://mail.google.com/']
			requestOfflineToken: true
			loginHint: user.emails[0].address
			forceApprovalPrompt: true
			# requestPermissions: ['https://www.googleapis.com/auth/gmail.send']

		if user.emails?[0]?.address?
			loginConfig.userEmail = user.emails[0].address

			Meteor.loginWithGoogle loginConfig, (err) ->
				if err
					console.log 'error : ' + err.message

		# params =
		# 	"response_type": "token",
		# 	"client_id": '286145326878-trh2csbacbee8anv77odepph4b4jvolm.apps.googleusercontent.com'
		# 	"scope": 'https://mail.google.com/'
		# 	"redirect_uri": Meteor.absoluteUrl() + '_oauth/google?close'
		# 	# "state": OAuth._stateParam(loginStyle, credentialToken, options.redirectUrl)
		# 	# 'nonce': Random.secret().replace(/\W/g, '')
		# 	'login_hint': user.emails[0].address

		# loginUrl = 'https://accounts.google.com/o/oauth2/auth?' + _.map(params, (value, param) ->
		# 	return encodeURIComponent(param) + '=' + encodeURIComponent(value);
		# ).join("&")

		# window.open(loginUrl, 'google-login', 'width=500,height=500');

	'click button.revoke': (event, instance) ->
		Meteor.call 'revokeGoogleLogin'

	'click button.logout': (event, instance) ->
		Meteor.logout()

	'click button.sendTestEmail': (event, instance) ->
		Meteor.call 'sendTestGoogleEmail', ->
			instance.testSent.set true

	'click button.ok': (event, instance) ->
		document.location.href = '/'

Template.authMail.onCreated ->
	@testSent = new ReactiveVar false
