Meteor.publish('fullUserInfo', function() {
  if (!this.userId) {
    return this.ready();
  }

  return Meteor.users.find(this.userId);
});
