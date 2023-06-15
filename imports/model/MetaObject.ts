import { Mongo } from 'meteor/mongo';

export const MetaObject = new Mongo.Collection('MetaObjects');

export const MetaObjectCollection = MetaObject.rawCollection();

export const Meta = {};
export const DisplayMeta = {};
export const Access = {};
export const References = {};
export const Namespace = {};
export const Models = {};
export const MetaByCollection = {};
