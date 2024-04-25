import { z } from 'zod';

export const Condition = z.object({
	term: z.string(),
	operator: z.string(),
	value: z.string(),
	editable: z.boolean().optional(),
	disabled: z.boolean().optional(),
});

export const KonFilter = z.object({
	match: z.literal('and').or(z.literal('or')),
	conditions: z.array(Condition).optional(),
	textSearch: z.string().optional(),
	filters: z
		.array(
			z.object({
				match: z.literal('and').or(z.literal('or')).optional(),
				conditions: z.array(Condition).optional(),
				textSearch: z.string().optional(),
			}),
		)

		.optional(),
});

export type KonFilter = z.infer<typeof KonFilter>;
export type KonCondition = z.infer<typeof Condition>;
