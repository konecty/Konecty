import { z } from 'zod';

const ResourceSchema = z.object({
	type: z.enum(['rabbitmq']),
	url: z.string(),
	queues: z.array(
		z.object({
			name: z.string(),
			driverParams: z.record(z.any()).optional(),
		}),
	),
});

// The rules use json-rules-engine to evaluate the conditions
// https://github.com/CacheControl/json-rules-engine/blob/master/docs/rules.md
const RuleSchema = z.object({
	resource: z.string(),
	queue: z.string(),
	metas: z.union([z.literal('*'), z.string(), z.array(z.string())]),
	conditions: z
		.object({ any: z.array(z.record(z.any())) })
		.or(z.object({ all: z.array(z.record(z.any())) }))
		.or(z.object({ not: z.record(z.any()) })),
});

export const QueueConfigSchema = z.object({
	resources: z.record(ResourceSchema),
	rules: z.array(RuleSchema),
});

export type QueueConfig = z.infer<typeof QueueConfigSchema>;
export type QueueRuleConfig = z.infer<typeof RuleSchema>;
export type QueueResourceConfig = z.infer<typeof ResourceSchema>;
