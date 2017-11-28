import { Mongo } from 'meteor/mongo';

const coreMetaObject = new Mongo.Collection('MetaObject');

coreMetaObject._ensureIndex({namespace: 1, document: 1, type: 1, name: 1}, {unique: 1});

export default coreMetaObject;
