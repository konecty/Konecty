import { Meteor } from 'meteor/meteor';
import { MongoInternals } from 'meteor/mongo';

const getCollection = async name => {
	const { db } = MongoInternals.defaultRemoteCollectionDriver().mongo;
	return db.collection(name);
};

getCollection.default = getCollection;

export default getCollection;
