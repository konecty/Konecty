import { Meteor } from 'meteor/meteor';
import { Mongo, MongoInternals } from 'meteor/mongo';

const getCollection = async name => {
	const { db } = MongoInternals.defaultRemoteCollectionDriver().mongo;
	return db.collection(name);
};

export default getCollection;
