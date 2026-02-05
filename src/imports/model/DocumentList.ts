import { z } from 'zod';

export const DocumentListSchema = z.object({
	_id: z.string(),
	name: z.string(),
	document: z.string().optional(),
	label: z.string(),
	plurals: z.string(),
	loadDataAtOpen: z.boolean().optional(),
	columns: z.array(
		z.object({
			name: z.string(),
			linkField: z.string().optional(),
			visible: z.boolean().optional(),
			minWidth: z.number().optional(),
		}),
	),
	filter: z
		.array(
			z.object({
				operator: z.string(),
				term: z.string(),
				editable: z.boolean().optional(),
				disabled: z.boolean().optional(),
				sort: z.number().optional(),
				value: z.any().optional(),
				style: z.any().optional(),
			}),
		)
		.optional(),
	defaultFormat: z.string().optional(),
	boards: z
		.array(
			z.object({
				groupBy: z.object({
					field: z.string(),
					values: z.array(z.string()).optional(),
				}),
				card: z.record(
					z.object({
						linkField: z.string(),
						name: z.string(),
						slot: z.string().optional(),
						template: z.string().optional(),
						colors: z.array(z.string()).optional(),
						defaultValue: z.string().optional(),
						sort: z.number().optional(),
					}),
				),
			}),
		)
		.optional(),
	refreshRate: z.object({
		options: z.array(z.number()),
		default: z.number(),
	}),
	rowsPerPage: z.object({
		options: z.array(z.number()),
		default: z.number(),
	}),
	sorters: z.array(
		z.object({
			term: z.string(),
			direction: z.enum(['asc', 'desc']),
		}),
	),
	view: z.string().default('Default'),
	calendars: z
		.array(
			z.object({
				name: z.string(),
				startAt: z.string(),
				endAt: z.string().optional(),
				title: z.string(),
				descriminator: z.string().optional(),
				label: z.record(z.unknown()).optional(),
				itemType: z.enum(['event', 'task']).optional(),
				colorField: z.string().optional(),
			}),
		)
		.optional(),
});

export type DocumentList = z.infer<typeof DocumentListSchema>;
