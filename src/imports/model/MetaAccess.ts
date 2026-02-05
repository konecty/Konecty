import { z } from 'zod';
import { Condition, KonFilter } from './Filter';

export const FieldAccessSchema = z.record(
	z.literal('CREATE').or(z.literal('READ')).or(z.literal('UPDATE')).or(z.literal('DELETE')),
	z.object({
		condition: Condition.optional(),
		allow: z.boolean().optional(),
	}),
);

export type FieldAccess = z.infer<typeof FieldAccessSchema>;

export const MetaAccessSchema = z.object({
	_id: z.string(),
	document: z.string(),
	name: z.string(),
	type: z.literal('access'),

	fields: z.record(FieldAccessSchema),
	fieldDefaults: z.object({
		isUpdatable: z.boolean().optional(),
		isCreatable: z.boolean().optional(),
		isReadable: z.boolean().optional(),
		isDeletable: z.boolean().optional(),
	}),
	isUpdatable: z.boolean().optional(),
	isCreatable: z.boolean().optional(),
	isReadable: z.boolean().optional(),
	isDeletable: z.boolean().optional(),

	changeUser: z.boolean().optional(),

	readFilter: KonFilter.extend({ allow: z.boolean().optional() }).optional(),
	updateFilter: KonFilter.extend({ allow: z.boolean().optional() }).optional(),

	// New properties for granular menu control
	hideListsFromMenu: z.array(z.string()).optional(),
	hidePivotsFromMenu: z.array(z.string()).optional(),
	// New property for menu sorting override (number for legacy, record for per-document override)
	menuSorter: z.union([z.number(), z.record(z.string(), z.number())]).optional(),

	// Export permissions
	export: z.record(z.array(z.string())).optional(),
	exportLarge: z.record(z.array(z.string())).optional(),
});

export type MetaAccess = z.infer<typeof MetaAccessSchema>;
