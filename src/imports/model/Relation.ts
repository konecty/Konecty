import { z } from 'zod';
import { KonFilter } from './Filter';

export const RelationSchema = z.object({
	document: z.string(),
	lookup: z.string(),
	aggregators: z.record(
		z.object({
			aggregator: z.string(),
			field: z.string().optional(),
		}),
	),
	filter: KonFilter.optional(),
});

export type Relation = z.infer<typeof RelationSchema>;
