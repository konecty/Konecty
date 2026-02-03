import { z } from 'zod';
import { LabelSchema } from './Label';
import { KonFilter } from './Filter';

export const ListSchema = z.object({
	type: z.literal('list'),
	_id: z.string(),
	group: z.string().optional(),
	document: z.string(),
	menuSorter: z.number().optional(),
	name: z.string(),
	label: LabelSchema,
	plurals: LabelSchema,
	loadDataAtOpen: z.boolean().optional(),
	namespace: z.array(z.string()).optional(),
	icon: z.string().optional(),
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
	filter: KonFilter.optional(),
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
	columns: z.record(
		z.object({
			name: z.string(),
			linkField: z.string(),
			visible: z.boolean().default(true),
			minWidth: z.number().optional(),
			sort: z.number().optional(),
		}),
	),
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
	collection: z.string().optional(),
});

export type List = z.infer<typeof ListSchema>;
