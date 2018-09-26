import bugsnag from 'bugsnag';
import { get } from 'lodash';

global.NotifyErrors = {};

NotifyErrors.notify = function(type, message, options) {
  if (type instanceof Error && !options) {
    options = message;
    message = type;
    type = undefined;
  }

  options = options || {};

  if (get(message, 'details.bugsnag') === false) {
    return;
  }

  const reportError = new Error(type);
  const reportOptions = {
    ...options,
    errorName: `[${process.env.dbName}] ${type}`,
    metadata: {
      ...options.metadata,
      errorDetais: message
    }
  };

  bugsnag.notify(reportError, reportOptions);
};

process.on('uncaughtException', error => NotifyErrors.notify('uncaughtException', error));

const originalMeteorDebug = Meteor._debug;
Meteor._debug = function(message, stack) {
  if (typeof stack === 'string') {
    message += ` ${stack}`;
  }

  const error = new Error(message);
  if (typeof stack === 'string') {
    error.stack = stack;
  }

  NotifyErrors.notify('Meteor._debug', error);

  return originalMeteorDebug.apply(this, arguments);
};
