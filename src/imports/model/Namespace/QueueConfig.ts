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
	konsistent: z.tuple([z.string().describe('resourceName'), z.string().describe('queueName')]).optional(),
});

export type QueueConfig = z.infer<typeof QueueConfigSchema>;
export type QueueResourceConfig = z.infer<typeof ResourceSchema>;
