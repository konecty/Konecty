import { z } from 'zod';

export const AccessSchema = z
	.object({
		type: z.literal('access'),
		_id: z.string(),
		document: z.string(),
		name: z.string(),
		collection: z.string().optional(),
	})
	.passthrough();

export type Access = z.infer<typeof AccessSchema>;
