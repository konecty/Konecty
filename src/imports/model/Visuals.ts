import { z } from 'zod';

const VisualSymlinkSchema = z.object({
	type: z.literal('visualSymlink'),
	fieldName: z.string(),
});

type VisualSymlink = z.infer<typeof VisualSymlinkSchema>;

const ReverseLookupSchema = z.object({
	type: z.literal('reverseLookup'),
	style: z.any().optional(),
	field: z.string(),
	document: z.string(),
	list: z.string(),
});

type ReverseLookup = z.infer<typeof ReverseLookupSchema>;

const baseVisualGroupSchema = z.object({
	type: z.literal('visualGroup'),
	style: z.any().optional(),
	label: z.any(),
});

type VisualGroup = z.infer<typeof baseVisualGroupSchema> & { visuals: Visuals[] };

export type Visuals = VisualGroup | VisualSymlink | ReverseLookup;

export const VisualsSchema: z.ZodType<Visuals> = z.discriminatedUnion('type', [
	baseVisualGroupSchema.extend({
		visuals: z.array(z.lazy(() => VisualsSchema)),
	}),
	VisualSymlinkSchema,
	ReverseLookupSchema,
]);
