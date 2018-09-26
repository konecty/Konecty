import { get } from 'lodash';
import { register, notify } from 'bugsnag';

import { parse } from 'mongodb-uri';
const uriObject = parse(process.env.MONGO_URL);
process.env.dbName = uriObject.database;

register('e6464a5423ceea7cb3b5b7ee8731f0fb');

class KonectyError extends Error {
  constructor(msg, options) {
    super(msg);
    if (options === null) {
      options = {};
    }
    this.message = msg;
    for (let key in options) {
      const value = options[key];
      this[key] = value;
    }
  }
}

global.KonectyError = KonectyError;

class ErrorWithCode extends Error {
  constructor(code, msg) {
    super(msg);
    this.message = msg;
    this.code = code;
  }
}

global.ErrorWithCode = ErrorWithCode;

global.NotifyErrors = {};

NotifyErrors.notify = function(type, message, options) {
  if (type instanceof Error && options === null) {
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

  notify(reportError, reportOptions);
};

process.on('uncaughtException', error => NotifyErrors.notify('uncaughtException', error));

const originalMeteorDebug = Meteor._debug;
Meteor._debug = function(message, stack) {
  if (typeof stack === 'string') {
    message += ` ${stack}`;
  }

  const error = new Error(message);
  error.stack = stack;

  NotifyErrors.notify('Meteor._debug', error);

  originalMeteorDebug.apply(this, arguments);
};
