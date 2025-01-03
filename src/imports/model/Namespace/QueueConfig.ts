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

export const QueueConfigSchema = z.object({
	resources: z.record(ResourceSchema),
});

export type QueueConfig = z.infer<typeof QueueConfigSchema>;
export type QueueResourceConfig = z.infer<typeof ResourceSchema>;
