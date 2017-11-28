import Db from './Db';
import Schema from './Schema';

export default async function loadSchemaFromExternalDB() {
	const db = await Db.getConnection();
	db.collection('Namespace').find({_id: process.env.KONMETA_NAMESPACE }).forEach(Meteor.bindEnvironment(namespace => {
		Schema.processNamespaceHierarchy(namespace);
		Schema.copyNamespace(namespace);
	}));
};
