import { z } from 'zod';

export const RelationSchema = z.object({
	document: z.string(),
	lookup: z.string(),
	aggregators: z.record(
		z.object({
			aggregator: z.string(),
			field: z.string(),
		}),
	),
	filter: z
		.object({
			match: z.enum(['and', 'or']),
			conditions: z.array(
				z.object({
					operator: z.string(),
					term: z.string(),
					editable: z.boolean().optional(),
					disabled: z.boolean().optional(),
					sort: z.number().optional(),
					value: z.any().optional(),
					style: z.any().optional(),
				}),
			),
		})
		.optional(),
});

export type Relation = z.infer<typeof RelationSchema>;
