import { z } from 'zod';
import { FieldSchema } from './Field';
import { LabelSchema } from './Label';
import { RelationSchema } from './Relation';

export const DocumentSchema = z.object({
	type: z.literal('document'),
	_id: z.string(),
	name: z.string(),
	label: LabelSchema,
	plurals: LabelSchema,
	icon: z.string(),
	colletion: z.string().optional(),
	fields: z.record(z.string(), FieldSchema),
	menuSorter: z.number().optional(),
	document: z.string().optional(),
	access: z.string().optional(),
	group: z.string().optional(),
	validationScript: z.string().optional(),
	indexes: z
		.record(
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
	indexText: z.record(z.string()).optional(),
	help: LabelSchema.optional(),
	description: LabelSchema.optional(),
	relations: z.array(RelationSchema).optional(),
	collection: z.string().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;
