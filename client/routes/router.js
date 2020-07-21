Router.onBeforeAction(function () {
	if (Meteor.user()) {
		return this.next();
	}
	return this.render('login');
});

Router.route('/auth/mail', {
	name: 'auth-mail',
	action() {
		this.render('authMail');
	},
	subscriptions() {
		Meteor.subscribe('fullUserInfo');
	},
});

Router.route('/auth/facebook', {
	name: 'auth-facebook',
	action() {
		this.render('authFacebook');
	},
	subscriptions() {
		Meteor.subscribe('fullUserInfo');
	},
});
