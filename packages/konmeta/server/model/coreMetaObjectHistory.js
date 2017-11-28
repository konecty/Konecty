import { Mongo } from 'meteor/mongo';

const coreMetaObjectHistory = new Mongo.Collection('MetaObject.History');

coreMetaObjectHistory._ensureIndex({'version.hash': 1});

export default coreMetaObjectHistory;
