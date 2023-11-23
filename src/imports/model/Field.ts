import { z } from 'zod';
import { LabelSchema } from './Label';
import { OptionsSchema } from './Options';

export const FieldSchema = z.object({
	descriptionFields: z.array(z.string()).optional(),
	type: z.string(),
	name: z.string(),
	isRequired: z.boolean().optional(),
	label: LabelSchema.optional(),
	document: z.string().optional(),
	isUnique: z.boolean().optional(),
	isSortable: z.boolean().optional(),
	maxSelected: z.number().optional(),
	minSelected: z.number().optional(),
	optionsSorter: z.string().optional(),
	options: OptionsSchema.optional(),
	renderAs: z.string().optional(),
	decimalSize: z.number().optional(),
	minValue: z.number().optional(),
	isList: z.boolean().optional(),
});

export type Field = z.infer<typeof FieldSchema>;
