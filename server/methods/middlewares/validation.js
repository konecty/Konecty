// Middleware to verify if user have permission to create records
/* @DEPENDS_ON_ACCESS */
Meteor.registerMiddleware('ifAccessIsCreateable', function(request) {
  if (this.access.isCreatable !== true) {
    return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to create records`, {
      bugsnag: false
    });
  }
});

// Middleware to verify if user have permission to update records
/* @DEPENDS_ON_ACCESS */
Meteor.registerMiddleware('ifAccessIsUpdatable', function(request) {
  if (this.access.isUpdatable !== true) {
    return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to update this record`);
  }
});

// Middleware to verify if user have permission to delete records
/* @DEPENDS_ON_ACCESS */
Meteor.registerMiddleware('ifAccessIsDeletable', function(request) {
  if (this.access.isDeletable !== true) {
    return new Meteor.Error('internal-error', `[${request.document}] You don't have permission to delete this record`);
  }
});

// Middleware to verify if update playload is valid
/* @DEPENDS_ON_META */
Meteor.registerMiddleware('ifUpdateIsValid', function(request) {
  if (!_.isObject(request.data)) {
    return new Meteor.Error('internal-error', `[${request.document}] Invalid payload`);
  }

  if (!_.isArray(request.data.ids) || request.data.ids.length === 0) {
    return new Meteor.Error('internal-error', `[${request.document}] Payload must contain an array of ids with at least one item`);
  }

  if (!_.isObject(request.data.data) || Object.keys(request.data.data).length === 0) {
    return new Meteor.Error(
      'internal-error',
      `[${request.document}] Payload must contain an object with data to update with at least one item`
    );
  }

  const { meta } = this;

  for (let item of request.data.ids) {
    if (!_.isObject(item) || !_.isString(item._id)) {
      return new Meteor.Error('internal-error', `[${request.document}] Each id must contain an valid _id`);
    }

    if (meta.ignoreUpdatedAt !== true) {
      if (!_.isObject(item) || !_.isObject(item._updatedAt) || !_.isString(item._updatedAt.$date)) {
        return new Meteor.Error('internal-error', `[${request.document}] Each id must contain an date field named _updatedAt`);
      }
    }
  }
});

// Middleware to verify if create playload is valid
Meteor.registerMiddleware('ifCreateIsValid', function(request) {
  if (!_.isObject(request.data)) {
    return new Meteor.Error('internal-error', 'Invalid payload');
  }

  if (!_.isObject(request.data) || Object.keys(request.data).length === 0) {
    return new Meteor.Error('internal-error', `[${request.document}] Payload must contain an object with at least one item`);
  }
});
