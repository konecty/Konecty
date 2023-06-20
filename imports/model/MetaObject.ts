import { Mongo } from 'meteor/mongo';
import { Collection } from 'mongodb';

export const MetaObject = new Mongo.Collection('MetaObjects');

export const MetaObjectCollection = MetaObject.rawCollection();

export const Meta = {};
export const DisplayMeta = {};
export const Access: Record<string, unknown> = {};
export const References = {};
export const Namespace = {};
export const Models = {};
export const MetaByCollection = {};
export const Collections: Record<string, Collection> = {};
