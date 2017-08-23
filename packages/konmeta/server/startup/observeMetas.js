import { Meteor } from 'meteor/meteor';

import CoreMetaObject from '../model/coreMetaObject';
import CoreNamespace from '../model/coreNamespace';

import Schema from '../lib/Schema';
import MetaHistory from '../lib/MetaHistory';

import loadSchemaFromExternalDB from '../lib/loadSchemaFromExternalDB';

Meteor.startup(() => {
	if (!process.env.KONMETA_NAMESPACE) {
		console.error('Required environment variable \'KONMETA_NAMESPACE\' has not been set!');
		return process.exit(1);
	}

	if (!process.env.KONMETA_DB_URL) {
		CoreNamespace.find({ _id: process.env.KONMETA_NAMESPACE }).observe({
			added(namespace) {
				Schema.processNamespaceHierarchy(namespace);
				Schema.copyNamespace(namespace);
			},
			changed(namespace) {
				Schema.processNamespaceHierarchy(namespace);
				Schema.copyNamespace(namespace);
			}
		});

		CoreMetaObject.find().observeChanges({
			added(_id, fields) {
				const meta = CoreMetaObject.findOne({ _id });
				// Schema.saveFlat meta.namespace, Schema.process(meta)
				MetaHistory.backup(meta);
			},
			removed(id, fields) {
				// console.log(id, fields);
			},
			changed(_id, fields) {
				const meta = CoreMetaObject.findOne({ _id });
				// Schema.saveFlat meta.namespace, Schema.process(meta)
				MetaHistory.backup(meta);
			}
		});
	// } else {
	// 	loadSchemaFromExternalDB();
	}
});
