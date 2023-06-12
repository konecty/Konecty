import { Meteor } from 'meteor/meteor';
import isEmpty from 'lodash/isEmpty';

import { MetaObject, Models } from '/imports/model/MetaObject';
import { Konsistent } from '/imports/konsistent';

Accounts.config({ forbidClientAccountCreation: true });

Meteor.startup(function () {
	Konsistent.start(MetaObject, Models, isEmpty(process.env.DISABLE_KONSISTENT) || process.env.DISABLE_KONSISTENT === 'false' || process.env.DISABLE_KONSISTENT === '0');
});
