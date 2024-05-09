import { z } from 'zod';
import { LabelSchema } from './Label';

export const GroupSchema = z.object({
	type: z.literal('group'),
	_id: z.string(),
	document: z.string().optional(),
	name: z.string(),
	group: z.string().optional(),
	menuSorter: z.number().optional(),
	label: LabelSchema,
	plurals: LabelSchema,
	icon: z.string().optional(),
	collection: z.string().optional(),
});

export type Group = z.infer<typeof GroupSchema>;
