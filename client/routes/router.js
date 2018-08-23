/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
Router.onBeforeAction(function() {
	if (Meteor.user() != null) {
		return this.next();
	}
	return this.render('login');
});

Router.route('/auth/mail', {
	name: 'auth-mail',
	action() {
		return this.render('authMail');
	},
	subscriptions() {
		return Meteor.subscribe('fullUserInfo');
	}
}
);

Router.route('/auth/facebook', {
	name: 'auth-facebook',
	action() {
		return this.render('authFacebook');
	},
	subscriptions() {
		return Meteor.subscribe('fullUserInfo');
	}
}
);

Router.route('/foxy', {
	subscriptions() {
		if (Meteor.userId()) {
			return [
				Meteor.subscribe('MetaObjectsWithAccess'),
				Meteor.subscribe('data.Preference', {'_user._id': Meteor.userId()}, 1000),
				Meteor.subscribe('metaObject')
			];
		}
	},
	action() {
		this.layout('master');
		return this.render('index');
	}
}
);


Router.route('/foxy/list/:documentName/:listName', {
	subscriptions() {
		if (Meteor.userId()) {
			return [
				Meteor.subscribe('MetaObjectsWithAccess'),
				Meteor.subscribe('data.Preference', {'_user._id': Meteor.userId()}, 1000),
				Meteor.subscribe('metaObject')
			];
		}
	},
	action() {
		let metaView;
		const { params } = this;

		const metaDocument = Menu.findOne({
			_id: params.documentName});

		if (metaDocument != null) {
			Session.set('main-menu-active', metaDocument.group || metaDocument._id);
		}

		const metaList = Menu.findOne({
			document: params.documentName,
			name: params.listName,
			type: 'list'
		});

		if (metaList != null) {
			Session.set('main-submenu-active', metaList._id);

			metaView = Menu.findOne({
				document: params.documentName,
				name: metaList.view,
				type: 'view'
			});
		}

		if ((metaDocument == null) || (metaList == null) || !MetaObject.findOne(params.documentName)) {
			this.layout('master');
		} else {
			this.layout('master', {
				data: {
					meta: {
						document: metaDocument,
						list: metaList,
						view: metaView
					},
					data: (Models[params.documentName] != null ? Models[params.documentName].find({}) : undefined)
				}
			});

			Tracker.autorun(() => Meteor.subscribe(`data.${params.documentName}`, Session.get('filter')));
		}

		return this.render('index');
	}
}
);
