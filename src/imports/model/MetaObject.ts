import buildReferences from '@imports/meta/buildReferences';
import { MetaAccess } from '@imports/model/MetaAccess';
import { MetaObjectType } from '@imports/types/metadata';
import { Collection } from 'mongodb';
import { db } from '../database';
import type { Document } from './Document';

interface Data {
	MetaObject: Collection<Document>;
	Meta: Record<string, MetaObjectType>;
	DisplayMeta: Record<string, any>;
	Access: Record<string, MetaAccess>;
	References: ReturnType<typeof buildReferences>;
	Namespace: Record<string, any> & { useExternalKonsistent?: boolean };
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
