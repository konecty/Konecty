import { db } from '@konecty/database';

const getCollection = async name => {
	return db.collection(name);
};

getCollection.default = getCollection;

export default getCollection;
