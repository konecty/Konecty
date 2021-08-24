import { db } from 'database';

const getCollection = async name => {
	return db.collection(name);
};

getCollection.default = getCollection;

export default getCollection;
