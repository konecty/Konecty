import { Collection, Document } from 'mongodb';
import { MetaAccess } from '@imports/model/MetaAccess';
import { db } from '../database';

interface Data {
	MetaObject: Collection<Document>;
	Meta: Record<string, any>;
	DisplayMeta: Record<string, any>;
	Access: Record<string, MetaAccess>;
	References: Record<string, any>;
	Namespace: Record<string, any>;
	MetaByCollection: Record<string, any>;
	Collections: Record<string, Collection>;
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
