import { MetaAccess } from '@imports/model/MetaAccess';
import { Collection } from 'mongodb';
import { db } from '../database';
import type { Document } from './Document';

export type DataDocument = object & { _id: string };

interface Data {
	MetaObject: Collection<Document>;
	Meta: Record<string, any>;
	DisplayMeta: Record<string, any>;
	Access: Record<string, MetaAccess>;
	References: Record<string, any>;
	Namespace: Record<string, any>;
	MetaByCollection: Record<string, any>;
	Collections: Record<string, Collection<DataDocument>>;
}

const MetaObject: Data = {
	MetaObject: db.collection('MetaObjects'),
	Meta: {},
	DisplayMeta: {},
	Access: {},
	References: {},
	Namespace: {},
	MetaByCollection: {},
	Collections: {},
};

export { MetaObject };
