import { z } from 'zod';

export const WatermarkConfigSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('s3'),
		bucket: z.string(),
		key: z.string(),
		config: z.record(z.any()).optional(),
	}),
	z.object({
		type: z.literal('fs'),
		directory: z.string(),
		path: z.string(),
	}),
	z.object({
		type: z.literal('url'),
		url: z.string(),
	}),
	z.object({
		type: z.literal('text'),
		text: z.string(),
	}),
]);

export type WatermarkConfig = z.infer<typeof WatermarkConfigSchema>;
