import { z } from 'zod';

export const FieldAccessSchema = z.record(
	z.literal('CREATE').or(z.literal('READ')).or(z.literal('UPDATE')).or(z.literal('DELETE')),
	z.object({
		condition: z.unknown().optional(),
		allow: z.boolean().optional(),
	}),
);

export type FieldAccess = z.infer<typeof FieldAccessSchema>;

export const MetaAccessSchema = z.object({
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
});

export type MetaAccess = z.infer<typeof MetaAccessSchema>;
