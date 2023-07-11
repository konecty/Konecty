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
});

export type DocumentList = z.infer<typeof DocumentListSchema>;
