import { z } from 'zod';

export const MenuItemSchema = z.object({
	name: z.string(),
	type: z.string(),
	document: z.string().optional(),
	menuSorter: z.number().optional(),
	icon: z.string().optional(),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;

export type MenuGroup = z.infer<typeof MenuItemSchema> & {
	lists?: Array<MenuItem>;
	pivots?: Array<MenuItem>;
	children?: Array<MenuGroup>;
};

export const MenuGroupSchema: z.ZodSchema<MenuGroup> = MenuItemSchema.extend({
	lists: z.array(MenuItemSchema).optional(),
	pivots: z.array(MenuItemSchema).optional(),
	children: z.lazy(() => MenuGroupSchema.array()).optional(),
});
