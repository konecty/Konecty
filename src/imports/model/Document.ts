import { z } from 'zod';

// TODO: add more fields to validator
export const DocumentSchema = z.object({
	_id: z.string(),
	name: z.string(),
	label: z.record(z.string()),
	plurals: z.record(z.string()),
	fields: z.record(z.record(z.any())),
	type: z.enum(['document', 'composite', 'group', 'access', 'pivot', 'view', 'list', 'namespace']),
});

export type Document = z.infer<typeof DocumentSchema>;
