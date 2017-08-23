import fs from 'fs';
import readline from 'readline';

import coreMetaObject from '../model/coreMetaObject';
import coreNamespace from '../model/coreNamespace';

if (!process.env.KONMETA_DB_URL) {
	const meta = coreMetaObject.findOne({ namespace: 'base' }, { fields: { _id: 1 } });
	if (!meta) {
		readline.createInterface({
			input: fs.createReadStream(Assets.absoluteFilePath('metadata/core.MetaObject.json')),
			terminal: false
		}).on('line', Meteor.bindEnvironment((line) => {
			coreMetaObject.insert(JSON.parse(line));
		}));
	}

	const namespace = coreNamespace.findOne({ _id: 'base' }, { fields: { _id: 1 } });
	if (!namespace) {
		readline.createInterface({
			input: fs.createReadStream(Assets.absoluteFilePath('metadata/core.Namespace.json')),
			terminal: false
		}).on('line', Meteor.bindEnvironment((line) => {
			coreNamespace.insert(JSON.parse(line));
		}));
	}

	const currentNamespace = coreNamespace.findOne({ _id: process.env.KONMETA_NAMESPACE }, { fields: { _id: 1 } });
	if (!currentNamespace) {
		coreNamespace.insert({
			_id: process.env.KONMETA_NAMESPACE,
			active: true,
			name: process.env.KONMETA_NAMESPACE,
			version: 1,
			parents: [ 'base' ]
		});
	}
}
