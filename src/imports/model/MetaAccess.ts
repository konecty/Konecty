import { z } from 'zod';
import { Condition, KonFilter } from './Filter';

export const FieldAccessSchema = z.record(
	z.literal('CREATE').or(z.literal('READ')).or(z.literal('UPDATE')).or(z.literal('DELETE')),
	z.object({
		condition: Condition.optional(),
		allow: z.boolean().optional(),
	}),
);

export type FieldAccess = z.infer<typeof FieldAccessSchema>;

export const MetaAccessSchema = z.object({
	document: z.string(),

	fields: z.record(FieldAccessSchema),
	fieldDefaults: z.object({
		isUpdatable: z.boolean().optional(),
		isCreatable: z.boolean().optional(),
		isReadable: z.boolean().optional(),
		isDeletable: z.boolean().optional(),
	}),
	isUpdatable: z.boolean().optional(),
	isCreatable: z.boolean().optional(),
	isReadable: z.boolean().optional(),
	isDeletable: z.boolean().optional(),

	readFilter: KonFilter.optional(),
	updateFilter: KonFilter.optional(),
});

export type MetaAccess = z.infer<typeof MetaAccessSchema>;
