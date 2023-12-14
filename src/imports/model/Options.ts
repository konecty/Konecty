import { z } from 'zod';

export const OptionsSchema = z.record(
	z
		.object({
			sort: z.number().optional(),
		})
		.catchall(z.string()),
);

export type Options = z.infer<typeof OptionsSchema>;
