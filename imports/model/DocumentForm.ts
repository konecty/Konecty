import { z } from 'zod';

export const DocumentFormVisualsSchema: z.ZodType = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('visualGroup'),
		style: z.any().optional(),
		label: z.any(),
		visuals: z.array(z.lazy(() => DocumentFormVisualsSchema)),
	}),
	z.object({
		type: z.literal('visualSymlink'),
		fieldName: z.string(),
	}),
	z.object({
		type: z.literal('reverseLookup'),
		style: z.any().optional(),
		field: z.string(),
		document: z.string(),
		list: z.string(),
	}),
]);

export type DocumentFormVisuals = z.infer<typeof DocumentFormVisualsSchema>;

export const DocumentFormSchema = z.object({
	_id: z.string(),
	name: z.string(),
	document: z.string().optional(),
	label: z.string(),
	plurals: z.string(),
	visuals: z.array(DocumentFormVisualsSchema),
});

export type DocumentForm = z.infer<typeof DocumentFormSchema>;
