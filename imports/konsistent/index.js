import { SSR, Template } from 'meteor/meteorhacks:ssr';

import { Models } from '/imports/model/MetaObject';
import { Konsistent } from './consts';
import { Templates, mailConsumer } from './mailConsumer';
import './history';
import { logger } from '/imports/utils/logger';

const registerTemplate = function (record) {
	try {
		Templates[record._id] = {
			template: SSR.compileTemplate(record._id, record.value),
			subject: record.subject,
		};

		for (let name in record.helpers) {
			let fn = record.helpers[name];
			const helper = {};
			fn = [].concat(fn);
			helper[name] = Function.apply(null, fn);
			Template[record._id].helpers(helper);
		}
	} catch (err) {
		console.error(`Error register template ${record.name}: ${err.message}`);
	}
};

Konsistent.start = function () {
	if (Models.Template) {
		logger.debug('[konsistent] Registering templates');
		Models.Template.find({ type: 'email' }).observe({
			added(record) {
				registerTemplate(record);
			},

			changed(record) {
				registerTemplate(record);
			},

			removed(record) {
				delete Templates[record._id];
			},
		});
	}

	Konsistent.History.setup();
	mailConsumer.start();
};

export { Konsistent };
