import { z } from 'zod';
import { FieldSchema } from './Field';
import { LabelSchema } from './Label';

export const CompositeSchema = z.object({
	type: z.literal('composite'),
	_id: z.string(),
	name: z.string(),
	label: LabelSchema,
	fields: z.record(z.string(), FieldSchema),
	collection: z.string().optional(),
	document: z.string().optional(),
	indexes: z
		.record(
			z.string(),
			z.object({
				version: z.number().optional(),
				keys: z.record(z.string(), z.number()),
				options: z.object({
					name: z.string().optional(),
					unique: z.boolean().optional(),
					dropDups: z.boolean().optional(),
				}),
			}),
		)
		.optional(),
	indexText: z.record(z.string(), z.string()).optional(),
});

export type Composite = z.infer<typeof CompositeSchema>;
