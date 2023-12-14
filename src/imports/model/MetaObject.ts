import buildReferences from '@imports/meta/buildReferences';
import { MetaAccess } from '@imports/model/MetaAccess';
import { MetaObjectType } from '@imports/types/metadata';
import { Collection } from 'mongodb';
import { db } from '../database';
import type { Document } from './Document';
import { Namespace } from './Namespace';

interface Data {
	MetaObject: Collection<MetaObjectType>;
	Meta: Record<string, Document>;
	DisplayMeta: Record<string, any>;
	Access: Record<string, MetaAccess>;
	References: ReturnType<typeof buildReferences>;
	Namespace: Namespace;
	MetaByCollection: Record<string, any>;
	Collections: Record<string, Collection>;
}

const MetaObject: Data = {
	MetaObject: db.collection('MetaObjects'),
	Meta: {},
	DisplayMeta: {},
	Access: {},
	References: {},
	Namespace: { type: 'Namespace' },
	MetaByCollection: {},
	Collections: {},
};

export { MetaObject };
