import z from 'zod';

export const UserModel = z.object({
	_id: z.string(),
	active: z.boolean(),
	lastLogin: z.date().optional(),
	services: z.object({
		resume: z.object({
			loginTokens: z.array(
				z.object({
					hashedToken: z.string(),
					when: z.date(),
				}),
			),
		}),
	}),
	access: z
		.object({
			defaults: z.string().optional(),
		})
		.catchall(z.any())
		.optional(),
	admin: z.boolean().optional(),
	emails: z.array(
		z.object({
			address: z.string(),
		}),
	),
	group: z
		.object({
			_id: z.string(),
			name: z.string(),
		})
		.optional(),
	locale: z.string().optional(),
	name: z.string().optional(),
	username: z.string().optional(),
	role: z
		.object({
			_id: z.string(),
			name: z.string(),
		})
		.optional(),
});

export type User = z.infer<typeof UserModel>;
