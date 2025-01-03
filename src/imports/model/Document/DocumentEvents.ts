import { z } from 'zod';

const QueueEventSchema = z.object({
	type: z.literal('queue'),
	params: z.object({
		queue: z.string(),
		resource: z.string(),
	}),
});

// The rules use json-rules-engine to evaluate the conditions
// https://github.com/CacheControl/json-rules-engine/blob/master/docs/rules.md
export const DocumentEventSchema = z.object({
	conditions: z
		.object({ any: z.array(z.record(z.any())) })
		.or(z.object({ all: z.array(z.record(z.any())) }))
		.or(z.object({ not: z.record(z.any()) })),
	event: z.discriminatedUnion('type', [QueueEventSchema]),
	name: z.string().optional(),
});

export type DocumentEvent = z.infer<typeof DocumentEventSchema>;
