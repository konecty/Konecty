import { z } from 'zod';

import { CrossModuleQuerySchema } from '@imports/types/crossModuleQuery';

const OwnerSchema = z.object({
	_id: z.string(),
	name: z.string(),
});

const SharedWithItemSchema = z.object({
	type: z.enum(['user', 'group']),
	_id: z.string(),
	name: z.string(),
});

export const SavedQuerySchema = z.object({
	_id: z.string(),
	name: z.string().min(1).max(200),
	description: z.string().optional(),
	query: CrossModuleQuerySchema,
	owner: OwnerSchema,
	sharedWith: z.array(SharedWithItemSchema).default([]),
	isPublic: z.boolean().default(false),
	_createdAt: z.coerce.date(),
	_updatedAt: z.coerce.date(),
	_createdBy: OwnerSchema,
	_updatedBy: OwnerSchema,
});

export type SavedQuery = z.infer<typeof SavedQuerySchema>;

export const CreateSavedQueryInputSchema = z.object({
	name: z.string().min(1).max(200),
	description: z.string().optional(),
	query: CrossModuleQuerySchema,
});

export type CreateSavedQueryInput = z.infer<typeof CreateSavedQueryInputSchema>;

export const UpdateSavedQueryInputSchema = z.object({
	name: z.string().min(1).max(200).optional(),
	description: z.string().optional(),
	query: CrossModuleQuerySchema.optional(),
});

export type UpdateSavedQueryInput = z.infer<typeof UpdateSavedQueryInputSchema>;

export const ShareSavedQueryInputSchema = z.object({
	sharedWith: z.array(SharedWithItemSchema),
	isPublic: z.boolean().optional(),
});

export type ShareSavedQueryInput = z.infer<typeof ShareSavedQueryInputSchema>;
