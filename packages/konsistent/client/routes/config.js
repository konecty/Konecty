ListMetaController = RouteController.extend({
  template: 'ListMeta',
  data() {
    const { params } = this;
    const query = {};

    const meta = MetaObject.find().fetch();

    const Meta = {};

    for (let item of meta) {
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
  layoutTemplate: 'slimLayout'
});

Router.map(function() {
  this.route('ListMeta', {
    path: '/konsistent',
    controller: ListMetaController
  });
});
