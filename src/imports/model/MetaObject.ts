import buildReferences from '@imports/meta/buildReferences';
import { MetaAccess } from '@imports/model/MetaAccess';
import { DataDocument } from '@imports/types/data';
import { MetaObjectType } from '@imports/types/metadata';
import { Collection } from 'mongodb';
import { db } from '../database';
import type { Document } from './Document';
import { List } from './List';
import type { Namespace } from './Namespace';
import { Pivot } from './Pivot';

interface Data {
	MetaObject: Collection<MetaObjectType>;
	Meta: Record<string, Document>;
	DisplayMeta: Record<string, List | Pivot>;
	Access: Record<string, MetaAccess>;
	References: ReturnType<typeof buildReferences>;
	Namespace: Namespace;
	MetaByCollection: Record<string, any>;
	Collections: Record<string, Collection<DataDocument>>;
}

const MetaObject: Data = {
	MetaObject: db.collection('MetaObjects'),
	Meta: {},
	DisplayMeta: {},
	Access: {},
	References: {},
	Namespace: { _id: 'Namespace', type: 'namespace', ns: 'ns' },
	MetaByCollection: {},
	Collections: {},
};

export { MetaObject };
