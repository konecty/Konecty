Namespace = {};

const rebuildReferences = function() {
  Konsistent.History.setup();

  console.log('[konsistent] Rebuilding references');
  Konsistent.References = buildReferences(Meta);
};

const registerMeta = function(meta) {
  if (!meta.collection) {
    meta.collection = `data.${meta.name}`;
  }
  Meta[meta.name] = meta;
  Konsistent.MetaByCollection[meta.collection] = meta;

  if (!Konsistent.Models[meta.name]) {
    Konsistent.Models[`${meta.name}.History`] =
      Konsistent._Models[`${meta.name}.History`] || new Meteor.Collection(`${meta.collection}.History`);
    Konsistent.Models[`${meta.name}.Trash`] =
      Konsistent._Models[`${meta.name}.Trash`] || new Meteor.Collection(`${meta.collection}.Trash`);
    Konsistent.Models[`${meta.name}.Comment`] =
      Konsistent._Models[`${meta.name}.Comment`] || new Meteor.Collection(`${meta.collection}.Comment`);
    Konsistent.Models[`${meta.name}.AutoNumber`] =
      Konsistent._Models[`${meta.name}.AutoNumber`] || new Meteor.Collection(`${meta.collection}.AutoNumber`);

    switch (meta.collection) {
      case 'users':
        Konsistent.Models[meta.name] = Meteor.users;
      default:
        Konsistent.Models[meta.name] = Konsistent._Models[meta.name] || new Meteor.Collection(meta.collection);
    }
  }
};

const deregisterMeta = function(meta) {
  delete Meta[meta.name];
  delete Konsistent.Models[`${meta.name}.History`];
  delete Konsistent.Models[`${meta.name}.Trash`];
  delete Konsistent.Models[`${meta.name}.Comment`];
  delete Konsistent.Models[`${meta.name}.AutoNumber`];
  delete Konsistent.Models[meta.name];
};

const registerTemplate = function(record) {
  Templates[record._id] = {
    template: SSR.compileTemplate(record._id, record.value),
    subject: record.subject
  };

  for (let name in record.helpers) {
    let fn = record.helpers[name];
    const helper = {};
    fn = [].concat(fn);
    helper[name] = Function.apply(null, fn);
    Template[record._id].helpers(helper);
  }
};

Konsistent.start = function(MetaObject, Models, rebuildMetas) {
  if (typeof rebuildMetas === 'undefined') {
    rebuildMetas = true;
  }
  Konsistent.MetaObject = MetaObject;
  Konsistent._Models = Models || {};

  UserPresenceMonitor.setVisitorStatus = function(id, status) {
    if (!Konsistent._Models.ChatVisitor) {
      Konsistent._Models.ChatVisitor = new Meteor.Collection('data.ChatVisitor');
    }
    Konsistent._Models.ChatVisitor.update({ _id: id, userStatus: { $ne: status } }, { $set: { userStatus: status } });
  };

  UserPresenceMonitor.start();

  const MetaObjectQuery = { type: 'document' };

  Meteor.publish('konsistent/metaObject', function() {
    if (!this.userId) {
      return this.ready();
    }

    return Konsistent.MetaObject.find(MetaObjectQuery);
  });

  if (Konsistent._Models.Template) {
    Konsistent._Models.Template.find({ type: 'email' }).observe({
      added(record) {
        registerTemplate(record);
      },

      changed(record) {
        registerTemplate(record);
      },

      removed(record) {
        delete Templates[record._id];
      }
    });
  }

  Konsistent.MetaObject.find({ type: 'namespace' }).observe({
    added(meta) {
      global.Namespace = meta;
    },

    changed(meta) {
      global.Namespace = meta;
    }
  });

  if (rebuildMetas) {
    let rebuildReferencesTimer = null;
    const rebuildReferencesDelay = 100;
    Konsistent.MetaObject.find(MetaObjectQuery).observe({
      added(meta) {
        registerMeta(meta);

        clearTimeout(rebuildReferencesTimer);
        rebuildReferencesTimer = setTimeout(Meteor.bindEnvironment(rebuildReferences), rebuildReferencesDelay);
      },

      changed(meta) {
        registerMeta(meta);

        clearTimeout(rebuildReferencesTimer);
        rebuildReferencesTimer = setTimeout(Meteor.bindEnvironment(rebuildReferences), rebuildReferencesDelay);
      },

      removed(meta) {
        deregisterMeta(meta);

        clearTimeout(rebuildReferencesTimer);
        rebuildReferencesTimer = setTimeout(Meteor.bindEnvironment(rebuildReferences), rebuildReferencesDelay);
      }
    });

    mailConsumer.start();
  }

  Accounts.loginServiceConfiguration.remove({
    service: 'google'
  });

  if (global.Namespace.googleApp) {
    console.log('Setup google config for accounts'.green);
    Accounts.loginServiceConfiguration.insert({
      service: 'google',
      clientId: global.Namespace.googleApp.clientId,
      secret: global.Namespace.googleApp.secret
    });
  }

  Accounts.loginServiceConfiguration.remove({
    service: 'facebook'
  });

  if (global.Namespace.facebookApp) {
    console.log('Setup facebook config for accounts'.green);
    Accounts.loginServiceConfiguration.insert({
      service: 'facebook',
      appId: global.Namespace.facebookApp.appId,
      secret: global.Namespace.facebookApp.secret
    });
  }
};
