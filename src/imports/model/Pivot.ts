import { z } from 'zod';
import { LabelSchema } from './Label';

export const PivotSchema = z.object({
	type: z.literal('pivot'),
	_id: z.string(),
	group: z.string().optional(),
	menuSorter: z.number().optional(),
	document: z.string(),
	name: z.string(),
	label: LabelSchema,
	plurals: LabelSchema,
	icon: z.string().optional(),
	rows: z.array(z.any()).optional(), // TODO: Definir o tipo correto
	collection: z.string().optional(),
});

export type Pivot = z.infer<typeof PivotSchema>;
