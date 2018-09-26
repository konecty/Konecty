Meteor.methods({
  'facebook.revoke'() {
    if (!Meteor.userId()) {
      throw new Meteor.Error('invalid-user');
    }

    Meteor.users.update(Meteor.userId(), {
      $unset: {
        'services.facebook': 1
      }
    });
  }
});
