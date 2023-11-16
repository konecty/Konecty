import { DocumentFormVisualsSchema } from '@imports/model/DocumentForm';
import { z } from 'zod';

export const LabelSchema = z.record(z.string());

export type Label = z.infer<typeof LabelSchema>;

export const OptionsSchema = z.record(
	z
		.object({
			sort: z.number().optional(),
		})
		.catchall(z.string()),
);
export type Options = z.infer<typeof OptionsSchema>;

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

const RelationSchema = z.object({
	document: z.string(),
	lookup: z.string(),
	aggregators: z.record(
		z.object({
			aggregator: z.string(),
			field: z.string(),
		}),
	),
	filter: z.object({
		match: z.enum(['and', 'or']),
		conditions: z.array(
			z.object({
				term: z.string(),
				operator: z.enum(['equals', 'less_or_equals', 'greater_or_equals']),
				value: z.union([z.string(), z.number()]),
			}),
		),
	}),
});

export type Relation = z.infer<typeof RelationSchema>;

// Definição do tipo "Integration"
export const MetaObjectSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('document'),
		_id: z.string(),
		name: z.string(),
		label: LabelSchema,
		plurals: LabelSchema,
		icon: z.string(),
		colletion: z.string().optional(),
		fields: z.record(z.string(), FieldSchema),
		menuSorter: z.number().optional(),
		access: z.string(),
		group: z.string().optional(),
		validationScript: z.string(),
		indexes: z
			.record(
				z.string(),
				z.object({
					keys: z.record(z.string(), z.number()),
					options: z.object({
						name: z.string().optional(),
						unique: z.boolean().optional(),
						dropDups: z.boolean().optional(),
					}),
				}),
			)
			.optional(),
		indexText: z.record(z.string(), z.string()).optional(),
		help: LabelSchema,
		description: LabelSchema,
		relations: z.array(RelationSchema),
		collection: z.string().optional(),
	}),
	z.object({
		type: z.literal('composite'),
		_id: z.string(),
		name: z.string(),
		label: LabelSchema,
		fields: z.record(z.string(), FieldSchema),
		collection: z.string().optional(),
		indexes: z
			.record(
				z.string(),
				z.object({
					keys: z.record(z.string(), z.number()),
					options: z.object({
						name: z.string().optional(),
						unique: z.boolean().optional(),
						dropDups: z.boolean().optional(),
					}),
				}),
			)
			.optional(),
		indexText: z.record(z.string(), z.string()).optional(),
	}),
	z.object({
		type: z.literal('group'),
		_id: z.string(),
		name: z.string(),
		group: z.string().optional(),
		menuSorter: z.number().optional(),
		label: LabelSchema,
		plurals: LabelSchema,
		icon: z.string().optional(),
		collection: z.string().optional(),
	}),
	z.object({
		type: z.literal('list'),
		_id: z.string(),
		group: z.string().optional(),
		document: z.string(),
		menuSorter: z.number().optional(),
		name: z.string(),
		label: LabelSchema,
		plurals: LabelSchema,
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
		filter: z.any().optional(), // TODO: Definir o tipo correto
		columns: z.record(
			z.object({
				name: z.string(),
				linkedField: z.string(),
				visible: z.boolean().default(true),
				minWidth: z.number().optional(),
				sort: z.number().optional(),
			}),
		),
		collection: z.string().optional(),
	}),
	z.object({
		type: z.literal('view'),
		_id: z.string(),
		document: z.string(),
		name: z.string(),
		label: LabelSchema,
		plurals: LabelSchema,
		icon: z.string().optional(),
		visuals: z.array(DocumentFormVisualsSchema).optional(),
		collection: z.string().optional(),
	}),
	z.object({
		type: z.literal('pivot'),
		_id: z.string(),
		group: z.string().optional(),
		menuSorter: z.number().optional(),
		document: z.string(),
		name: z.string(),
		label: LabelSchema,
		plurals: LabelSchema,
		icon: z.string().optional(),
		rows: z.array(z.any()).optional(), // TODO: Definir o tipo correto
		collection: z.string().optional(),
	}),
	z.object({
		type: z.literal('access'),
		_id: z.string(),
		document: z.string(),
		name: z.string(),
		collection: z.string().optional(),
	}),
]);

export type MetaObjectType = z.infer<typeof MetaObjectSchema>;
