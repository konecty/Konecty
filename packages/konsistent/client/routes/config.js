/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const ListMetaController = RouteController.extend({
	template: 'ListMeta',
	data() {
		const { params } = this;
		const query = {};

		const meta = MetaObject.find().fetch();

		const Meta = {};

		for (let item of Array.from(meta)) {
			Meta[item.name] = item;
		}

		const References = buildReferences(Meta);

		return {
			id: 'History',
			meta: params.meta,
			dataId: params._id,
			data() {
				return References;
			}
		};
	},

	waitOn() {
		return Meteor.subscribe('konsistent/metaObject');
	}
});

Router.configure({
	layoutTemplate: 'slimLayout'});

Router.map(function() {
	return this.route('ListMeta', {
		path: '/konsistent',
		controller: ListMetaController
	}
	);
});
