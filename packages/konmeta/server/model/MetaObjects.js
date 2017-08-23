import { Mongo } from 'meteor/mongo';

const MetaObjects = new Mongo.Collection('MetaObjects');

// MetaObject._ensureIndex({namespace: 1, document: 1, type: 1, name: 1}, {unique: 1});

export default MetaObjects;
