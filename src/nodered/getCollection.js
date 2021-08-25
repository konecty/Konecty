import { db } from 'database';

const getCollection = async name => db.collection(name);

getCollection.default = getCollection;

export default getCollection;
