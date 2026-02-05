import { z } from 'zod';

export const Condition = z.object({
	term: z.string(),
	operator: z.string(),
	value: z
		.union([z.string(), z.number(), z.boolean(), z.any(), z.array(z.union([z.string(), z.number(), z.boolean()]))])
		.optional()
		.nullable(),
	editable: z.boolean().optional(),
	disabled: z.boolean().optional(),
	sort: z.number().optional(),
	style: z
		.object({
			// renderAs: z.enum(['checbox', 'lookupfield', 'datetimefield', 'textfield', 'radiobox']).optional(),
			renderAs: z.string().optional(), // o ideal seria mapear todos as possibilidades
			columns: z.number().optional(),
			hideOnDisable: z.boolean().optional(),
			customLabel: z.string().optional(),

			// Configs related to the slider filter
			minValue: z.number().optional(),
			maxValue: z.number().optional(),
			unlimitedMaxValue: z.boolean().optional(),
			steps: z.number().optional(),
			infinity: z.boolean().optional(),
		})
		.catchall(z.any())
		.optional(),
});

export const KonFilter = z.object({
	match: z.literal('and').or(z.literal('or')),
	conditions: z.array(Condition).optional().or(z.record(Condition).optional()),
	textSearch: z.string().optional(),
	filters: z
		.array(
			z.object({
				match: z.literal('and').or(z.literal('or')).optional(),
				conditions: z.array(Condition).optional().or(z.record(Condition).optional()),
				textSearch: z.string().optional(),
			}),
		)

		.optional(),
});

export type KonFilter = z.infer<typeof KonFilter>;
export type KonCondition = z.infer<typeof Condition>;
