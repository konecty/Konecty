import { z } from 'zod';

// TODO: add more fields to validator
export const DocumentSchema = z.object({
	_id: z.string(),
	name: z.string(),
	label: z.record(z.string()),
	plurals: z.record(z.string()),
	fields: z.record(z.record(z.any())),
});

export type Document = z.infer<typeof DocumentSchema>;
