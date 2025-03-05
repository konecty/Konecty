import { z } from 'zod';
import { FieldSchema } from '../Field';
import { LabelSchema } from '../Label';
import { RelationSchema } from '../Relation';
import { DocumentEventSchema } from './DocumentEvents';

export const DocumentSchema = z
	.object({
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

		scriptBeforeValidation: z.string().optional(),
		validationScript: z.string().optional(),
		scriptAfterSave: z.string().optional(),

		indexes: z
			.record(
				z.object({
					keys: z.record(z.string(), z.union([z.number(), z.boolean()])),
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

		events: z.array(DocumentEventSchema).optional(),
	})
	.passthrough();

export type Document = z.infer<typeof DocumentSchema>;
