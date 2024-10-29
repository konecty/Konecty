import { z } from 'zod';
import { LabelSchema } from './Label';
import { VisualsSchema } from './Visuals';

export const FormSchema = z.object({
	type: z.literal('view'),
	_id: z.string(),
	document: z.string(),
	name: z.string(),
	label: LabelSchema,
	plurals: LabelSchema,
	icon: z.string().optional(),
	visuals: z.array(VisualsSchema).optional(),
	collection: z.string().optional(),
	namespace: z.array(z.string()).optional(),
	parent: z.string().optional(),
});

export type Form = z.infer<typeof FormSchema>;
