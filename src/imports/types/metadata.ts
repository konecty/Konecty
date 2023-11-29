import { AccessSchema } from '@imports/model/Access';
import { CompositeSchema } from '@imports/model/Composite';
import { DocumentSchema } from '@imports/model/Document';
import { FormSchema } from '@imports/model/Form';
import { GroupSchema } from '@imports/model/Group';
import { ListSchema } from '@imports/model/List';
import { NamespaceSchema } from '@imports/model/Namespace';
import { PivotSchema } from '@imports/model/Pivot';
import { z } from 'zod';

// Definição do tipo "Integration"
export const MetaObjectSchema = z.discriminatedUnion('type', [DocumentSchema, CompositeSchema, GroupSchema, ListSchema, FormSchema, PivotSchema, AccessSchema, NamespaceSchema]);

export type MetaObjectType = z.infer<typeof MetaObjectSchema>;
