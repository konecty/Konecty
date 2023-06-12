import { Meteor } from 'meteor/meteor';

import { MetaObject, Namespace, Meta } from '/imports/model/MetaObject';
import { buildReferences } from './buildReferences';
import { Konsistent } from './consts';
import { Templates, mailConsumer } from './mailConsumer';
import './history';
import { logger } from '/imports/utils/logger';

const rebuildReferences = function () {
	Konsistent.History.setup();

	logger.info('[konsistent] Rebuilding references');
	Konsistent.References = buildReferences(Meta);
	logger.debug('[konsistent] Rebuilding references done');
};

const registerMeta = function (meta) {
	if (!meta.collection) {
		meta.collection = `data.${meta.name}`;
	}
	Meta[meta.name] = meta;
	Konsistent.MetaByCollection[meta.collection] = meta;

	if (!Konsistent.Models[meta.name]) {
		Konsistent.Models[`${meta.name}.History`] = Konsistent._Models[`${meta.name}.History`] || new Meteor.Collection(`${meta.collection}.History`);
		Konsistent.Models[`${meta.name}.Trash`] = Konsistent._Models[`${meta.name}.Trash`] || new Meteor.Collection(`${meta.collection}.Trash`);
		Konsistent.Models[`${meta.name}.Comment`] = Konsistent._Models[`${meta.name}.Comment`] || new Meteor.Collection(`${meta.collection}.Comment`);
		Konsistent.Models[`${meta.name}.AutoNumber`] = Konsistent._Models[`${meta.name}.AutoNumber`] || new Meteor.Collection(`${meta.collection}.AutoNumber`);

		switch (meta.collection) {
			case 'users':
				Konsistent.Models[meta.name] = Meteor.users;
			default:
				Konsistent.Models[meta.name] = Konsistent._Models[meta.name] || new Meteor.Collection(meta.collection);
		}
	}
};

const deregisterMeta = function (meta) {
	delete Meta[meta.name];
	delete Konsistent.Models[`${meta.name}.History`];
	delete Konsistent.Models[`${meta.name}.Trash`];
	delete Konsistent.Models[`${meta.name}.Comment`];
	delete Konsistent.Models[`${meta.name}.AutoNumber`];
	delete Konsistent.Models[meta.name];
};

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

Konsistent.start = function (MetaObject, Models, rebuildMetas = true) {
	Konsistent.MetaObject = MetaObject;
	Konsistent._Models = Models || {};

	const MetaObjectQuery = { type: 'document' };

	if (Konsistent._Models.Template) {
		logger.debug('[konsistent] Registering templates');
		Konsistent._Models.Template.find({ type: 'email' }).observe({
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

	Konsistent.MetaObject.find({ type: 'namespace' }).observe({
		added(meta) {
			Namespace = meta;
		},

		changed(meta) {
			Namespace = meta;
		},
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
			},
		});

		mailConsumer.start();
	}
};

export { Konsistent };
