Meteor.publish('metaObject', function() {
  if (!this.userId) {
    return this.ready();
  }

  return MetaObject.find();
});
