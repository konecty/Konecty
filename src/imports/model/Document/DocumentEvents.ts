import { z } from 'zod';

const QueueEventSchema = z.object({
	type: z.literal('queue'),
	queue: z.string().or(z.string().array()),
	resource: z.string(),

	sendOriginal: z.boolean().optional(),
});

// The rules use json-rules-engine to evaluate the conditions
// https://github.com/CacheControl/json-rules-engine/blob/master/docs/rules.md
export const DocumentEventSchema = z.object({
	event: z.discriminatedUnion('type', [QueueEventSchema]),
	name: z.string().optional(),
	conditions: z
		.object({ any: z.array(z.record(z.any())) })
		.or(z.object({ all: z.array(z.record(z.any())) }))
		.or(z.object({ not: z.record(z.any()) })),
});

export type DocumentEvent = z.infer<typeof DocumentEventSchema>;
