import buildReferences from '@imports/meta/buildReferences';
import { MetaAccess } from '@imports/model/MetaAccess';
import { MetaObjectType } from '@imports/types/metadata';
import { Collection } from 'mongodb';
import { db } from '../database';
import type { Document } from './Document';
import { List } from './List';
import { Namespace } from './Namespace';
import { Pivot } from './Pivot';

interface Data {
	MetaObject: Collection<MetaObjectType>;
	Meta: Record<string, Document>;
	DisplayMeta: Record<string, List | Pivot>;
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
	Namespace: { type: 'namespace' },
	MetaByCollection: {},
	Collections: {},
};

export { MetaObject };
